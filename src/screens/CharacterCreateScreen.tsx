import { useState } from "react";
import { JOBS } from "../data/jobs";
import type { JobId, PlayerCharacter } from "../types";

export interface MultiplayerJoinInput {
  serverUrl: string;
  room: string;
}

interface Props {
  onCreate: (character: PlayerCharacter, multiplayer: MultiplayerJoinInput | null) => void;
}

function randomRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export function CharacterCreateScreen({ onCreate }: Props) {
  const [name, setName] = useState("");
  const [jobId, setJobId] = useState<JobId>(JOBS[0].id);
  const [coopEnabled, setCoopEnabled] = useState(false);
  const [serverUrl, setServerUrl] = useState("");
  const [room, setRoom] = useState(() => randomRoomCode());

  const selectedJob = JOBS.find((j) => j.id === jobId)!;
  const canSubmit = name.trim().length > 0 && (!coopEnabled || serverUrl.trim().length > 0);

  function handleSubmit() {
    if (!canSubmit) return;
    const character: PlayerCharacter = {
      name: name.trim(),
      job: selectedJob,
      level: 1,
      xp: 0,
      hp: selectedJob.baseHp,
      equipment: {},
    };
    const multiplayer =
      coopEnabled && serverUrl.trim()
        ? { serverUrl: serverUrl.trim(), room: room.trim().toUpperCase() }
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
        <label className="coop-toggle">
          <input
            type="checkbox"
            checked={coopEnabled}
            onChange={(e: any) => setCoopEnabled(e.target.checked)}
          />
          친구와 함께 플레이 (같은 서버 주소 + 방 코드를 공유하면 같은 오버월드에서 만납니다)
        </label>

        {coopEnabled && (
          <div className="coop-fields">
            <input
              className="name-input"
              placeholder="서버 주소 (예: wss://oath-of-aether-server.onrender.com)"
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
            <p className="coop-hint">
              이 서버 주소와 방 코드를 친구에게 그대로 알려주세요. 같은 값을 입력하면 같은 방에
              들어옵니다.
            </p>
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
