import type { ItemGrade } from "../types";

// 아이템 등급 표시용 한글 명칭과 색상.
export const GRADE_LABELS: Record<ItemGrade, string> = {
  common: "일반",
  uncommon: "고급",
  rare: "희귀",
  epic: "영웅",
  legendary: "전설",
};

export const GRADE_COLORS: Record<ItemGrade, string> = {
  common: "#b7bdc6",
  uncommon: "#3ddc73",
  rare: "#4aa8ff",
  epic: "#c25bff",
  legendary: "#ffb23d",
};

export const GRADE_ORDER: ItemGrade[] = ["common", "uncommon", "rare", "epic", "legendary"];

// 장비를 상점에 판매할 때 등급별로 받는 골드.
export const GRADE_SELL_PRICE: Record<ItemGrade, number> = {
  common: 10,
  uncommon: 25,
  rare: 60,
  epic: 150,
  legendary: 400,
};
