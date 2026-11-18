import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
import { InventoryPanel } from "./InventoryPanel";

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
  onUseItem: (itemId: string) => void;
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
  onUseItem,
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
  const [viewportSize, setViewportSize] = useState({ width: 960, height: 540 });

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const pressedKeys = useRef<Set<string>>(new Set());
  // 키를 누르자마자 최고 속도로 튀어나가는 대신, 가속/감속을 둬서 걸음이 더
  // 자연스럽게 붙었다 떨어지도록 하는 현재 속도(벡터).
  const velocityRef = useRef({ vx: 0, vy: 0 });
  const encounterLockRef = useRef(false);
  const targetRef = useRef<Interactable | null>(null);
  targetRef.current = target;

  // 위치/방향이 바뀔 때마다 서버로 전송 (연결돼 있을 때만 실제로 전송됨)
  // 체력/레벨도 함께 보내 파티 HUD가 전투 밖에서도 최신 상태를 보여줄 수 있게 한다.
  useEffect(() => {
    sendMove(pos.x, pos.y, direction, moving, player.hp, stats.maxHp, player.level);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos.x, pos.y, direction, moving, player.hp, stats.maxHp, player.level]);

  // 별도 스크롤 영역을 두지 않고, 창(뷰포트) 자체가 카메라 역할을 하도록 실제 픽셀
  // 크기를 측정한다. 창 크기가 바뀌면(리사이즈) 즉시 다시 측정한다.
  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const update = () => setViewportSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
      const hasInput = dx !== 0 || dy !== 0;
      if (hasInput) {
        const len = Math.hypot(dx, dy) || 1;
        dx /= len;
        dy /= len;
      }

      // 목표 속도(입력 방향 * 최고 속도)로 즉시 점프하지 않고, 지수 감쇠로 부드럽게
      // 다가가게 한다. 멈출 때도 마찬가지로 서서히 속도가 줄어들어 미끄러지듯
      // 멈춰서, 딱딱하게 뚝 끊기던 기존 움직임보다 훨씬 자연스럽다.
      const targetVx = dx * PLAYER_SPEED;
      const targetVy = dy * PLAYER_SPEED;
      const rate = hasInput ? 14 : 18; // 멈출 때(감속)는 출발할 때보다 조금 더 빠르게 줄인다
      const smoothing = 1 - Math.exp(-rate * dt);
      const v = velocityRef.current;
      v.vx += (targetVx - v.vx) * smoothing;
      v.vy += (targetVy - v.vy) * smoothing;

      const speed = Math.hypot(v.vx, v.vy);
      if (speed > 0.5) {
        setPos((p) => ({
          x: Math.max(0, Math.min(MAP_WIDTH - PLAYER_SIZE, p.x + v.vx * dt)),
          y: Math.max(0, Math.min(MAP_HEIGHT - PLAYER_SIZE, p.y + v.vy * dt)),
        }));
      } else {
        v.vx = 0;
        v.vy = 0;
      }
      if (hasInput && newDir) setDirection(newDir);
      setMoving(hasInput);

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

  // 플레이어가 뷰포트(창) 중앙에 오도록 카메라 오프셋을 계산하고, 맵 바깥이 보이지
  // 않도록 0 ~ (맵 크기 - 뷰포트 크기) 범위로 고정(clamp)한다.
  const camX = Math.max(
    0,
    Math.min(MAP_WIDTH - viewportSize.width, pos.x + PLAYER_SIZE / 2 - viewportSize.width / 2),
  );
  const camY = Math.max(
    0,
    Math.min(MAP_HEIGHT - viewportSize.height, pos.y + PLAYER_SIZE / 2 - viewportSize.height / 2),
  );

  return (
    <div className="overworld-screen">
      <div className="overworld-topbar">
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
        {multiplayerActive && mpStatus === "connected" && mp.room && (
          <span className="room-code-badge" title="친구에게 이 코드를 알려주면 같은 방에 들어올 수 있습니다">
            방 코드 <strong>{mp.room}</strong>
            <span className="room-host-tag">
              · 방장:{" "}
              {mp.hostId === mp.selfId
                ? "나"
                : remotePlayers.find((rp) => rp.id === mp.hostId)?.name ?? "알 수 없음"}
            </span>
          </span>
        )}
        <button className="btn-secondary" onClick={onExitToTitle}>
          타이틀로
        </button>
      </div>

      <div className="overworld-viewport" ref={viewportRef}>
        <div
          className="overworld-world"
          style={{
            width: MAP_WIDTH,
            height: MAP_HEIGHT,
            transform: `translate(${-camX}px, ${-camY}px)`,
          }}
        >
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
              <div key={portal.instanceId} className="boss-gate" style={{ left: portal.x, top: portal.y }}>
                {/* 포털 아이콘만 있으면 보스가 맵에 전혀 안 보여서 밋밋하니, 포털 뒤에
                    실제 보스 실루엣을 크게 세워 둔다. 잠겨 있을 때는 어둡게, 열리면
                    또렷하게 보여서 "저게 보스구나"를 바로 알 수 있게 한다. */}
                <div className={`boss-silhouette${questsComplete ? "" : " locked"}`}>
                  <MonsterSprite kind={portal.monsterId} scale={7} moving={false} />
                </div>
                <div
                  className={`dungeon-portal${questsComplete ? " unlocked" : " locked"}${isTarget ? " targetable" : ""}`}
                  style={{ width: portal.size, height: portal.size }}
                  title={questsComplete ? `던전 입구: ${portal.name}` : "모든 퀘스트를 완료해야 열립니다"}
                >
                  <span className="dungeon-portal-icon">{questsComplete ? "🌀" : "🔒"}</span>
                  {isTarget && (
                    <div className="interact-prompt">{questsComplete ? "E 입장" : "🔒 잠김"}</div>
                  )}
                </div>
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
                <MonsterSprite kind={spawn.monsterId} scale={3.8} />
                {isTarget && <div className="interact-prompt">E 전투</div>}
              </div>
            );
          })}

          {remotePlayers.map((rp) => (
            <div
            key={rp.id}
            className={`overworld-entity remote-entity${rp.moving ? " walking" : ""}`}
            style={{ left: rp.x, top: rp.y }}
          >
              <span className="remote-name-tag">{rp.name}</span>
              <CharacterSprite kind={rp.jobId} direction={rp.dir} moving={rp.moving} scale={3.8} />
            </div>
          ))}

          <div
            className={`overworld-entity player-entity${moving ? " walking" : ""}`}
            style={{ left: pos.x, top: pos.y }}
          >
            <CharacterSprite kind={player.job.id} direction={direction} moving={moving} scale={3.8} />
          </div>
        </div>

        <div className="minimap">
          <div className="minimap-label">지도</div>
          {DUNGEON_PORTALS.map((portal) => (
            <div
              key={portal.instanceId}
              className={`minimap-dot minimap-portal${questsComplete ? "" : " locked"}`}
              style={{ left: `${(portal.x / MAP_WIDTH) * 100}%`, top: `${(portal.y / MAP_HEIGHT) * 100}%` }}
              title={portal.name}
            />
          ))}
          {MONSTER_SPAWNS.filter((s) => !clearedInstanceIds.includes(s.instanceId)).map((spawn) => {
            const w = monsterWander[spawn.instanceId];
            const x = w?.x ?? spawn.x;
            const y = w?.y ?? spawn.y;
            return (
              <div
                key={spawn.instanceId}
                className="minimap-dot minimap-monster"
                style={{ left: `${(x / MAP_WIDTH) * 100}%`, top: `${(y / MAP_HEIGHT) * 100}%` }}
              />
            );
          })}
          {remotePlayers.map((rp) => (
            <div
              key={rp.id}
              className="minimap-dot minimap-remote"
              style={{ left: `${(rp.x / MAP_WIDTH) * 100}%`, top: `${(rp.y / MAP_HEIGHT) * 100}%` }}
            />
          ))}
          <div
            className="minimap-dot minimap-player"
            style={{ left: `${(pos.x / MAP_WIDTH) * 100}%`, top: `${(pos.y / MAP_HEIGHT) * 100}%` }}
          />
        </div>

        {questStatus && (
          <div className={`quest-banner overlay-banner${questStatus.done ? " done" : ""}`}>
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
          <div className="overworld-hint overlay-hint" style={{ color: "var(--danger)" }}>
            {mpErrorMessage} (방 코드/서버 주소를 확인하세요)
          </div>
        )}

        {multiplayerActive && mpStatus === "connected" && (
          <PartyPanel mp={mp} selfPlayer={player} selfStats={stats} remotePlayers={remotePlayers} />
        )}

        <div className="inventory-panel-anchor">
          <InventoryPanel inventory={player.inventory} onUse={onUseItem} manaUsable={false} />
        </div>

        <div className="overworld-hint overlay-hint bottom-hint">
          방향키 또는 WASD로 이동 · 몬스터나 던전 입구에 가까이 가서 E키를 누르면 전투가 시작됩니다 · 쓰러뜨린 몬스터는 잠시 후 다시 나타납니다 · 보스는 모든 퀘스트를 완료해야 도전할 수 있습니다
          {multiplayerActive && " · 보스전은 같은 방에 있는 친구와 함께 싸웁니다"}
        </div>
      </div>
    </div>
  );
}
