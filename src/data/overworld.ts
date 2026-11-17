import type { MonsterId } from "../types";

export const MAP_WIDTH = 1200;
export const MAP_HEIGHT = 700;
export const PLAYER_SPEED = 220; // px/sec (맵이 넓어진 만큼 이동 속도도 함께 올렸다)
export const PLAYER_SIZE = 56; // 충돌 판정용 대략 크기 (스프라이트보다 살짝 작게)
export const MONSTER_SIZE = 56;
export const MONSTER_WANDER_SPEED = 34; // px/sec, 플레이어보다 훨씬 느리게 배회
export const MONSTER_WANDER_RADIUS = 90; // 홈 지점(스폰 좌표) 기준 배회 반경
export const INTERACT_RANGE = 46; // 이 거리 안에 들어오면 E키로 상호작용 가능
export const MONSTER_RESPAWN_MS = 14000; // 처치 후 다시 나타나기까지 걸리는 시간

export interface MonsterSpawn {
  instanceId: string;
  monsterId: MonsterId;
  x: number;
  y: number;
}

// 각 항목의 (x, y)는 "홈 지점"이다. 실제 화면 위치는 이 지점을 중심으로
// 느리게 배회하며, 처치하면 일정 시간 뒤 같은 홈 지점 주변에 다시 나타난다.
export const MONSTER_SPAWNS: MonsterSpawn[] = [
  { instanceId: "enc_slime_1", monsterId: "forest_slime", x: 860, y: 160 },
  { instanceId: "enc_slime_2", monsterId: "forest_slime", x: 260, y: 480 },
  { instanceId: "enc_slime_3", monsterId: "forest_slime", x: 600, y: 600 },
  { instanceId: "enc_goblin_1", monsterId: "goblin_raider", x: 700, y: 500 },
  { instanceId: "enc_goblin_2", monsterId: "goblin_raider", x: 1000, y: 360 },
  { instanceId: "enc_goblin_3", monsterId: "goblin_raider", x: 380, y: 150 },
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
  { instanceId: "dungeon_boss", monsterId: "forest_guardian", name: "숲의 수호자", x: 50, y: 320, size: 64 },
  { instanceId: "dungeon_boss_ice", monsterId: "ice_wraith", name: "얼음 망령", x: 1090, y: 600, size: 64 },
  { instanceId: "dungeon_boss_lava", monsterId: "lava_golem", name: "용암 골렘", x: 1090, y: 50, size: 64 },
];

export interface Decoration {
  x: number;
  y: number;
  size: number;
}

// 그냥 분위기용 나무 장식 (충돌 없음)
export const TREE_DECORATIONS: Decoration[] = [
  { x: 40, y: 40, size: 48 },
  { x: 1120, y: 40, size: 50 },
  { x: 40, y: 640, size: 52 },
  { x: 1120, y: 660, size: 46 },
  { x: 300, y: 70, size: 40 },
  { x: 520, y: 40, size: 44 },
  { x: 780, y: 60, size: 38 },
  { x: 180, y: 260, size: 44 },
  { x: 460, y: 300, size: 50 },
  { x: 840, y: 280, size: 42 },
  { x: 960, y: 500, size: 46 },
  { x: 220, y: 580, size: 40 },
  { x: 720, y: 640, size: 44 },
  { x: 540, y: 440, size: 38 },
];
