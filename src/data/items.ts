import type { ConsumableItem } from "../types";

// 소비 아이템(포션) 정의. 등급이 높을수록 회복량이 크다.
export const CONSUMABLES: ConsumableItem[] = [
  {
    id: "potion_hp_small",
    name: "체력 물약",
    kind: "hpPotion",
    grade: "common",
    description: "체력을 40 회복한다.",
    restoreAmount: 40,
  },
  {
    id: "potion_hp_large",
    name: "상급 체력 물약",
    kind: "hpPotion",
    grade: "uncommon",
    description: "체력을 90 회복한다.",
    restoreAmount: 90,
  },
  {
    id: "potion_mp_small",
    name: "마나 물약",
    kind: "manaPotion",
    grade: "common",
    description: "마나를 30 회복한다. (전투 중에만 사용 가능)",
    restoreAmount: 30,
  },
  {
    id: "potion_mp_large",
    name: "상급 마나 물약",
    kind: "manaPotion",
    grade: "uncommon",
    description: "마나를 65 회복한다. (전투 중에만 사용 가능)",
    restoreAmount: 65,
  },
];

export function getConsumable(id: string | undefined): ConsumableItem | undefined {
  if (!id) return undefined;
  return CONSUMABLES.find((c) => c.id === id);
}

/** 캐릭터 생성 시 기본으로 지급하는 시작 포션. */
export const STARTER_INVENTORY: Record<string, number> = {
  potion_hp_small: 3,
  potion_mp_small: 2,
};
