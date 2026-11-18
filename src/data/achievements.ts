// 업적 정의. condition은 몬스터 처치/레벨업 직후 최신 플레이어 상태로 평가된다.

export interface AchievementContext {
  level: number;
  totalKills: number;
  bossDefeatedCount: number;
  gold: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  condition: (ctx: AchievementContext) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "first_kill",
    name: "첫 사냥",
    description: "몬스터를 처음으로 처치한다.",
    icon: "🗡️",
    condition: (c) => c.totalKills >= 1,
  },
  {
    id: "kills_10",
    name: "숙련된 사냥꾼",
    description: "몬스터를 10마리 처치한다.",
    icon: "🏹",
    condition: (c) => c.totalKills >= 10,
  },
  {
    id: "kills_50",
    name: "몬스터 학살자",
    description: "몬스터를 50마리 처치한다.",
    icon: "⚔️",
    condition: (c) => c.totalKills >= 50,
  },
  {
    id: "kills_150",
    name: "재앙",
    description: "몬스터를 150마리 처치한다.",
    icon: "💀",
    condition: (c) => c.totalKills >= 150,
  },
  {
    id: "level_5",
    name: "성장하는 모험가",
    description: "레벨 5에 도달한다.",
    icon: "⭐",
    condition: (c) => c.level >= 5,
  },
  {
    id: "level_10",
    name: "노련한 모험가",
    description: "레벨 10에 도달한다.",
    icon: "🌟",
    condition: (c) => c.level >= 10,
  },
  {
    id: "level_15",
    name: "전설의 모험가",
    description: "레벨 15에 도달한다.",
    icon: "👑",
    condition: (c) => c.level >= 15,
  },
  {
    id: "boss_1",
    name: "보스 사냥꾼",
    description: "보스를 처음으로 처치한다.",
    icon: "🐉",
    condition: (c) => c.bossDefeatedCount >= 1,
  },
  {
    id: "boss_all",
    name: "삼대 보스 정복자",
    description: "숲의 수호자, 얼음 망령, 용암 골렘을 모두 한 번씩 처치한다.",
    icon: "🔥",
    condition: (c) => c.bossDefeatedCount >= 3,
  },
  {
    id: "gold_500",
    name: "부자 모험가",
    description: "골드 500을 모은다.",
    icon: "💰",
    condition: (c) => c.gold >= 500,
  },
];

export function getAchievement(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}
