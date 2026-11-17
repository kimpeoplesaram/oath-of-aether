// 아주 단순한 파일 기반 영속 저장소.
// 계정/캐릭터/길드 정보를 server/data.json 에 저장한다.
// (실제 서비스로 키울 때는 진짜 DB로 교체하는 게 좋지만, 1차 구현에서는
//  Node 기본 모듈만으로 "서버를 재시작해도 데이터가 남는다"를 만족시킨다.)

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "data.json");

function emptyDB() {
  return { accounts: {}, guilds: {} };
}

function load() {
  if (!existsSync(DB_PATH)) return emptyDB();
  try {
    const parsed = JSON.parse(readFileSync(DB_PATH, "utf-8"));
    return { accounts: parsed.accounts || {}, guilds: parsed.guilds || {} };
  } catch {
    return emptyDB();
  }
}

const db = load();

let saveTimer = null;
function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
    } catch (err) {
      console.error("DB 저장 실패:", err);
    }
  }, 150);
}

export function getDB() {
  return db;
}

export function persist() {
  scheduleSave();
}
