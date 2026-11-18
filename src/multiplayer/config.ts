// 배포된 공식 멀티플레이 서버 주소. 로컬(localhost)에서 개발 중일 때는 로컬 서버를
// 기본값으로 쓴다. 사용자가 서버 주소를 직접 입력할 필요가 없도록 자동으로 고른다.
const PRODUCTION_SERVER_URL = "wss://oath-of-aether.onrender.com";
const LOCAL_SERVER_URL = "ws://localhost:8787";

export const DEFAULT_SERVER_URL =
  typeof window !== "undefined" && window.location.hostname === "localhost"
    ? LOCAL_SERVER_URL
    : PRODUCTION_SERVER_URL;

export function randomRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}
