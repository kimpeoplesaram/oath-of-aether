import type { MonsterId } from "../types";

// 맵은 화면(창)보다 훨씬 크다. 플레이어가 움직이면 카메라가 따라가며 맵을 비춘다
// (별도의 스크롤 영역이 아니라, 창 전체가 카메라 뷰포트다).
export const MAP_WIDTH = 2400;
export const MAP_HEIGHT = 1400;
export const PLAYER_SPEED = 260; // px/sec
export const PLAYER_SIZE = 56; // 충돌 판정용 대략 크기 (스프라이트보다 살짝 작게)
export const MONSTER_SIZE = 56;
export const MONSTER_WANDER_SPEED = 34; // px/sec, 플레이어보다 훨씬 느리게 배회
export const MONSTER_WANDER_RADIUS = 100; // 홈 지점(스폰 좌표) 기준 배회 반경
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
  { instanceId: "enc_slime_1", monsterId: "forest_slime", x: 1720, y: 320 },
  { instanceId: "enc_slime_2", monsterId: "forest_slime", x: 520, y: 960 },
  { instanceId: "enc_slime_3", monsterId: "forest_slime", x: 1200, y: 1200 },
  { instanceId: "enc_slime_4", monsterId: "forest_slime", x: 2000, y: 1000 },
  { instanceId: "enc_goblin_1", monsterId: "goblin_raider", x: 1400, y: 1000 },
  { instanceId: "enc_goblin_2", monsterId: "goblin_raider", x: 2000, y: 720 },
  { instanceId: "enc_goblin_3", monsterId: "goblin_raider", x: 760, y: 300 },
  { instanceId: "enc_goblin_4", monsterId: "goblin_raider", x: 320, y: 1100 },
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
  { instanceId: "dungeon_boss", monsterId: "forest_guardian", name: "숲의 수호자", x: 100, y: 640, size: 64 },
  { instanceId: "dungeon_boss_ice", monsterId: "ice_wraith", name: "얼음 망령", x: 2180, y: 1200, size: 64 },
  { instanceId: "dungeon_boss_lava", monsterId: "lava_golem", name: "용암 골렘", x: 2180, y: 100, size: 64 },
];

export interface Decoration {
  x: number;
  y: number;
  size: number;
}

// 그냥 분위기용 나무 장식 (충돌 없음)
export const TREE_DECORATIONS: Decoration[] = [
  { x: 80, y: 80, size: 48 },
  { x: 2240, y: 80, size: 50 },
  { x: 80, y: 1280, size: 52 },
  { x: 2240, y: 1320, size: 46 },
  { x: 600, y: 140, size: 40 },
  { x: 1040, y: 80, size: 44 },
  { x: 1560, y: 120, size: 38 },
  { x: 360, y: 520, size: 44 },
  { x: 920, y: 600, size: 50 },
  { x: 1680, y: 560, size: 42 },
  { x: 1920, y: 1000, size: 46 },
  { x: 440, y: 1160, size: 40 },
  { x: 1440, y: 1280, size: 44 },
  { x: 1080, y: 880, size: 38 },
  { x: 1280, y: 400, size: 42 },
  { x: 2080, y: 440, size: 40 },
  { x: 160, y: 900, size: 44 },
  { x: 1900, y: 300, size: 38 },
];
