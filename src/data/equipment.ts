import type { EquipmentItem } from "../types";

// 장비 아이템 정의. weapon은 직업 전용, armor는 공용.
export const EQUIPMENT: EquipmentItem[] = [
  // 검사
  { id: "wep_worn_sword", name: "낡은 검", slot: "weapon", jobId: "warrior", atkBonus: 4 },
  { id: "wep_iron_sword", name: "강철 검", slot: "weapon", jobId: "warrior", atkBonus: 9 },
  // 성직자
  { id: "wep_worn_symbol", name: "낡은 성표", slot: "weapon", jobId: "priest", atkBonus: 4 },
  { id: "wep_blessed_symbol", name: "축복받은 성표", slot: "weapon", jobId: "priest", atkBonus: 9 },
  // 마법사
  { id: "wep_worn_staff", name: "낡은 지팡이", slot: "weapon", jobId: "mage", atkBonus: 4 },
  { id: "wep_ether_staff", name: "에테르 지팡이", slot: "weapon", jobId: "mage", atkBonus: 9 },
  // 궁수
  { id: "wep_worn_bow", name: "낡은 활", slot: "weapon", jobId: "archer", atkBonus: 4 },
  { id: "wep_long_bow", name: "장궁", slot: "weapon", jobId: "archer", atkBonus: 9 },
  // 도적
  { id: "wep_worn_dagger", name: "낡은 단검", slot: "weapon", jobId: "rogue", atkBonus: 4 },
  { id: "wep_shadow_dagger", name: "그림자 단검", slot: "weapon", jobId: "rogue", atkBonus: 9 },
  // 음유시인
  { id: "wep_worn_lute", name: "낡은 류트", slot: "weapon", jobId: "bard", atkBonus: 4 },
  { id: "wep_silver_lute", name: "은빛 류트", slot: "weapon", jobId: "bard", atkBonus: 9 },
  // 방어구 (공용)
  { id: "armor_cloth", name: "낡은 로브", slot: "armor", hpBonus: 15 },
  { id: "armor_chain", name: "사슬 갑옷", slot: "armor", hpBonus: 30 },
  // 던전 보스 전용 최상급 장비
  { id: "wep_guardian_sword", name: "수호자의 대검", slot: "weapon", jobId: "warrior", atkBonus: 16 },
  { id: "wep_guardian_symbol", name: "수호자의 성표", slot: "weapon", jobId: "priest", atkBonus: 16 },
  { id: "wep_guardian_staff", name: "수호자의 지팡이", slot: "weapon", jobId: "mage", atkBonus: 16 },
  { id: "wep_guardian_bow", name: "수호자의 장궁", slot: "weapon", jobId: "archer", atkBonus: 16 },
  { id: "wep_guardian_dagger", name: "수호자의 단검", slot: "weapon", jobId: "rogue", atkBonus: 16 },
  { id: "wep_guardian_lute", name: "수호자의 류트", slot: "weapon", jobId: "bard", atkBonus: 16 },
  { id: "armor_guardian", name: "수호자의 갑주", slot: "armor", hpBonus: 55 },
  // 얼어붙은 동굴 보스(얼음 망령) 전용 최상급 장비
  { id: "wep_frost_sword", name: "서리한 대검", slot: "weapon", jobId: "warrior", atkBonus: 20 },
  { id: "wep_frost_symbol", name: "서리한 성표", slot: "weapon", jobId: "priest", atkBonus: 20 },
  { id: "wep_frost_staff", name: "서리한 지팡이", slot: "weapon", jobId: "mage", atkBonus: 20 },
  { id: "wep_frost_bow", name: "서리한 장궁", slot: "weapon", jobId: "archer", atkBonus: 20 },
  { id: "wep_frost_dagger", name: "서리한 단검", slot: "weapon", jobId: "rogue", atkBonus: 20 },
  { id: "wep_frost_lute", name: "서리한 류트", slot: "weapon", jobId: "bard", atkBonus: 20 },
  { id: "armor_frost", name: "서리한 갑주", slot: "armor", hpBonus: 70 },
  { id: "wep_magma_sword", name: "마그마 대검", slot: "weapon", jobId: "warrior", atkBonus: 26 },
  { id: "wep_magma_symbol", name: "마그마 성표", slot: "weapon", jobId: "priest", atkBonus: 26 },
  { id: "wep_magma_staff", name: "마그마 지팡이", slot: "weapon", jobId: "mage", atkBonus: 26 },
  { id: "wep_magma_bow", name: "마그마 장궁", slot: "weapon", jobId: "archer", atkBonus: 26 },
  { id: "wep_magma_dagger", name: "마그마 단검", slot: "weapon", jobId: "rogue", atkBonus: 26 },
  { id: "wep_magma_lute", name: "마그마 류트", slot: "weapon", jobId: "bard", atkBonus: 26 },
  { id: "armor_magma", name: "마그마 갑주", slot: "armor", hpBonus: 95 },
];

export function getEquipment(id: string | undefined): EquipmentItem | undefined {
  if (!id) return undefined;
  return EQUIPMENT.find((e) => e.id === id);
}
