import { useEffect, useRef, useState } from "react";
import { CharacterSprite, MonsterSprite } from "../render/SpriteCanvas";
import type { Direction } from "../render/sprites";
import {
  DUNGEON_PORTALS,
  MAP_HEIGHT,
  MAP_WIDTH,
  MONSTER_SIZE,
  MONSTER_SPAWNS,
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

  const pressedKeys = useRef<Set<string>>(new Set());
  const encounterLockRef = useRef(false);
  const portalLockRefs = useRef<Map<string, boolean>>(new Map());

  // 위치/방향이 바뀔 때마다 서버로 전송 (연결돼 있을 때만 실제로 전송됨)
  // 체력/레벨도 함께 보내 파티 HUD가 전투 밖에서도 최신 상태를 보여줄 수 있게 한다.
  useEffect(() => {
    sendMove(pos.x, pos.y, direction, moving, player.hp, stats.maxHp, player.level);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos.x, pos.y, direction, moving, player.hp, stats.maxHp, player.level]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (MOVE_KEYS[e.key]) pressedKeys.current.add(e.key);
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

  // 충돌(조우) 판정
  useEffect(() => {
    if (encounterLockRef.current) return;
    for (const spawn of MONSTER_SPAWNS) {
      if (clearedInstanceIds.includes(spawn.instanceId)) continue;
      const overlap =
        pos.x < spawn.x + MONSTER_SIZE &&
        pos.x + PLAYER_SIZE > spawn.x &&
        pos.y < spawn.y + MONSTER_SIZE &&
        pos.y + PLAYER_SIZE > spawn.y;
      if (overlap) {
        encounterLockRef.current = true;
        onEncounter(spawn.instanceId, spawn.monsterId);
        break;
      }
    }
  }, [pos, clearedInstanceIds, onEncounter]);

  // 던전 입구(포탈) 충돌 판정 — 몬스터와 별개로, 퀘스트 완료 여부에 따라 잠김/열림이 갈린다
  useEffect(() => {
    for (const portal of DUNGEON_PORTALS) {
      const overlap =
        pos.x < portal.x + portal.size &&
        pos.x + PLAYER_SIZE > portal.x &&
        pos.y < portal.y + portal.size &&
        pos.y + PLAYER_SIZE > portal.y;

      if (!overlap) {
        portalLockRefs.current.set(portal.instanceId, false);
        continue;
      }
      if (portalLockRefs.current.get(portal.instanceId)) continue;
      portalLockRefs.current.set(portal.instanceId, true);

      if (!questsComplete) {
        onPortalLocked();
      } else if (!encounterLockRef.current) {
        encounterLockRef.current = true;
        onEncounter(portal.instanceId, portal.monsterId);
      }
    }
  }, [pos, questsComplete, onEncounter, onPortalLocked]);

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

        {DUNGEON_PORTALS.map((portal) => (
          <div
            key={portal.instanceId}
            className={`dungeon-portal${questsComplete ? " unlocked" : " locked"}`}
            style={{
              left: portal.x,
              top: portal.y,
              width: portal.size,
              height: portal.size,
            }}
            title={questsComplete ? `던전 입구: ${portal.name}` : "모든 퀘스트를 완료해야 열립니다"}
          >
            <span className="dungeon-portal-icon">{questsComplete ? "🌀" : "🔒"}</span>
          </div>
        ))}

        {MONSTER_SPAWNS.filter((s) => !clearedInstanceIds.includes(s.instanceId)).map((spawn) => (
          <div
            key={spawn.instanceId}
            className="overworld-entity"
            style={{ left: spawn.x, top: spawn.y }}
          >
            <MonsterSprite kind={spawn.monsterId} scale={3.2} />
          </div>
        ))}

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
        방향키 또는 WASD로 이동 · 몬스터에게 다가가면 전투가 시작됩니다 · 퀘스트를 모두 완료하면 던전 입구 2곳(숲의 수호자/얼음 망령)이 열립니다
        {multiplayerActive && " · 같은 몬스터에 다가간 친구와는 함께 싸웁니다"}
      </div>
    </div>
  );
}
