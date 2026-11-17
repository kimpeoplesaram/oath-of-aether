import type { MonsterId } from "../types";

export const MAP_WIDTH = 720;
export const MAP_HEIGHT = 420;
export const PLAYER_SPEED = 160; // px/sec
export const PLAYER_SIZE = 56; // 충돌 판정용 대략 크기 (스프라이트보다 살짝 작게)
export const MONSTER_SIZE = 56;

export interface MonsterSpawn {
  instanceId: string;
  monsterId: MonsterId;
  x: number;
  y: number;
}

export const MONSTER_SPAWNS: MonsterSpawn[] = [
  { instanceId: "enc_slime_1", monsterId: "forest_slime", x: 520, y: 120 },
  { instanceId: "enc_slime_2", monsterId: "forest_slime", x: 160, y: 300 },
  { instanceId: "enc_goblin_1", monsterId: "goblin_raider", x: 420, y: 320 },
  { instanceId: "enc_goblin_2", monsterId: "goblin_raider", x: 620, y: 260 },
];

export interface DungeonPortal {
  instanceId: string;
  monsterId: MonsterId;
  name: string;
  x: number;
  y: number;
  size: number;
}

// 퀘스트를 모두 완료해야 열리는 던전 입구들. 보스는 반복 도전 가능하도록
// clearedInstanceIds로 지우지 않고 항상 표시한다.
export const DUNGEON_PORTALS: DungeonPortal[] = [
  { instanceId: "dungeon_boss", monsterId: "forest_guardian", name: "숲의 수호자", x: 40, y: 200, size: 64 },
  { instanceId: "dungeon_boss_ice", monsterId: "ice_wraith", name: "얼음 망령", x: 650, y: 340, size: 64 },
];

export interface Decoration {
  x: number;
  y: number;
  size: number;
}

// 그냥 분위기용 나무 장식 (충돌 없음)
export const TREE_DECORATIONS: Decoration[] = [
  { x: 40, y: 40, size: 48 },
  { x: 660, y: 50, size: 56 },
  { x: 40, y: 360, size: 52 },
  { x: 300, y: 60, size: 40 },
  { x: 260, y: 220, size: 44 },
  { x: 540, y: 200, size: 40 },
];
