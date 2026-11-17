import type { JobId, Quest } from "../types";

// 초반(1차 구현 범위) 퀘스트 체인. 직업마다 전투 스타일에 어울리는 순서/서사로
// 구성하되, 아직 초반에 등장하는 몬스터가 슬라임/고블린 둘뿐이라 대상 몬스터
// 자체는 공유한다. 보스(던전)는 직업과 무관하게 모두 함께 도전한다.
export const JOB_QUESTS: Record<JobId, Quest[]> = {
  warrior: [
    {
      id: "warrior_q1",
      title: "실전 감각 익히기",
      description: "고블린 약탈자와 정면으로 맞붙어 검술 감각을 되찾아라.",
      targetMonsterId: "goblin_raider",
      targetCount: 3,
      rewardXp: 50,
    },
    {
      id: "warrior_q2",
      title: "숲 정찰",
      description: "숲에 숨어든 슬라임을 처치해 주변을 정찰하라.",
      targetMonsterId: "forest_slime",
      targetCount: 2,
      rewardXp: 60,
    },
  ],
  priest: [
    {
      id: "priest_q1",
      title: "순찰과 치유",
      description: "비교적 안전한 슬라임을 처치하며 전투 중 아군을 돕는 법을 익혀라.",
      targetMonsterId: "forest_slime",
      targetCount: 3,
      rewardXp: 50,
    },
    {
      id: "priest_q2",
      title: "고블린 퇴치 지원",
      description: "고블린 약탈자를 처치해 마을 수비를 지원하라.",
      targetMonsterId: "goblin_raider",
      targetCount: 2,
      rewardXp: 60,
    },
  ],
  mage: [
    {
      id: "mage_q1",
      title: "광역 주문 연습",
      description: "무리 지어 다니는 슬라임을 상대로 주문 운용을 연습하라.",
      targetMonsterId: "forest_slime",
      targetCount: 3,
      rewardXp: 55,
    },
    {
      id: "mage_q2",
      title: "고블린 소탕",
      description: "마을을 위협하는 고블린 약탈자를 소탕하라.",
      targetMonsterId: "goblin_raider",
      targetCount: 2,
      rewardXp: 65,
    },
  ],
  archer: [
    {
      id: "archer_q1",
      title: "원거리 견제",
      description: "접근하기 전에 고블린 약탈자를 원거리에서 저격하라.",
      targetMonsterId: "goblin_raider",
      targetCount: 3,
      rewardXp: 55,
    },
    {
      id: "archer_q2",
      title: "숲 정찰",
      description: "느리게 움직이는 슬라임으로 조준 연습을 마무리하라.",
      targetMonsterId: "forest_slime",
      targetCount: 2,
      rewardXp: 60,
    },
  ],
  rogue: [
    {
      id: "rogue_q1",
      title: "기습 훈련",
      description: "고블린 약탈자의 허점을 노려 기습하는 법을 익혀라.",
      targetMonsterId: "goblin_raider",
      targetCount: 3,
      rewardXp: 55,
    },
    {
      id: "rogue_q2",
      title: "은신 이동",
      description: "들키지 않고 슬라임에게 접근해 처치하라.",
      targetMonsterId: "forest_slime",
      targetCount: 2,
      rewardXp: 60,
    },
  ],
  bard: [
    {
      id: "bard_q1",
      title: "합주 연습",
      description: "슬라임을 상대로 파티 지원 연주 타이밍을 연습하라.",
      targetMonsterId: "forest_slime",
      targetCount: 3,
      rewardXp: 50,
    },
    {
      id: "bard_q2",
      title: "행군가",
      description: "고블린 약탈자를 처치하며 사기를 북돋는 연주를 완성하라.",
      targetMonsterId: "goblin_raider",
      targetCount: 2,
      rewardXp: 60,
    },
  ],
};
