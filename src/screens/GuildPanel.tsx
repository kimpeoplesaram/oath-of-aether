import { useEffect, useRef, useState } from "react";
import {
  ApiError,
  createGuild,
  getGuildMembers,
  joinGuild,
  leaveGuild,
  listGuildChat,
  listGuilds,
  sendGuildChat,
  setGuildNotice,
  type GuildChatMessage,
  type GuildMember,
  type GuildSummary,
} from "../multiplayer/accountApi";
import { JOBS } from "../data/jobs";

const GUILD_CHAT_POLL_MS = 3000;

interface Props {
  apiBaseUrl: string;
  token: string;
  selfUsername: string;
  guildId: string | null;
  onGuildChanged: (guildId: string | null) => void;
}

/** 로그인한 계정 전용 길드 패널: 생성/가입/목록/길드원 표시. */
export function GuildPanel({ apiBaseUrl, token, selfUsername, guildId, onGuildChanged }: Props) {
  const [busy, setBusy] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 길드에 가입되어 있지 않을 때: 목록 + 생성
  const [guilds, setGuilds] = useState<GuildSummary[]>([]);
  const [newGuildName, setNewGuildName] = useState("");

  // 길드에 가입되어 있을 때: 길드원 목록 + 채팅 + 공지
  const [guildName, setGuildName] = useState<string>("");
  const [members, setMembers] = useState<GuildMember[]>([]);
  const [chat, setChat] = useState<GuildChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const chatLogRef = useRef<HTMLDivElement | null>(null);
  const [notice, setNotice] = useState("");
  const [editingNotice, setEditingNotice] = useState(false);
  const [noticeDraft, setNoticeDraft] = useState("");

  useEffect(() => {
    setError(null);
    if (guildId) {
      refreshMembers(guildId);
      refreshChat(guildId);
    } else {
      refreshGuildList();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId]);

  // 길드 채팅은 접속 중이 아닌 길드원과도 주고받을 수 있도록 REST 폴링 방식으로 동작한다.
  useEffect(() => {
    if (!guildId) return;
    const timer = setInterval(() => refreshChat(guildId), GUILD_CHAT_POLL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId]);

  useEffect(() => {
    if (chatLogRef.current) chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
  }, [chat]);

  async function refreshChat(id: string) {
    try {
      const { chat } = await listGuildChat(apiBaseUrl, id);
      setChat(chat);
    } catch {
      // 폴링 실패는 조용히 무시 (다음 주기에 재시도)
    }
  }

  async function submitChat() {
    const text = chatInput.trim();
    if (!text || !guildId) return;
    setChatInput("");
    try {
      const { chat } = await sendGuildChat(apiBaseUrl, token, text);
      setChat(chat);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "채팅 전송에 실패했습니다.");
    }
  }

  async function refreshGuildList() {
    try {
      const { guilds } = await listGuilds(apiBaseUrl);
      setGuilds(guilds);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "길드 목록을 불러오지 못했습니다.");
    }
  }

  async function refreshMembers(id: string) {
    try {
      const { guild, members } = await getGuildMembers(apiBaseUrl, id);
      setGuildName(guild.name);
      setMembers(members);
      setNotice(guild.notice || "");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "길드 정보를 불러오지 못했습니다.");
    }
  }

  async function handleSaveNotice() {
    setBusy(true);
    setError(null);
    try {
      const { guild } = await setGuildNotice(apiBaseUrl, token, noticeDraft);
      setNotice(guild.notice || "");
      setEditingNotice(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "공지 저장에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate() {
    const name = newGuildName.trim();
    if (!name) return;
    setBusy(true);
    setError(null);
    try {
      const { guild } = await createGuild(apiBaseUrl, token, name);
      setNewGuildName("");
      onGuildChanged(guild.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "길드 생성에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin(id: string) {
    setBusy(true);
    setJoiningId(id);
    setError(null);
    try {
      const { guild } = await joinGuild(apiBaseUrl, token, id);
      onGuildChanged(guild.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "길드 가입에 실패했습니다.");
    } finally {
      setBusy(false);
      setJoiningId(null);
    }
  }

  async function handleLeave() {
    setBusy(true);
    setError(null);
    try {
      await leaveGuild(apiBaseUrl, token);
      onGuildChanged(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "길드 탈퇴에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="guild-panel">
      <h3 className="title-font" style={{ fontSize: "1.1rem", margin: "0 0 8px" }}>
        🛡️ 길드
      </h3>

      {error && <p className="login-error">{error}</p>}

      {guildId ? (
        <>
          <p className="combatant-sub" style={{ margin: "0 0 6px" }}>
            {guildName}
          </p>

          {(() => {
            const isOwner = members.some((m) => m.username === selfUsername && m.isOwner);
            if (editingNotice) {
              return (
                <div className="guild-notice-edit">
                  <input
                    className="name-input"
                    placeholder="길드 공지 (최대 200자)"
                    value={noticeDraft}
                    maxLength={200}
                    onChange={(e: any) => setNoticeDraft(e.target.value)}
                  />
                  <div className="row-actions" style={{ marginTop: 6 }}>
                    <button className="btn-secondary small" disabled={busy} onClick={() => setEditingNotice(false)}>
                      취소
                    </button>
                    <button className="btn-primary small" disabled={busy} onClick={handleSaveNotice}>
                      {busy ? "저장 중..." : "공지 저장"}
                    </button>
                  </div>
                </div>
              );
            }
            return (
              <div className="guild-notice">
                <span className="guild-notice-text">📢 {notice || "등록된 공지가 없습니다."}</span>
                {isOwner && (
                  <button
                    className="btn-secondary tiny"
                    onClick={() => {
                      setNoticeDraft(notice);
                      setEditingNotice(true);
                    }}
                  >
                    공지 수정
                  </button>
                )}
              </div>
            );
          })()}

          <div className="guild-member-list">
            {members.map((m) => (
              <div key={m.username} className="guild-member-row">
                <span>
                  {m.isOwner && "👑 "}
                  {JOBS.find((j) => j.id === m.jobId)?.icon ?? ""} {m.name} ({m.username})
                </span>
                <span>Lv.{m.level}</span>
              </div>
            ))}
          </div>

          <div className="party-chat guild-chat">
            <div className="party-chat-log" ref={chatLogRef}>
              {chat.length === 0 ? (
                <p className="login-hint">아직 길드 채팅이 없습니다.</p>
              ) : (
                chat.map((c) => (
                  <div key={c.id} className="party-chat-line">
                    <strong>{c.name}</strong>: {c.text}
                  </div>
                ))
              )}
            </div>
            <div className="party-chat-input-row">
              <input
                className="party-chat-input"
                value={chatInput}
                placeholder="길드 채팅... (접속 중이 아니어도 전달됩니다)"
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

          <button className="btn-secondary small party-leave-btn" disabled={busy} onClick={handleLeave}>
            {busy ? "처리 중..." : "길드 탈퇴"}
          </button>
        </>
      ) : (
        <>
          <div className="guild-create-row">
            <input
              className="name-input"
              placeholder="새 길드 이름 (2~20자)"
              value={newGuildName}
              maxLength={20}
              onChange={(e: any) => setNewGuildName(e.target.value)}
            />
            <button className="btn-primary small" disabled={busy || !newGuildName.trim()} onClick={handleCreate}>
              {busy && !joiningId ? "생성 중..." : "길드 생성"}
            </button>
          </div>

          <div className="guild-list">
            {guilds.length === 0 ? (
              <p className="login-hint">아직 생성된 길드가 없습니다. 첫 길드를 만들어보세요.</p>
            ) : (
              guilds.map((g) => (
                <div key={g.id} className="guild-row">
                  <span>
                    {g.name} <span className="combatant-sub">· {g.memberCount}명 · 길드장 {g.ownerUsername}</span>
                  </span>
                  <button className="btn-secondary small" disabled={busy} onClick={() => handleJoin(g.id)}>
                    {joiningId === g.id ? "가입 중..." : "가입"}
                  </button>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
