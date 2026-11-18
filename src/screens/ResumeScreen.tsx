import { useState } from "react";
import { getJob } from "../data/jobs";
import { getEquipment } from "../data/equipment";
import { STARTER_INVENTORY } from "../data/items";
import { computeStats } from "../combat/growth";
import type { MultiplayerJoinInput } from "./CharacterCreateScreen";
import type { AccountPayload } from "../multiplayer/accountApi";
import { randomRoomCode } from "../multiplayer/config";
import type { AccountSession, PlayerCharacter } from "../types";
import { GuildPanel } from "./GuildPanel";

interface Props {
  account: AccountPayload;
  session: AccountSession;
  defaultServerUrl: string;
  onStart: (
    character: PlayerCharacter,
    multiplayer: MultiplayerJoinInput | null,
    resumeProgress?: { questIndex: number; questKillCount: number }
  ) => void;
  onLogout: () => void;
  onGuildChanged: (guildId: string | null) => void;
}

type CoopMode = "off" | "host" | "join";

export function ResumeScreen({ account, session, defaultServerUrl, onStart, onLogout, onGuildChanged }: Props) {
  const [coopMode, setCoopMode] = useState<CoopMode>("off");
  const [hostRoom, setHostRoom] = useState(() => randomRoomCode());
  const [joinRoom, setJoinRoom] = useState("");

  if (!account.character) {
    return (
      <div className="panel">
        <h2 className="title-font">캐릭터 정보를 불러올 수 없습니다</h2>
        <button className="btn-secondary" onClick={onLogout}>
          로그아웃
        </button>
      </div>
    );
  }

  const saved = account.character;
  const job = getJob(saved.jobId);
  const character: PlayerCharacter = {
    name: saved.name,
    job,
    level: saved.level,
    xp: saved.xp,
    equipment: saved.equipment ?? {},
    hp: 0,
    inventory: saved.inventory ?? { ...STARTER_INVENTORY },
  };
  const stats = computeStats(character);
  character.hp = typeof saved.hp === "number" ? Math.min(saved.hp, stats.maxHp) : stats.maxHp;

  const weapon = getEquipment(saved.equipment?.weaponId);
  const armor = getEquipment(saved.equipment?.armorId);

  function handleStart() {
    const multiplayer =
      coopMode === "host"
        ? { serverUrl: defaultServerUrl, room: hostRoom }
        : coopMode === "join" && joinRoom.trim()
        ? { serverUrl: defaultServerUrl, room: joinRoom.trim().toUpperCase() }
        : null;
    onStart(character, multiplayer, {
      questIndex: saved.questIndex ?? 0,
      questKillCount: saved.questKillCount ?? 0,
    });
  }

  return (
    <div className="panel">
      <h2 className="title-font">환영합니다, {account.username}님</h2>

      <div className="resume-character-card">
        <div className="job-icon" style={{ fontSize: "2.2rem" }}>
          {job.icon}
        </div>
        <div>
          <h3 style={{ margin: "0 0 4px" }}>
            {character.name} <span className="combatant-sub">· {job.name} · Lv.{character.level}</span>
          </h3>
          <p className="combatant-sub" style={{ margin: 0 }}>
            HP {character.hp}/{stats.maxHp} · 공격력 {stats.atk}
          </p>
          <p className="combatant-sub" style={{ margin: "4px 0 0" }}>
            무기: {weapon?.name ?? "없음"} · 방어구: {armor?.name ?? "없음"}
          </p>
        </div>
      </div>

      <div className="coop-panel">
        <div className="coop-mode-row">
          <button
            type="button"
            className={`coop-mode-btn${coopMode === "off" ? " selected" : ""}`}
            onClick={() => setCoopMode("off")}
          >
            혼자 플레이
          </button>
          <button
            type="button"
            className={`coop-mode-btn${coopMode === "host" ? " selected" : ""}`}
            onClick={() => setCoopMode("host")}
          >
            방 만들기
          </button>
          <button
            type="button"
            className={`coop-mode-btn${coopMode === "join" ? " selected" : ""}`}
            onClick={() => setCoopMode("join")}
          >
            친구 방 코드로 참가
          </button>
        </div>

        {coopMode === "host" && (
          <div className="coop-fields">
            <div className="room-code-display">
              <span>내 방 코드</span>
              <strong>{hostRoom}</strong>
              <button type="button" className="btn-secondary" onClick={() => setHostRoom(randomRoomCode())}>
                코드 새로 만들기
              </button>
            </div>
            <p className="coop-hint">이 코드를 친구에게 알려주세요.</p>
          </div>
        )}

        {coopMode === "join" && (
          <div className="coop-fields">
            <input
              className="name-input mono"
              placeholder="친구가 알려준 방 코드"
              value={joinRoom}
              maxLength={8}
              onChange={(e: any) => setJoinRoom(e.target.value.toUpperCase())}
            />
            <p className="coop-hint">친구가 방을 먼저 만든 뒤 알려준 코드를 입력하면 같은 방에 들어갑니다.</p>
          </div>
        )}
      </div>

      <GuildPanel
        apiBaseUrl={session.apiBaseUrl}
        token={session.token}
        selfUsername={session.username}
        guildId={account.guildId}
        onGuildChanged={onGuildChanged}
      />

      <div className="row-actions">
        <button className="btn-secondary" onClick={onLogout}>
          로그아웃
        </button>
        <button className="btn-primary" onClick={handleStart}>
          모험 계속하기
        </button>
      </div>
    </div>
  );
}
