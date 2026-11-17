// 계정/길드 REST API 클라이언트. 멀티플레이 서버(server/index.js)와 같은 호스트에 붙는다.
// 서버 주소는 ws:// 또는 wss:// 로 입력받으므로 http(s)로 변환해 호출한다.

import type { JobId } from "../types";

export interface SavedCharacter {
  name: string;
  jobId: JobId;
  level: number;
  xp: number;
  equipment: { weaponId?: string; armorId?: string };
  hp?: number;
}

export interface AccountPayload {
  username: string;
  character: SavedCharacter | null;
  guildId: string | null;
}

export interface GuildSummary {
  id: string;
  name: string;
  ownerUsername: string;
  memberCount: number;
}

export interface GuildInfo {
  id: string;
  name: string;
  ownerUsername: string;
  memberUsernames: string[];
  notice: string;
}

export interface GuildMember {
  username: string;
  name: string;
  jobId: JobId | null;
  level: number;
  isOwner: boolean;
}

export interface GuildChatMessage {
  id: string;
  username: string;
  name: string;
  text: string;
  ts: number;
}

export class ApiError extends Error {}

export function wsUrlToHttp(serverUrl: string): string {
  return serverUrl.replace(/^ws:\/\//, "http://").replace(/^wss:\/\//, "https://").replace(/\/+$/, "");
}

async function request<T>(apiBaseUrl: string, path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${apiBaseUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError("서버에 연결할 수 없습니다. 서버 주소를 확인하세요.");
  }
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    // ignore
  }
  if (!res.ok) {
    throw new ApiError(data?.error || `요청에 실패했습니다. (${res.status})`);
  }
  return data as T;
}

async function requestGet<T>(apiBaseUrl: string, path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${apiBaseUrl}${path}`, { method: "GET" });
  } catch {
    throw new ApiError("서버에 연결할 수 없습니다. 서버 주소를 확인하세요.");
  }
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    // ignore
  }
  if (!res.ok) {
    throw new ApiError(data?.error || `요청에 실패했습니다. (${res.status})`);
  }
  return data as T;
}

export function register(
  apiBaseUrl: string,
  params: { username: string; password: string; name: string; jobId: JobId }
) {
  return request<{ token: string; account: AccountPayload }>(apiBaseUrl, "/register", params);
}

export function login(apiBaseUrl: string, params: { username: string; password: string }) {
  return request<{ token: string; account: AccountPayload }>(apiBaseUrl, "/login", params);
}

export function logout(apiBaseUrl: string, token: string) {
  return request<{ ok: boolean }>(apiBaseUrl, "/logout", { token });
}

export function saveCharacter(
  apiBaseUrl: string,
  token: string,
  data: { level: number; xp: number; equipment: { weaponId?: string; armorId?: string }; hp: number }
) {
  return request<{ ok: boolean; character: SavedCharacter }>(apiBaseUrl, "/character/save", {
    token,
    ...data,
  });
}

export function createGuild(apiBaseUrl: string, token: string, name: string) {
  return request<{ guild: GuildInfo }>(apiBaseUrl, "/guild/create", { token, name });
}

export function joinGuild(apiBaseUrl: string, token: string, guildId: string) {
  return request<{ guild: GuildInfo }>(apiBaseUrl, "/guild/join", { token, guildId });
}

export function leaveGuild(apiBaseUrl: string, token: string) {
  return request<{ ok: boolean }>(apiBaseUrl, "/guild/leave", { token });
}

export function listGuilds(apiBaseUrl: string) {
  return requestGet<{ guilds: GuildSummary[] }>(apiBaseUrl, "/guild/list");
}

export function getGuildMembers(apiBaseUrl: string, guildId: string) {
  return requestGet<{ guild: GuildInfo; members: GuildMember[] }>(
    apiBaseUrl,
    `/guild/members?id=${encodeURIComponent(guildId)}`
  );
}

export function sendGuildChat(apiBaseUrl: string, token: string, text: string) {
  return request<{ chat: GuildChatMessage[] }>(apiBaseUrl, "/guild/chat/send", { token, text });
}

export function listGuildChat(apiBaseUrl: string, guildId: string) {
  return requestGet<{ chat: GuildChatMessage[] }>(
    apiBaseUrl,
    `/guild/chat/list?id=${encodeURIComponent(guildId)}`
  );
}

export function setGuildNotice(apiBaseUrl: string, token: string, notice: string) {
  return request<{ guild: GuildInfo }>(apiBaseUrl, "/guild/notice", { token, notice });
}
