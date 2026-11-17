import { useState } from "react";
import { getJob } from "../data/jobs";
import { getEquipment } from "../data/equipment";
import { computeStats } from "../combat/growth";
import type { MultiplayerJoinInput } from "./CharacterCreateScreen";
import type { AccountPayload } from "../multiplayer/accountApi";
import type { AccountSession, PlayerCharacter } from "../types";
import { GuildPanel } from "./GuildPanel";

interface Props {
  account: AccountPayload;
  session: AccountSession;
  defaultServerUrl: string;
  onStart: (character: PlayerCharacter, multiplayer: MultiplayerJoinInput | null) => void;
  onLogout: () => void;
  onGuildChanged: (guildId: string | null) => void;
}

function randomRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export function ResumeScreen({ account, session, defaultServerUrl, onStart, onLogout, onGuildChanged }: Props) {
  const [coopEnabled, setCoopEnabled] = useState(false);
  const [serverUrl, setServerUrl] = useState(defaultServerUrl);
  const [room, setRoom] = useState(() => randomRoomCode());

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
  };
  const stats = computeStats(character);
  character.hp = typeof saved.hp === "number" ? Math.min(saved.hp, stats.maxHp) : stats.maxHp;

  const weapon = getEquipment(saved.equipment?.weaponId);
  const armor = getEquipment(saved.equipment?.armorId);

  function handleStart() {
    const multiplayer =
      coopEnabled && serverUrl.trim() ? { serverUrl: serverUrl.trim(), room: room.trim().toUpperCase() } : null;
    onStart(character, multiplayer);
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
        <label className="coop-toggle">
          <input type="checkbox" checked={coopEnabled} onChange={(e: any) => setCoopEnabled(e.target.checked)} />
          친구와 함께 플레이 (같은 서버 주소 + 방 코드를 공유하면 같은 오버월드에서 만납니다)
        </label>
        {coopEnabled && (
          <div className="coop-fields">
            <input
              className="name-input"
              placeholder="서버 주소"
              value={serverUrl}
              onChange={(e: any) => setServerUrl(e.target.value)}
            />
            <div className="coop-room-row">
              <input
                className="name-input mono"
                placeholder="방 코드"
                value={room}
                maxLength={8}
                onChange={(e: any) => setRoom(e.target.value.toUpperCase())}
              />
              <button type="button" className="btn-secondary" onClick={() => setRoom(randomRoomCode())}>
                코드 새로 만들기
              </button>
            </div>
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
