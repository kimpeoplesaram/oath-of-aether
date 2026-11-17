import type { Quest } from "../types";

// 1차 구현 범위의 간단한 토벌 퀘스트 체인.
// 이후 던전/스토리 퀘스트로 확장할 때 이 배열에 이어 붙인다.
export const QUESTS: Quest[] = [
  {
    id: "q1_slimes",
    title: "숲 정찰",
    description: "숲의 슬라임을 처치해 주변을 정찰하라.",
    targetMonsterId: "forest_slime",
    targetCount: 2,
    rewardXp: 40,
  },
  {
    id: "q2_goblins",
    title: "고블린 소탕",
    description: "마을을 위협하는 고블린 약탈자를 소탕하라.",
    targetMonsterId: "goblin_raider",
    targetCount: 2,
    rewardXp: 70,
  },
];
