// 《에테르의 서약》 멀티플레이 서버
//
// 1차: 오버월드 위치 동기화 (방 코드 기반, 계정 불필요)
// 2차: 협동 전투(인카운터) 동기화 — 같은 몬스터를 여러 명이 함께 공격.
//   서버가 몬스터 HP / 공격 대상(탱커 어그로) / 파티 버프를 authoritative하게
//   관리하고, 참가자 전원에게 같은 상태를 중계한다.
// 3차: 파티(리더/초대/상시 HUD/채팅) — 방 안에서 계정과 무관하게 동작.
// 4차: 계정(회원가입/로그인/캐릭터 저장)과 길드 — HTTP REST API, 파일 기반 영속 저장.
//   방/파티/전투는 여전히 계정 없이도(게스트) 그대로 동작한다.
//
// 배포: Render/Railway 같은 Node 호스팅에 그대로 올리면 된다.
// 시작 명령: node server/index.js  (PORT 환경변수를 사용, 없으면 8787)

import { WebSocketServer } from "ws";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { MONSTERS } from "./monsterData.js";
import { getDB, persist } from "./db.js";
import { hashPassword, newToken, verifyPassword } from "./auth.js";

const PORT = process.env.PORT || 8787;
const MAX_PLAYERS_PER_ROOM = 6; // 기획서상 최대 6인 협동 목표
const TAUNT_DURATION_MS = 8000;
const ENCOUNTER_TICK_MS = 100;

// src/data/jobs.ts 의 JobId 와 반드시 동일하게 유지할 것.
const VALID_JOB_IDS = new Set(["warrior", "priest", "mage", "archer", "rogue", "bard"]);

const db = getDB();
/** @type {Map<string, string>} token -> username (서버 재시작 시 db.accounts에서 재구성) */
const tokenToUsername = new Map();
for (const [username, acc] of Object.entries(db.accounts)) {
  if (acc.token) tokenToUsername.set(acc.token, username);
}

function accountByToken(token) {
  const username = tokenToUsername.get(token);
  if (!username) return null;
  return db.accounts[username] || null;
}

function publicCharacter(acc) {
  if (!acc.character) return null;
  return { ...acc.character };
}

function publicAccount(acc) {
  return { username: acc.username, character: publicCharacter(acc), guildId: acc.guildId ?? null };
}

// --- 길드 ---
const MAX_GUILD_MEMBERS = 50;

function publicGuild(guild) {
  return {
    id: guild.id,
    name: guild.name,
    ownerUsername: guild.ownerUsername,
    memberUsernames: [...guild.memberUsernames],
    notice: guild.notice || "",
  };
}

function guildMembersDetail(guild) {
  return guild.memberUsernames.map((u) => {
    const acc = db.accounts[u];
    return {
      username: u,
      name: acc?.character?.name ?? u,
      jobId: acc?.character?.jobId ?? null,
      level: acc?.character?.level ?? 1,
      isOwner: u === guild.ownerUsername,
    };
  });
}

const MAX_GUILD_CHAT = 100;

function guildChatPublic(guild) {
  return (guild.chat || []).map((m) => ({ id: m.id, username: m.username, name: m.name, text: m.text, ts: m.ts }));
}

function validGuildName(n) {
  return typeof n === "string" && n.trim().length >= 2 && n.trim().length <= 20;
}

/** @type {Map<string, Map<string, PlayerState>>} roomCode -> (playerId -> state) */
const rooms = new Map();
/** @type {Map<string, string>} roomCode -> 방을 가장 먼저 만든(또는 방장이 나간 뒤 이어받은) playerId */
const roomHost = new Map();
/** @type {Map<import('ws').WebSocket, { room: string, id: string, name: string, jobId: string }>} */
const socketMeta = new Map();
/** @type {Map<string, EncounterState>} key = `${room}::${instanceId}` */
const encounters = new Map();

// --- 파티 시스템 ---
// 파티는 같은 방(room) 안에서만 존재한다. 계정 시스템과 무관하게 동작한다.
/** @type {Map<string, { id: string, room: string, leaderId: string, memberIds: Set<string> }>} */
const parties = new Map();
/** @type {Map<string, string>} playerId -> partyId */
const playerParty = new Map();
/** @type {Map<string, { fromId: string, partyId: string, expiresAt: number }>} targetPlayerId -> 초대 정보 */
const pendingInvites = new Map();
const PARTY_INVITE_TTL_MS = 60000;
const MAX_PARTY_SIZE = MAX_PLAYERS_PER_ROOM;

function getRoom(code) {
  if (!rooms.has(code)) rooms.set(code, new Map());
  return rooms.get(code);
}

function encounterKey(room, instanceId) {
  return `${room}::${instanceId}`;
}

// 보스는 체력이 30% 이하로 떨어지면 분노해서 공격 주기가 짧아진다 (클라이언트의
// 솔로 전투와 동일한 규칙). enc.monsterHp/enc.monsterMaxHp 기준으로 판단한다.
function isEncounterEnraged(enc) {
  const def = MONSTERS[enc.monsterId];
  return !!def?.isBoss && enc.monsterHp > 0 && enc.monsterHp / enc.monsterMaxHp <= 0.3;
}

function nextAttackDelay(enc) {
  const def = MONSTERS[enc.monsterId];
  const base = def.attackIntervalMs;
  return isEncounterEnraged(enc) ? Math.round(base * 0.55) : base;
}

function socketsInRoom(code) {
  return Array.from(socketMeta.entries()).filter(([, meta]) => meta.room === code);
}

function broadcastRoomState(code) {
  const room = rooms.get(code);
  if (!room) return;
  const players = Array.from(room.entries()).map(([id, state]) => ({ id, ...state }));
  const payload = JSON.stringify({ type: "state", room: code, players, hostId: roomHost.get(code) ?? null });
  for (const [sock, meta] of socketsInRoom(code)) {
    if (sock.readyState === sock.OPEN) sock.send(payload);
  }
}

function broadcastToRoom(code, obj) {
  const payload = JSON.stringify(obj);
  for (const [sock] of socketsInRoom(code)) {
    if (sock.readyState === sock.OPEN) sock.send(payload);
  }
}

function broadcastEncounter(key) {
  const enc = encounters.get(key);
  if (!enc) return;
  const participants = Array.from(enc.participants.entries()).map(([id, p]) => ({ id, ...p }));
  const payload = {
    type: "encounter_state",
    instanceId: enc.instanceId,
    monsterId: enc.monsterId,
    monsterHp: enc.monsterHp,
    monsterMaxHp: enc.monsterMaxHp,
    participants,
    pendingAttack: enc.pendingAttack
      ? {
          targetId: enc.pendingAttack.targetId,
          telegraphText: enc.pendingAttack.attack.telegraphText,
          dodgePhrase: enc.pendingAttack.attack.dodgePhrase,
          windupMs: enc.pendingAttack.attack.windupMs,
          deadlineAt: enc.pendingAttack.deadlineAt,
        }
      : null,
    partyBuffUntil: enc.partyBuffUntil,
    monsterDebuffUntil: enc.monsterDebuffUntil,
    // pendingAttack이 아직 없을 때, 클라이언트가 "N초 뒤 공격!" 같은 예고 표시를
    // 미리 보여줄 수 있도록 다음 공격 예정 시각도 함께 보낸다.
    nextAttackAt: enc.pendingAttack ? null : enc.nextAttackAt,
    isEnraged: isEncounterEnraged(enc),
  };
  const json = JSON.stringify(payload);
  for (const id of enc.participants.keys()) {
    const sock = findSocketByPlayerId(enc.room, id);
    if (sock && sock.readyState === sock.OPEN) sock.send(json);
  }
}

function findSocketByPlayerId(room, id) {
  for (const [sock, meta] of socketMeta) {
    if (meta.room === room && meta.id === id) return sock;
  }
  return null;
}

function send(ws, obj) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
}

function sendToPlayer(room, playerId, obj) {
  const sock = findSocketByPlayerId(room, playerId);
  if (sock) send(sock, obj);
}

function partyMembersPayload(party) {
  return Array.from(party.memberIds).map((id) => {
    const meta = findMetaByPlayerId(party.room, id);
    return { id, name: meta?.name ?? "?", jobId: meta?.jobId ?? "warrior" };
  });
}

function findMetaByPlayerId(room, id) {
  for (const [, meta] of socketMeta) {
    if (meta.room === room && meta.id === id) return meta;
  }
  return null;
}

function broadcastParty(partyId) {
  const party = parties.get(partyId);
  if (!party) return;
  const payload = {
    type: "party_state",
    partyId: party.id,
    leaderId: party.leaderId,
    members: partyMembersPayload(party),
  };
  for (const id of party.memberIds) sendToPlayer(party.room, id, payload);
}

/** 플레이어를 현재 파티에서 제거하고, 필요하면 리더를 승계하거나 파티를 해체한다. */
function removeFromParty(playerId) {
  const partyId = playerParty.get(playerId);
  if (!partyId) return;
  const party = parties.get(partyId);
  playerParty.delete(playerId);
  if (!party) return;

  party.memberIds.delete(playerId);
  sendToPlayer(party.room, playerId, { type: "party_state", partyId: null, leaderId: null, members: [] });

  if (party.memberIds.size === 0) {
    parties.delete(partyId);
    return;
  }
  if (party.leaderId === playerId) {
    party.leaderId = Array.from(party.memberIds)[0];
  }
  broadcastParty(partyId);
}

function clearExpiredInvite(targetId) {
  const invite = pendingInvites.get(targetId);
  if (invite && invite.expiresAt < Date.now()) {
    pendingInvites.delete(targetId);
    return null;
  }
  return invite ?? null;
}

function endEncounter(key, result) {
  const enc = encounters.get(key);
  if (!enc) return;
  const participants = Array.from(enc.participants.entries()).map(([id, p]) => ({
    id,
    hp: p.hp,
    maxHp: p.maxHp,
  }));
  const json = JSON.stringify({ type: "encounter_ended", instanceId: enc.instanceId, result, participants });
  for (const id of enc.participants.keys()) {
    const sock = findSocketByPlayerId(enc.room, id);
    if (sock && sock.readyState === sock.OPEN) sock.send(json);
  }
  if (result === "victory") {
    broadcastToRoom(enc.room, { type: "monster_cleared", instanceId: enc.instanceId });
  }
  encounters.delete(key);
}

// 전투 틱: 모든 진행 중 인카운터의 공격 타이머를 일괄 처리
setInterval(() => {
  const now = Date.now();
  for (const [key, enc] of encounters) {
    if (enc.participants.size === 0) {
      encounters.delete(key);
      continue;
    }
    if (!enc.pendingAttack && now >= enc.nextAttackAt) {
      const ids = Array.from(enc.participants.keys());
      let targetId;
      if (enc.priorityTargetId && now < enc.priorityExpiresAt && enc.participants.has(enc.priorityTargetId)) {
        targetId = enc.priorityTargetId;
      } else {
        const weights = ids.map((id) => (enc.participants.get(id).jobId === "warrior" ? 3 : 1));
        const total = weights.reduce((a, b) => a + b, 0);
        let r = Math.random() * total;
        targetId = ids[ids.length - 1];
        for (let i = 0; i < ids.length; i++) {
          if (r < weights[i]) {
            targetId = ids[i];
            break;
          }
          r -= weights[i];
        }
      }
      const monsterDef = MONSTERS[enc.monsterId];
      const attack = monsterDef.attacks[Math.floor(Math.random() * monsterDef.attacks.length)];
      enc.pendingAttack = { targetId, attack, deadlineAt: now + attack.windupMs };
      broadcastEncounter(key);
    } else if (enc.pendingAttack && now >= enc.pendingAttack.deadlineAt) {
      const target = enc.participants.get(enc.pendingAttack.targetId);
      if (target) {
        const debuffActive = now < enc.monsterDebuffUntil;
        const dmg = Math.round(
          enc.pendingAttack.attack.damage * (debuffActive ? 1 - enc.monsterDebuffRatio : 1)
        );
        target.hp = Math.max(0, target.hp - dmg);
      }
      enc.pendingAttack = null;
      enc.nextAttackAt = now + nextAttackDelay(enc);

      const allDown = Array.from(enc.participants.values()).every((p) => p.hp <= 0);
      if (allDown) {
        endEncounter(key, "defeat");
      } else {
        broadcastEncounter(key);
      }
    }
  }
}, ENCOUNTER_TICK_MS);

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error("요청 본문이 너무 큽니다."));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error("잘못된 JSON입니다."));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, obj) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
  });
  res.end(JSON.stringify(obj));
}

function validUsername(u) {
  return typeof u === "string" && /^[a-zA-Z0-9_]{3,20}$/.test(u);
}

async function handleRegister(req, res) {
  const body = await readJsonBody(req);
  const username = String(body.username || "").trim();
  const password = String(body.password || "");
  const name = String(body.name || "").trim().slice(0, 12);
  const jobId = String(body.jobId || "");

  if (!validUsername(username)) {
    return sendJson(res, 400, { error: "아이디는 영문/숫자/밑줄 3~20자여야 합니다." });
  }
  if (password.length < 4) {
    return sendJson(res, 400, { error: "비밀번호는 4자 이상이어야 합니다." });
  }
  if (!name) {
    return sendJson(res, 400, { error: "모험가 이름을 입력하세요." });
  }
  if (!VALID_JOB_IDS.has(jobId)) {
    return sendJson(res, 400, { error: "올바르지 않은 직업입니다." });
  }
  if (db.accounts[username]) {
    return sendJson(res, 409, { error: "이미 사용 중인 아이디입니다." });
  }

  const token = newToken();
  const acc = {
    username,
    passwordHash: hashPassword(password),
    token,
    character: {
      name,
      jobId,
      level: 1,
      xp: 0,
      equipment: {},
      questIndex: 0,
      questKillCount: 0,
      inventory: { potion_hp_small: 3, potion_mp_small: 2 },
      gold: 50,
    },
    guildId: null,
    createdAt: Date.now(),
  };
  db.accounts[username] = acc;
  tokenToUsername.set(token, username);
  persist();

  sendJson(res, 200, { token, account: publicAccount(acc) });
}

async function handleLogin(req, res) {
  const body = await readJsonBody(req);
  const username = String(body.username || "").trim();
  const password = String(body.password || "");

  const acc = db.accounts[username];
  if (!acc || !verifyPassword(password, acc.passwordHash)) {
    return sendJson(res, 401, { error: "아이디 또는 비밀번호가 올바르지 않습니다." });
  }

  if (acc.token) tokenToUsername.delete(acc.token);
  const token = newToken();
  acc.token = token;
  tokenToUsername.set(token, username);
  persist();

  sendJson(res, 200, { token, account: publicAccount(acc) });
}

async function handleLogout(req, res) {
  const body = await readJsonBody(req);
  const acc = accountByToken(String(body.token || ""));
  if (acc) {
    tokenToUsername.delete(acc.token);
    acc.token = null;
    persist();
  }
  sendJson(res, 200, { ok: true });
}

async function handleSaveCharacter(req, res) {
  const body = await readJsonBody(req);
  const acc = accountByToken(String(body.token || ""));
  if (!acc) return sendJson(res, 401, { error: "로그인이 필요합니다." });
  if (!acc.character) return sendJson(res, 400, { error: "캐릭터가 없습니다." });

  const { level, xp, equipment, hp, questIndex, questKillCount, inventory, gold } = body;
  if (typeof level === "number") acc.character.level = level;
  if (typeof xp === "number") acc.character.xp = xp;
  if (equipment && typeof equipment === "object") acc.character.equipment = equipment;
  if (typeof hp === "number") acc.character.hp = hp;
  if (typeof questIndex === "number") acc.character.questIndex = questIndex;
  if (typeof questKillCount === "number") acc.character.questKillCount = questKillCount;
  if (inventory && typeof inventory === "object") acc.character.inventory = inventory;
  if (typeof gold === "number") acc.character.gold = gold;
  persist();

  sendJson(res, 200, { ok: true, character: publicCharacter(acc) });
}

async function handleGuildCreate(req, res) {
  const body = await readJsonBody(req);
  const acc = accountByToken(String(body.token || ""));
  if (!acc) return sendJson(res, 401, { error: "로그인이 필요합니다." });
  if (acc.guildId) return sendJson(res, 400, { error: "이미 길드에 가입되어 있습니다." });

  const name = String(body.name || "").trim().slice(0, 20);
  if (!validGuildName(name)) {
    return sendJson(res, 400, { error: "길드 이름은 2~20자여야 합니다." });
  }
  const dup = Object.values(db.guilds).some((g) => g.name === name);
  if (dup) return sendJson(res, 409, { error: "이미 존재하는 길드 이름입니다." });

  const id = randomUUID();
  const guild = { id, name, ownerUsername: acc.username, memberUsernames: [acc.username] };
  db.guilds[id] = guild;
  acc.guildId = id;
  persist();

  sendJson(res, 200, { guild: publicGuild(guild) });
}

async function handleGuildJoin(req, res) {
  const body = await readJsonBody(req);
  const acc = accountByToken(String(body.token || ""));
  if (!acc) return sendJson(res, 401, { error: "로그인이 필요합니다." });
  if (acc.guildId) return sendJson(res, 400, { error: "이미 길드에 가입되어 있습니다." });

  const guild = db.guilds[String(body.guildId || "")];
  if (!guild) return sendJson(res, 404, { error: "존재하지 않는 길드입니다." });
  if (guild.memberUsernames.length >= MAX_GUILD_MEMBERS) {
    return sendJson(res, 400, { error: "길드 인원이 가득 찼습니다." });
  }

  guild.memberUsernames.push(acc.username);
  acc.guildId = guild.id;
  persist();

  sendJson(res, 200, { guild: publicGuild(guild) });
}

async function handleGuildLeave(req, res) {
  const body = await readJsonBody(req);
  const acc = accountByToken(String(body.token || ""));
  if (!acc) return sendJson(res, 401, { error: "로그인이 필요합니다." });

  const guild = db.guilds[acc.guildId || ""];
  if (!guild) return sendJson(res, 400, { error: "가입된 길드가 없습니다." });

  guild.memberUsernames = guild.memberUsernames.filter((u) => u !== acc.username);
  acc.guildId = null;

  if (guild.memberUsernames.length === 0) {
    delete db.guilds[guild.id];
  } else if (guild.ownerUsername === acc.username) {
    guild.ownerUsername = guild.memberUsernames[0];
  }
  persist();

  sendJson(res, 200, { ok: true });
}

async function handleGuildList(req, res) {
  const list = Object.values(db.guilds).map((g) => ({
    id: g.id,
    name: g.name,
    ownerUsername: g.ownerUsername,
    memberCount: g.memberUsernames.length,
  }));
  sendJson(res, 200, { guilds: list });
}

async function handleGuildMembers(req, res, guildId) {
  const guild = db.guilds[guildId];
  if (!guild) return sendJson(res, 404, { error: "존재하지 않는 길드입니다." });
  sendJson(res, 200, { guild: publicGuild(guild), members: guildMembersDetail(guild) });
}

async function handleGuildChatSend(req, res) {
  const body = await readJsonBody(req);
  const acc = accountByToken(String(body.token || ""));
  if (!acc) return sendJson(res, 401, { error: "로그인이 필요합니다." });

  const guild = db.guilds[acc.guildId || ""];
  if (!guild) return sendJson(res, 400, { error: "가입된 길드가 없습니다." });

  const text = String(body.text || "").trim().slice(0, 200);
  if (!text) return sendJson(res, 400, { error: "메시지를 입력하세요." });

  if (!guild.chat) guild.chat = [];
  guild.chat.push({
    id: randomUUID(),
    username: acc.username,
    name: acc.character?.name ?? acc.username,
    text,
    ts: Date.now(),
  });
  if (guild.chat.length > MAX_GUILD_CHAT) guild.chat = guild.chat.slice(-MAX_GUILD_CHAT);
  persist();

  sendJson(res, 200, { chat: guildChatPublic(guild) });
}

async function handleGuildChatList(req, res, guildId) {
  const guild = db.guilds[guildId];
  if (!guild) return sendJson(res, 404, { error: "존재하지 않는 길드입니다." });
  sendJson(res, 200, { chat: guildChatPublic(guild) });
}

async function handleGuildNoticeSet(req, res) {
  const body = await readJsonBody(req);
  const acc = accountByToken(String(body.token || ""));
  if (!acc) return sendJson(res, 401, { error: "로그인이 필요합니다." });

  const guild = db.guilds[acc.guildId || ""];
  if (!guild) return sendJson(res, 400, { error: "가입된 길드가 없습니다." });
  if (guild.ownerUsername !== acc.username) {
    return sendJson(res, 403, { error: "길드장만 공지를 수정할 수 있습니다." });
  }

  guild.notice = String(body.notice || "").trim().slice(0, 200);
  persist();

  sendJson(res, 200, { guild: publicGuild(guild) });
}

const httpServer = createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type",
    });
    res.end();
    return;
  }

  if (url.pathname === "/health") {
    res.writeHead(200, { "content-type": "text/plain", "access-control-allow-origin": "*" });
    res.end("ok");
    return;
  }

  if (req.method === "POST" && url.pathname === "/register") {
    return handleRegister(req, res).catch((err) => sendJson(res, 400, { error: err.message }));
  }
  if (req.method === "POST" && url.pathname === "/login") {
    return handleLogin(req, res).catch((err) => sendJson(res, 400, { error: err.message }));
  }
  if (req.method === "POST" && url.pathname === "/logout") {
    return handleLogout(req, res).catch((err) => sendJson(res, 400, { error: err.message }));
  }
  if (req.method === "POST" && url.pathname === "/character/save") {
    return handleSaveCharacter(req, res).catch((err) => sendJson(res, 400, { error: err.message }));
  }
  if (req.method === "POST" && url.pathname === "/guild/create") {
    return handleGuildCreate(req, res).catch((err) => sendJson(res, 400, { error: err.message }));
  }
  if (req.method === "POST" && url.pathname === "/guild/join") {
    return handleGuildJoin(req, res).catch((err) => sendJson(res, 400, { error: err.message }));
  }
  if (req.method === "POST" && url.pathname === "/guild/leave") {
    return handleGuildLeave(req, res).catch((err) => sendJson(res, 400, { error: err.message }));
  }
  if (req.method === "GET" && url.pathname === "/guild/list") {
    return handleGuildList(req, res).catch((err) => sendJson(res, 400, { error: err.message }));
  }
  if (req.method === "GET" && url.pathname === "/guild/members") {
    const guildId = url.searchParams.get("id") || "";
    return handleGuildMembers(req, res, guildId).catch((err) => sendJson(res, 400, { error: err.message }));
  }
  if (req.method === "POST" && url.pathname === "/guild/chat/send") {
    return handleGuildChatSend(req, res).catch((err) => sendJson(res, 400, { error: err.message }));
  }
  if (req.method === "GET" && url.pathname === "/guild/chat/list") {
    const guildId = url.searchParams.get("id") || "";
    return handleGuildChatList(req, res, guildId).catch((err) => sendJson(res, 400, { error: err.message }));
  }
  if (req.method === "POST" && url.pathname === "/guild/notice") {
    return handleGuildNoticeSet(req, res).catch((err) => sendJson(res, 400, { error: err.message }));
  }

  res.writeHead(200, { "content-type": "text/plain", "access-control-allow-origin": "*" });
  res.end("Oath of Aether multiplayer server");
});

const wss = new WebSocketServer({ server: httpServer });

wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === "join") {
      const code = String(msg.room || "").trim().toUpperCase().slice(0, 8);
      if (!code) return send(ws, { type: "error", message: "방 코드가 필요합니다." });

      const isNewRoom = !rooms.has(code);
      const room = getRoom(code);
      if (room.size >= MAX_PLAYERS_PER_ROOM) {
        return send(ws, { type: "error", message: "방 인원이 가득 찼습니다 (최대 6명)." });
      }

      const id = randomUUID();
      if (isNewRoom) roomHost.set(code, id);
      const name = String(msg.name || "모험가").slice(0, 12);
      const jobId = msg.jobId || "warrior";
      room.set(id, {
        name,
        jobId,
        x: 360,
        y: 210,
        dir: "down",
        moving: false,
        hp: msg.hp ?? 1,
        maxHp: msg.maxHp ?? 1,
        level: msg.level ?? 1,
      });
      socketMeta.set(ws, { room: code, id, name, jobId });
      send(ws, { type: "joined", id, room: code });
      broadcastRoomState(code);
      return;
    }

    const meta = socketMeta.get(ws);
    if (!meta) return; // join 하지 않은 소켓의 메시지는 무시

    if (msg.type === "move") {
      const room = rooms.get(meta.room);
      const state = room && room.get(meta.id);
      if (!state) return;
      state.x = msg.x;
      state.y = msg.y;
      state.dir = msg.dir;
      state.moving = !!msg.moving;
      if (typeof msg.hp === "number") state.hp = msg.hp;
      if (typeof msg.maxHp === "number") state.maxHp = msg.maxHp;
      if (typeof msg.level === "number") state.level = msg.level;
      broadcastRoomState(meta.room);
      return;
    }

    if (msg.type === "encounter_join") {
      const key = encounterKey(meta.room, msg.instanceId);
      let enc = encounters.get(key);
      if (!enc) {
        const monsterDef = MONSTERS[msg.monsterId];
        if (!monsterDef) return;
        enc = {
          room: meta.room,
          instanceId: msg.instanceId,
          monsterId: msg.monsterId,
          monsterHp: monsterDef.hp,
          monsterMaxHp: monsterDef.hp,
          participants: new Map(),
          pendingAttack: null,
          nextAttackAt: Date.now() + monsterDef.attackIntervalMs,
          priorityTargetId: null,
          priorityExpiresAt: 0,
          partyBuffUntil: 0,
          monsterDebuffUntil: 0,
          monsterDebuffRatio: 0,
        };
        encounters.set(key, enc);
      }
      enc.participants.set(meta.id, {
        name: meta.name,
        jobId: meta.jobId,
        hp: msg.hp,
        maxHp: msg.maxHp,
      });
      broadcastEncounter(key);
      return;
    }

    if (msg.type === "encounter_leave") {
      const key = encounterKey(meta.room, msg.instanceId);
      const enc = encounters.get(key);
      if (!enc) return;
      enc.participants.delete(meta.id);
      if (enc.participants.size === 0) encounters.delete(key);
      else broadcastEncounter(key);
      return;
    }

    if (msg.type === "encounter_action") {
      const key = encounterKey(meta.room, msg.instanceId);
      const enc = encounters.get(key);
      if (!enc) return;

      if (msg.kind === "damage") {
        enc.monsterHp = Math.max(0, enc.monsterHp - (msg.amount || 0));
        if (enc.monsterHp <= 0) {
          endEncounter(key, "victory");
          return;
        }
      } else if (msg.kind === "heal") {
        let lowest = null;
        for (const p of enc.participants.values()) {
          if (p.hp < p.maxHp && (lowest === null || p.hp / p.maxHp < lowest.hp / lowest.maxHp)) {
            lowest = p;
          }
        }
        if (lowest) lowest.hp = Math.min(lowest.maxHp, lowest.hp + (msg.amount || 0));
      } else if (msg.kind === "selfHeal") {
        // 체력 포션처럼 "자기 자신만" 회복시키는 액션 (힐 스킬의 "가장 다친 아군" 대상 선정과 다름).
        const self = enc.participants.get(meta.id);
        if (self) self.hp = Math.min(self.maxHp, self.hp + (msg.amount || 0));
      } else if (msg.kind === "buff") {
        enc.partyBuffUntil = Date.now() + (msg.durationMs || 8000);
      } else if (msg.kind === "taunt") {
        enc.priorityTargetId = meta.id;
        enc.priorityExpiresAt = Date.now() + TAUNT_DURATION_MS;
      } else if (msg.kind === "debuff") {
        enc.monsterDebuffUntil = Date.now() + (msg.durationMs || 8000);
        enc.monsterDebuffRatio = msg.amount || 0;
      } else if (msg.kind === "partyHeal") {
        for (const p of enc.participants.values()) {
          p.hp = Math.min(p.maxHp, p.hp + (msg.amount || 0));
        }
      }
      broadcastEncounter(key);
      return;
    }

    if (msg.type === "encounter_dodge_success") {
      const key = encounterKey(meta.room, msg.instanceId);
      const enc = encounters.get(key);
      if (!enc || !enc.pendingAttack || enc.pendingAttack.targetId !== meta.id) return;
      enc.pendingAttack = null;
      enc.nextAttackAt = Date.now() + nextAttackDelay(enc);
      broadcastEncounter(key);
      return;
    }

    if (msg.type === "party_invite") {
      const targetId = String(msg.targetId || "");
      const targetMeta = findMetaByPlayerId(meta.room, targetId);
      if (!targetMeta || targetId === meta.id) return;

      let partyId = playerParty.get(meta.id);
      let party = partyId ? parties.get(partyId) : null;
      if (party && party.leaderId !== meta.id) return; // 리더만 초대 가능
      if (!party) {
        partyId = randomUUID();
        party = { id: partyId, room: meta.room, leaderId: meta.id, memberIds: new Set([meta.id]) };
        parties.set(partyId, party);
        playerParty.set(meta.id, partyId);
      }
      if (party.memberIds.size >= MAX_PARTY_SIZE) {
        return send(ws, { type: "error", message: "파티 인원이 가득 찼습니다 (최대 6명)." });
      }
      pendingInvites.set(targetId, { fromId: meta.id, partyId, expiresAt: Date.now() + PARTY_INVITE_TTL_MS });
      broadcastParty(partyId); // 초대자 본인 화면에도 "파티장" 상태를 즉시 보여준다
      sendToPlayer(meta.room, targetId, {
        type: "party_invite_received",
        fromId: meta.id,
        fromName: meta.name,
      });
      return;
    }

    if (msg.type === "party_invite_respond") {
      const invite = clearExpiredInvite(meta.id);
      if (!invite) return;
      pendingInvites.delete(meta.id);

      if (!msg.accept) {
        sendToPlayer(meta.room, invite.fromId, {
          type: "party_invite_result",
          accepted: false,
          byName: meta.name,
        });
        return;
      }

      const party = parties.get(invite.partyId);
      if (!party || party.room !== meta.room) return;
      if (party.memberIds.size >= MAX_PARTY_SIZE) return;

      // 기존에 다른 파티에 있었다면 먼저 탈퇴
      if (playerParty.get(meta.id) && playerParty.get(meta.id) !== invite.partyId) {
        removeFromParty(meta.id);
      }
      party.memberIds.add(meta.id);
      playerParty.set(meta.id, party.id);
      broadcastParty(party.id);
      return;
    }

    if (msg.type === "party_leave") {
      removeFromParty(meta.id);
      return;
    }

    if (msg.type === "party_kick") {
      const partyId = playerParty.get(meta.id);
      const party = partyId ? parties.get(partyId) : null;
      if (!party || party.leaderId !== meta.id) return;
      const targetId = String(msg.targetId || "");
      if (targetId === meta.id || !party.memberIds.has(targetId)) return;
      removeFromParty(targetId);
      return;
    }

    if (msg.type === "party_chat") {
      const partyId = playerParty.get(meta.id);
      const party = partyId ? parties.get(partyId) : null;
      if (!party) return;
      const text = String(msg.text || "").slice(0, 200);
      if (!text.trim()) return;
      const payload = {
        type: "party_chat",
        fromId: meta.id,
        fromName: meta.name,
        text,
        ts: Date.now(),
      };
      for (const id of party.memberIds) sendToPlayer(meta.room, id, payload);
      return;
    }
  });

  ws.on("close", () => {
    const meta = socketMeta.get(ws);
    if (meta) {
      const room = rooms.get(meta.room);
      if (room) {
        room.delete(meta.id);
        if (room.size === 0) {
          rooms.delete(meta.room);
          roomHost.delete(meta.room);
        } else {
          // 방장이 나갔다면 남은 사람 중 한 명이 새 방장이 된다.
          if (roomHost.get(meta.room) === meta.id) {
            const [nextHostId] = room.keys();
            roomHost.set(meta.room, nextHostId);
          }
          broadcastRoomState(meta.room);
        }
      }
      for (const [key, enc] of encounters) {
        if (enc.room === meta.room && enc.participants.has(meta.id)) {
          enc.participants.delete(meta.id);
          if (enc.participants.size === 0) encounters.delete(key);
          else broadcastEncounter(key);
        }
      }
      removeFromParty(meta.id);
      pendingInvites.delete(meta.id);
      for (const [targetId, invite] of pendingInvites) {
        if (invite.fromId === meta.id) pendingInvites.delete(targetId);
      }
      socketMeta.delete(ws);
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Oath of Aether multiplayer server listening on :${PORT}`);
});
