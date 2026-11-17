import { useEffect, useRef, useState } from "react";
import type { MultiplayerApi, RemotePlayer } from "../multiplayer/useMultiplayer";
import type { PlayerCharacter, PlayerStats } from "../types";

interface Props {
  mp: MultiplayerApi;
  selfPlayer: PlayerCharacter;
  selfStats: PlayerStats;
  remotePlayers: RemotePlayer[];
}

/** 오버월드에서 전투 중이 아닐 때도 항상 보이는 파티 패널: 멤버 목록/체력, 초대, 채팅 */
export function PartyPanel({ mp, selfPlayer, selfStats, remotePlayers }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const chatLogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (chatLogRef.current) chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
  }, [mp.partyChat]);

  useEffect(() => {
    if (!mp.partyNotice) return;
    const t = setTimeout(() => mp.dismissPartyNotice(), 3500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mp.partyNotice]);

  const party = mp.partyState;
  const inParty = !!party;
  const isLeader = !!party && party.leaderId === mp.selfId;

  function resolveLive(id: string) {
    if (id === mp.selfId) {
      return { name: selfPlayer.name, jobId: selfPlayer.job.id, hp: selfPlayer.hp, maxHp: selfStats.maxHp, level: selfPlayer.level };
    }
    const rp = remotePlayers.find((r) => r.id === id);
    return rp ? { name: rp.name, jobId: rp.jobId, hp: rp.hp, maxHp: rp.maxHp, level: rp.level } : null;
  }

  function submitChat() {
    const text = chatInput.trim();
    if (!text) return;
    mp.sendPartyChat(text);
    setChatInput("");
  }

  return (
    <div className={`party-panel${collapsed ? " collapsed" : ""}`}>
      <div className="party-panel-header" onClick={() => setCollapsed((c) => !c)}>
        <span>🧑‍🤝‍🧑 파티 {inParty ? `(${party!.members.length})` : ""}</span>
        <span className="party-panel-toggle">{collapsed ? "▲" : "▼"}</span>
      </div>

      {!collapsed && (
        <div className="party-panel-body">
          {mp.pendingInvite && (
            <div className="party-invite-banner">
              <span>{mp.pendingInvite.fromName}님의 파티 초대</span>
              <div className="party-invite-actions">
                <button className="btn-primary small" onClick={() => mp.respondPartyInvite(true)}>
                  수락
                </button>
                <button className="btn-secondary small" onClick={() => mp.respondPartyInvite(false)}>
                  거절
                </button>
              </div>
            </div>
          )}

          {mp.partyNotice && <div className="party-notice">{mp.partyNotice}</div>}

          {inParty ? (
            <>
              <div className="party-member-list">
                {party!.members.map((m) => {
                  const live = resolveLive(m.id);
                  const hpRatio = live && live.maxHp ? live.hp / live.maxHp : null;
                  return (
                    <div key={m.id} className="party-member-row">
                      <span className="party-member-name">
                        {m.id === party!.leaderId && "👑 "}
                        {m.name}
                        {m.id === mp.selfId && " (나)"}
                      </span>
                      {hpRatio !== null ? (
                        <div className="hp-bar-track small">
                          <div
                            className={`hp-bar-fill${hpRatio < 0.3 ? " danger" : ""}`}
                            style={{ width: `${Math.max(0, hpRatio) * 100}%` }}
                          />
                        </div>
                      ) : (
                        <span className="party-member-hp-unknown">HP 알 수 없음</span>
                      )}
                      {isLeader && m.id !== mp.selfId && (
                        <button className="btn-secondary tiny" onClick={() => mp.kickFromParty(m.id)}>
                          추방
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="party-chat">
                <div className="party-chat-log" ref={chatLogRef}>
                  {mp.partyChat.map((c) => (
                    <div key={c.id} className="party-chat-line">
                      <strong>{c.fromId === mp.selfId ? "나" : c.fromName}</strong>: {c.text}
                    </div>
                  ))}
                </div>
                <div className="party-chat-input-row">
                  <input
                    className="party-chat-input"
                    value={chatInput}
                    placeholder="파티 채팅..."
                    onChange={(e: any) => setChatInput(e.target.value)}
                    onKeyDown={(e: any) => {
                      if (e.key === "Enter") submitChat();
                    }}
                  />
                  <button className="btn-secondary small" onClick={submitChat}>
                    전송
                  </button>
                </div>
              </div>

              <button className="btn-secondary small party-leave-btn" onClick={() => mp.leaveParty()}>
                파티 나가기
              </button>
            </>
          ) : (
            <div className="party-invite-list">
              {remotePlayers.length === 0 ? (
                <p className="party-hint">같은 방에 다른 모험가가 없습니다.</p>
              ) : (
                remotePlayers.map((rp) => (
                  <div key={rp.id} className="party-invite-row">
                    <span>{rp.name}</span>
                    <button className="btn-primary tiny" onClick={() => mp.sendPartyInvite(rp.id)}>
                      파티 초대
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
