import { getEquipment } from "../data/equipment";
import type { PlayerCharacter, PlayerStats } from "../types";

/** 다음 레벨업에 필요한 누적 경험치 */
export function xpToNextLevel(level: number): number {
  return 50 + (level - 1) * 30;
}

/** 레벨/장비를 반영한 실질 전투 스탯을 계산한다 */
export function computeStats(player: PlayerCharacter): PlayerStats {
  const levelBonusHp = (player.level - 1) * 12;
  const levelBonusAtk = (player.level - 1) * 3;

  const weapon = getEquipment(player.equipment.weaponId);
  const armor = getEquipment(player.equipment.armorId);

  const maxHp = player.job.baseHp + levelBonusHp + (armor?.hpBonus ?? 0);
  const atk = player.job.baseAtk + levelBonusAtk + (weapon?.atkBonus ?? 0);

  return { maxHp, atk };
}

export interface GainXpResult {
  player: PlayerCharacter;
  leveledUp: boolean;
  levelsGained: number;
}

/** 경험치를 지급하고, 필요하면 레벨업까지 처리한다 (레벨업 시 체력 전체 회복) */
export function gainXp(player: PlayerCharacter, amount: number): GainXpResult {
  let { level, xp } = player;
  xp += amount;
  let levelsGained = 0;

  while (xp >= xpToNextLevel(level)) {
    xp -= xpToNextLevel(level);
    level += 1;
    levelsGained += 1;
  }

  const leveledUp = levelsGained > 0;
  const updated: PlayerCharacter = { ...player, level, xp };

  if (leveledUp) {
    const stats = computeStats(updated);
    updated.hp = stats.maxHp; // 레벨업 시 완전 회복
  }

  return { player: updated, leveledUp, levelsGained };
}

/**
 * 새 장비를 획득했을 때, 현재 장착 중인 것보다 좋으면 자동 장착한다.
 * (인벤토리 UI 없이 "항상 최선의 장비를 착용" 하는 단순한 1차 구현)
 */
export function maybeEquip(player: PlayerCharacter, itemId: string): { player: PlayerCharacter; equipped: boolean; itemName: string } {
  const item = getEquipment(itemId);
  if (!item) return { player, equipped: false, itemName: "" };

  if (item.slot === "weapon") {
    if (item.jobId && item.jobId !== player.job.id) {
      return { player, equipped: false, itemName: item.name };
    }
    const current = getEquipment(player.equipment.weaponId);
    if (!current || (item.atkBonus ?? 0) > (current.atkBonus ?? 0)) {
      return {
        player: { ...player, equipment: { ...player.equipment, weaponId: item.id } },
        equipped: true,
        itemName: item.name,
      };
    }
  } else {
    const current = getEquipment(player.equipment.armorId);
    if (!current || (item.hpBonus ?? 0) > (current.hpBonus ?? 0)) {
      return {
        player: { ...player, equipment: { ...player.equipment, armorId: item.id } },
        equipped: true,
        itemName: item.name,
      };
    }
  }
  return { player, equipped: false, itemName: item.name };
}
