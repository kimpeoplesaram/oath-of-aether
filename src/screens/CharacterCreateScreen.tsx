import { useState } from "react";
import { JOBS } from "../data/jobs";
import { STARTER_GOLD, STARTER_INVENTORY } from "../data/items";
import { DEFAULT_SERVER_URL, randomRoomCode } from "../multiplayer/config";
import type { JobId, PlayerCharacter } from "../types";

export interface MultiplayerJoinInput {
  serverUrl: string;
  room: string;
}

interface Props {
  onCreate: (character: PlayerCharacter, multiplayer: MultiplayerJoinInput | null) => void;
}

type CoopMode = "off" | "host" | "join";

export function CharacterCreateScreen({ onCreate }: Props) {
  const [name, setName] = useState("");
  const [jobId, setJobId] = useState<JobId>(JOBS[0].id);
  const [coopMode, setCoopMode] = useState<CoopMode>("off");
  const [hostRoom, setHostRoom] = useState(() => randomRoomCode());
  const [joinRoom, setJoinRoom] = useState("");

  const selectedJob = JOBS.find((j) => j.id === jobId)!;
  const canSubmit = name.trim().length > 0 && (coopMode !== "join" || joinRoom.trim().length > 0);

  function handleSubmit() {
    if (!canSubmit) return;
    const character: PlayerCharacter = {
      name: name.trim(),
      job: selectedJob,
      level: 1,
      xp: 0,
      hp: selectedJob.baseHp,
      equipment: {},
      inventory: { ...STARTER_INVENTORY },
      gold: STARTER_GOLD,
    };
    const multiplayer =
      coopMode === "host"
        ? { serverUrl: DEFAULT_SERVER_URL, room: hostRoom }
        : coopMode === "join" && joinRoom.trim()
        ? { serverUrl: DEFAULT_SERVER_URL, room: joinRoom.trim().toUpperCase() }
        : null;
    onCreate(character, multiplayer);
  }

  return (
    <div className="panel">
      <h2 className="title-font">모험가 생성</h2>

      <input
        className="name-input"
        placeholder="모험가의 이름을 입력하세요"
        value={name}
        maxLength={12}
        onChange={(e: any) => setName(e.target.value)}
      />

      <div className="job-grid">
        {JOBS.map((job) => (
          <button
            key={job.id}
            type="button"
            className={`job-card${job.id === jobId ? " selected" : ""}`}
            onClick={() => setJobId(job.id)}
          >
            <div className="job-icon">{job.icon}</div>
            <h3>{job.name}</h3>
            <p>{job.tagline}</p>
          </button>
        ))}
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
            <p className="coop-hint">이 코드를 친구에게 알려주세요. 서버 주소는 신경 쓰지 않아도 됩니다.</p>
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

      <div className="row-actions">
        <span className="combatant-sub">
          선택한 직업: <strong style={{ color: "var(--accent-gold)" }}>{selectedJob.name}</strong>{" "}
          · HP {selectedJob.baseHp} · 공격력 {selectedJob.baseAtk}
        </span>
        <button className="btn-primary" disabled={!canSubmit} onClick={handleSubmit}>
          모험 떠나기
        </button>
      </div>
    </div>
  );
}
