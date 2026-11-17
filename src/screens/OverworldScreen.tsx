import { useEffect, useRef, useState } from "react";
import { CharacterSprite, MonsterSprite } from "../render/SpriteCanvas";
import type { Direction } from "../render/sprites";
import {
  DUNGEON_PORTALS,
  INTERACT_RANGE,
  MAP_HEIGHT,
  MAP_WIDTH,
  MONSTER_SIZE,
  MONSTER_SPAWNS,
  MONSTER_WANDER_RADIUS,
  MONSTER_WANDER_SPEED,
  PLAYER_SIZE,
  PLAYER_SPEED,
  TREE_DECORATIONS,
} from "../data/overworld";
import type { RemotePlayer, ConnectionStatus, MultiplayerApi } from "../multiplayer/useMultiplayer";
import type { MonsterId, PlayerCharacter, PlayerStats } from "../types";
import { PartyPanel } from "./PartyPanel";

export interface QuestStatus {
  title: string;
  description: string;
  progress: number;
  target: number;
  done: boolean;
}

interface Props {
  player: PlayerCharacter;
  stats: PlayerStats;
  clearedInstanceIds: string[];
  multiplayerActive: boolean;
  mpStatus: ConnectionStatus;
  mpErrorMessage: string | null;
  remotePlayers: RemotePlayer[];
  sendMove: (x: number, y: number, dir: Direction, moving: boolean, hp?: number, maxHp?: number, level?: number) => void;
  mp: MultiplayerApi;
  questStatus: QuestStatus | null;
  questsComplete: boolean;
  onEncounter: (instanceId: string, monsterId: MonsterId) => void;
  onPortalLocked: () => void;
  onExitToTitle: () => void;
}

const MP_STATUS_LABEL: Record<string, string> = {
  idle: "싱글플레이",
  connecting: "서버 연결 중...",
  connected: "멀티플레이 연결됨",
  error: "서버 연결 실패",
};

const MOVE_KEYS: Record<string, { dx: number; dy: number; dir: Direction }> = {
  ArrowUp: { dx: 0, dy: -1, dir: "up" },
  ArrowDown: { dx: 0, dy: 1, dir: "down" },
  ArrowLeft: { dx: -1, dy: 0, dir: "left" },
  ArrowRight: { dx: 1, dy: 0, dir: "right" },
  w: { dx: 0, dy: -1, dir: "up" },
  s: { dx: 0, dy: 1, dir: "down" },
  a: { dx: -1, dy: 0, dir: "left" },
  d: { dx: 1, dy: 0, dir: "right" },
};

interface WanderState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  nextTurnAt: number;
}

function randomWanderVelocity(): { vx: number; vy: number } {
  const angle = Math.random() * Math.PI * 2;
  return { vx: Math.cos(angle) * MONSTER_WANDER_SPEED, vy: Math.sin(angle) * MONSTER_WANDER_SPEED };
}

type Interactable = { kind: "monster"; instanceId: string; monsterId: MonsterId } | { kind: "portal"; instanceId: string; monsterId: MonsterId };

export function OverworldScreen({
  player,
  stats,
  clearedInstanceIds,
  multiplayerActive,
  mpStatus,
  mpErrorMessage,
  remotePlayers,
  sendMove,
  mp,
  questStatus,
  questsComplete,
  onEncounter,
  onPortalLocked,
  onExitToTitle,
}: Props) {
  const [pos, setPos] = useState({ x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 });
  const [direction, setDirection] = useState<Direction>("down");
  const [moving, setMoving] = useState(false);
  const [monsterWander, setMonsterWander] = useState<Record<string, WanderState>>(() => {
    const init: Record<string, WanderState> = {};
    for (const spawn of MONSTER_SPAWNS) {
      init[spawn.instanceId] = { x: spawn.x, y: spawn.y, ...randomWanderVelocity(), nextTurnAt: 0 };
    }
    return init;
  });
  const [target, setTarget] = useState<Interactable | null>(null);

  const pressedKeys = useRef<Set<string>>(new Set());
  const encounterLockRef = useRef(false);
  const targetRef = useRef<Interactable | null>(null);
  targetRef.current = target;

  // 위치/방향이 바뀔 때마다 서버로 전송 (연결돼 있을 때만 실제로 전송됨)
  // 체력/레벨도 함께 보내 파티 HUD가 전투 밖에서도 최신 상태를 보여줄 수 있게 한다.
  useEffect(() => {
    sendMove(pos.x, pos.y, direction, moving, player.hp, stats.maxHp, player.level);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos.x, pos.y, direction, moving, player.hp, stats.maxHp, player.level]);

  // 항상 최신 props/state를 참조하도록 ref에 보관해, 키 이벤트 리스너는 한 번만 등록한다.
  const tryInteractRef = useRef<() => void>(() => {});
  tryInteractRef.current = () => {
    const t = targetRef.current;
    if (!t || encounterLockRef.current) return;
    if (t.kind === "portal" && !questsComplete) {
      onPortalLocked();
      return;
    }
    encounterLockRef.current = true;
    onEncounter(t.instanceId, t.monsterId);
  };

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (MOVE_KEYS[e.key]) pressedKeys.current.add(e.key);
      if (e.key === "e" || e.key === "E") tryInteractRef.current();
    }
    function onKeyUp(e: KeyboardEvent) {
      pressedKeys.current.delete(e.key);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    function tick(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      let dx = 0;
      let dy = 0;
      let newDir: Direction | null = null;
      for (const key of pressedKeys.current) {
        const m = MOVE_KEYS[key];
        if (!m) continue;
        dx += m.dx;
        dy += m.dy;
        newDir = m.dir;
      }

      const isMoving = dx !== 0 || dy !== 0;
      if (dx !== 0 || dy !== 0) {
        const len = Math.hypot(dx, dy) || 1;
        const step = PLAYER_SPEED * dt;
        setPos((p) => ({
          x: Math.max(0, Math.min(MAP_WIDTH - PLAYER_SIZE, p.x + (dx / len) * step)),
          y: Math.max(0, Math.min(MAP_HEIGHT - PLAYER_SIZE, p.y + (dy / len) * step)),
        }));
        if (newDir) setDirection(newDir);
      }
      setMoving(isMoving);

      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // 몬스터 배회(wander) 갱신: 살아있는 몬스터는 홈 지점 주변을 느리게 돌아다니고,
  // 처치된(clearedInstanceIds에 포함된) 몬스터는 홈 지점에서 멈춘 채 대기한다
  // (부모에서 일정 시간 뒤 clearedInstanceIds에서 제거되면 자동으로 다시 움직인다 = 리스폰).
  useEffect(() => {
    let last = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const dt = Math.min(0.3, (now - last) / 1000);
      last = now;
      setMonsterWander((prev) => {
        const next: Record<string, WanderState> = {};
        for (const spawn of MONSTER_SPAWNS) {
          if (clearedInstanceIds.includes(spawn.instanceId)) {
            next[spawn.instanceId] = { x: spawn.x, y: spawn.y, vx: 0, vy: 0, nextTurnAt: 0 };
            continue;
          }
          const w = prev[spawn.instanceId] ?? { x: spawn.x, y: spawn.y, ...randomWanderVelocity(), nextTurnAt: 0 };
          let { x, y, vx, vy, nextTurnAt } = w;
          if (now >= nextTurnAt) {
            const v = randomWanderVelocity();
            vx = v.vx;
            vy = v.vy;
            nextTurnAt = now + 2000 + Math.random() * 2500;
          }
          let nx = x + vx * dt;
          let ny = y + vy * dt;
          if (Math.hypot(nx - spawn.x, ny - spawn.y) > MONSTER_WANDER_RADIUS) {
            const angle = Math.atan2(spawn.y - y, spawn.x - x);
            vx = Math.cos(angle) * MONSTER_WANDER_SPEED;
            vy = Math.sin(angle) * MONSTER_WANDER_SPEED;
            nx = x + vx * dt;
            ny = y + vy * dt;
          }
          nx = Math.max(0, Math.min(MAP_WIDTH - MONSTER_SIZE, nx));
          ny = Math.max(0, Math.min(MAP_HEIGHT - MONSTER_SIZE, ny));
          next[spawn.instanceId] = { x: nx, y: ny, vx, vy, nextTurnAt };
        }
        return next;
      });
    }, 100);
    return () => clearInterval(id);
  }, [clearedInstanceIds]);

  // 플레이어 근처의 상호작용 대상(몬스터/던전 입구)을 찾는다 — 실제 전투 진입은 E키로만 일어난다
  useEffect(() => {
    const px = pos.x + PLAYER_SIZE / 2;
    const py = pos.y + PLAYER_SIZE / 2;
    let best: Interactable | null = null;
    let bestDist = INTERACT_RANGE;

    for (const spawn of MONSTER_SPAWNS) {
      if (clearedInstanceIds.includes(spawn.instanceId)) continue;
      const w = monsterWander[spawn.instanceId];
      if (!w) continue;
      const d = Math.hypot(px - (w.x + MONSTER_SIZE / 2), py - (w.y + MONSTER_SIZE / 2));
      if (d < bestDist) {
        bestDist = d;
        best = { kind: "monster", instanceId: spawn.instanceId, monsterId: spawn.monsterId };
      }
    }
    for (const portal of DUNGEON_PORTALS) {
      const d = Math.hypot(px - (portal.x + portal.size / 2), py - (portal.y + portal.size / 2));
      if (d < bestDist) {
        bestDist = d;
        best = { kind: "portal", instanceId: portal.instanceId, monsterId: portal.monsterId };
      }
    }
    setTarget((cur) => {
      if (cur && best && cur.instanceId === best.instanceId && cur.kind === best.kind) return cur;
      return best;
    });
  }, [pos, monsterWander, clearedInstanceIds]);

  return (
    <div className="panel overworld-screen">
      <div className="overworld-hud">
        <div className="hud-left">
          <span className="hud-name">
            {player.job.icon} {player.name}
          </span>
          <span className="hud-level">Lv.{player.level}</span>
        </div>
        <div className="hud-hp">
          <div className="hp-bar-track small">
            <div
              className="hp-bar-fill"
              style={{ width: `${Math.max(0, (player.hp / stats.maxHp) * 100)}%` }}
            />
          </div>
          <span className="hud-hp-text">
            HP {player.hp}/{stats.maxHp}
          </span>
        </div>
        {multiplayerActive && (
          <span className={`mp-status ${mpStatus}`}>
            {MP_STATUS_LABEL[mpStatus]}
            {mpStatus === "connected" && ` · ${remotePlayers.length + 1}명`}
          </span>
        )}
        <button className="btn-secondary" onClick={onExitToTitle}>
          타이틀로
        </button>
      </div>

      {questStatus && (
        <div className={`quest-banner${questStatus.done ? " done" : ""}`}>
          <strong>{questStatus.done ? "모든 퀘스트 완료!" : `퀘스트: ${questStatus.title}`}</strong>
          {!questStatus.done && (
            <>
              <span className="quest-desc">{questStatus.description}</span>
              <span className="quest-progress">
                {questStatus.progress}/{questStatus.target}
              </span>
            </>
          )}
        </div>
      )}

      {multiplayerActive && mpStatus === "error" && mpErrorMessage && (
        <div className="overworld-hint" style={{ color: "var(--danger)" }}>
          {mpErrorMessage} (방 코드/서버 주소를 확인하세요)
        </div>
      )}

      {multiplayerActive && mpStatus === "connected" && (
        <PartyPanel mp={mp} selfPlayer={player} selfStats={stats} remotePlayers={remotePlayers} />
      )}

      <div className="overworld-viewport" style={{ width: MAP_WIDTH, height: MAP_HEIGHT }}>
        <div className="grass-field" />
        {TREE_DECORATIONS.map((t, i) => (
          <div
            key={i}
            className="tree-deco"
            style={{ left: t.x, top: t.y, width: t.size, height: t.size }}
          />
        ))}

        {DUNGEON_PORTALS.map((portal) => {
          const isTarget = target?.kind === "portal" && target.instanceId === portal.instanceId;
          return (
            <div
              key={portal.instanceId}
              className={`dungeon-portal${questsComplete ? " unlocked" : " locked"}${isTarget ? " targetable" : ""}`}
              style={{
                left: portal.x,
                top: portal.y,
                width: portal.size,
                height: portal.size,
              }}
              title={questsComplete ? `던전 입구: ${portal.name}` : "모든 퀘스트를 완료해야 열립니다"}
            >
              <span className="dungeon-portal-icon">{questsComplete ? "🌀" : "🔒"}</span>
              {isTarget && (
                <div className="interact-prompt">{questsComplete ? "E 입장" : "🔒 잠김"}</div>
              )}
            </div>
          );
        })}

        {MONSTER_SPAWNS.filter((s) => !clearedInstanceIds.includes(s.instanceId)).map((spawn) => {
          const w = monsterWander[spawn.instanceId];
          const isTarget = target?.kind === "monster" && target.instanceId === spawn.instanceId;
          return (
            <div
              key={spawn.instanceId}
              className={`overworld-entity wander-entity${isTarget ? " targetable" : ""}`}
              style={{ left: w?.x ?? spawn.x, top: w?.y ?? spawn.y }}
            >
              <MonsterSprite kind={spawn.monsterId} scale={3.2} />
              {isTarget && <div className="interact-prompt">E 전투</div>}
            </div>
          );
        })}

        {remotePlayers.map((rp) => (
          <div key={rp.id} className="overworld-entity remote-entity" style={{ left: rp.x, top: rp.y }}>
            <span className="remote-name-tag">{rp.name}</span>
            <CharacterSprite kind={rp.jobId} direction={rp.dir} moving={rp.moving} scale={3.2} />
          </div>
        ))}

        <div className="overworld-entity player-entity" style={{ left: pos.x, top: pos.y }}>
          <CharacterSprite kind={player.job.id} direction={direction} moving={moving} scale={3.2} />
        </div>
      </div>

      <div className="overworld-hint">
        방향키 또는 WASD로 이동 · 몬스터나 던전 입구에 가까이 가서 E키를 누르면 전투가 시작됩니다 · 쓰러뜨린 몬스터는 잠시 후 다시 나타납니다 · 보스는 모든 퀘스트를 완료해야 도전할 수 있습니다
        {multiplayerActive && " · 보스전은 같은 방에 있는 친구와 함께 싸웁니다"}
      </div>
    </div>
  );
}
