import type { ItemGrade } from "../types";

// 아이템의 "등급(희귀도)"과 "품질(가공 상태, 0~100 랜덤)"을 종합해 하나의
// 총괄 랭크(SSS~D)로 매긴다. 등급이 품질보다 비중이 크지만, 품질이 좋으면
// 같은 등급이라도 한 단계 위 랭크까지 올라갈 수 있다.

export const RANK_ORDER = ["D", "C", "C+", "B", "B+", "A", "A+", "S", "SS", "SSS"] as const;
export type PowerRank = (typeof RANK_ORDER)[number];

export const RANK_COLORS: Record<PowerRank, string> = {
  D: "#8a8f98",
  C: "#9fd68c",
  "C+": "#7fe066",
  B: "#6fc6ff",
  "B+": "#4aa8ff",
  A: "#a98cff",
  "A+": "#c25bff",
  S: "#ff9f4a",
  SS: "#ff6b4a",
  SSS: "#ffd24a",
};

const GRADE_WEIGHT: Record<ItemGrade, number> = {
  common: 0,
  uncommon: 20,
  rare: 40,
  epic: 60,
  legendary: 80,
};

/** 아이템을 획득할 때마다 굴리는 품질 값 (1~100). */
export function rollQuality(): number {
  return 1 + Math.floor(Math.random() * 100);
}

/** 등급(0~80점)과 품질(0~20점)을 합산해 0~100점 범위의 종합 점수를 낸 뒤 랭크로 환산한다. */
export function computePowerRank(grade: ItemGrade, quality: number): PowerRank {
  const score = GRADE_WEIGHT[grade] + quality * 0.2;
  if (score >= 95) return "SSS";
  if (score >= 85) return "SS";
  if (score >= 75) return "S";
  if (score >= 65) return "A+";
  if (score >= 55) return "A";
  if (score >= 45) return "B+";
  if (score >= 35) return "B";
  if (score >= 25) return "C+";
  if (score >= 15) return "C";
  return "D";
}
