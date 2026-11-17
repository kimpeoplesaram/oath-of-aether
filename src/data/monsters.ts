import type { MonsterDefinition, MonsterId } from "../types";

// 1차 구현 범위의 튜토리얼 몬스터.
// 이후 던전/스테이지 확장 시 이 배열에 추가해 나간다.
export const MONSTERS: MonsterDefinition[] = [
  {
    id: "forest_slime",
    name: "숲의 슬라임",
    icon: "🟢",
    hp: 80,
    attackIntervalMs: 9000,
    xpReward: 35,
    lootTable: ["armor_cloth"],
    attacks: [
      {
        id: "slime_tackle",
        telegraphText: "슬라임이 몸을 웅크려 돌진을 준비합니다!",
        dodgePhrase: "옆으로 구르기",
        damage: 12,
        windupMs: 4500,
      },
      {
        id: "slime_splash",
        telegraphText: "슬라임이 산성 점액을 튀기려 합니다!",
        dodgePhrase: "방패로 막아내기",
        damage: 16,
        windupMs: 4000,
      },
    ],
  },
  {
    id: "goblin_raider",
    name: "고블린 약탈자",
    icon: "👹",
    hp: 130,
    attackIntervalMs: 7500,
    xpReward: 60,
    lootTable: ["wep_worn_sword", "wep_worn_symbol", "wep_worn_staff", "wep_worn_bow", "armor_chain"],
    attacks: [
      {
        id: "goblin_slash",
        telegraphText: "고블린이 녹슨 칼을 치켜듭니다!",
        dodgePhrase: "재빠르게 뒤로 물러서기",
        damage: 18,
        windupMs: 4200,
      },
      {
        id: "goblin_throw",
        telegraphText: "고블린이 돌을 집어 던지려 합니다!",
        dodgePhrase: "몸을 숙여 피하기",
        damage: 14,
        windupMs: 3600,
      },
    ],
  },
  {
    id: "forest_guardian",
    name: "숲의 수호자",
    icon: "🗿",
    hp: 320,
    attackIntervalMs: 6500,
    xpReward: 260,
    isBoss: true,
    lootTable: [
      "wep_guardian_sword",
      "wep_guardian_symbol",
      "wep_guardian_staff",
      "wep_guardian_bow",
      "wep_guardian_dagger",
      "wep_guardian_lute",
      "armor_guardian",
    ],
    attacks: [
      {
        id: "guardian_slam",
        telegraphText: "수호자가 거대한 주먹을 들어 올립니다!",
        dodgePhrase: "땅이 흔들리기 전에 굴러라",
        damage: 24,
        windupMs: 3800,
      },
      {
        id: "guardian_roots",
        telegraphText: "수호자의 발밑에서 뿌리가 솟아오릅니다!",
        dodgePhrase: "뿌리를 피해 도약하기",
        damage: 20,
        windupMs: 3200,
      },
      {
        id: "guardian_roar",
        telegraphText: "수호자가 포효하며 돌조각을 흩뿌립니다!",
        dodgePhrase: "팔로 얼굴을 가리고 버티기",
        damage: 28,
        windupMs: 4000,
      },
    ],
  },
  {
    id: "ice_wraith",
    name: "얼음 망령",
    icon: "❄️",
    hp: 380,
    attackIntervalMs: 6500,
    xpReward: 300,
    isBoss: true,
    lootTable: [
      "wep_frost_sword",
      "wep_frost_symbol",
      "wep_frost_staff",
      "wep_frost_bow",
      "wep_frost_dagger",
      "wep_frost_lute",
      "armor_frost",
    ],
    attacks: [
      {
        id: "wraith_frost_nova",
        telegraphText: "망령의 주위에 서리 기운이 소용돌이칩니다!",
        dodgePhrase: "온기를 지키며 버티기",
        damage: 22,
        windupMs: 3600,
      },
      {
        id: "wraith_ice_shard",
        telegraphText: "망령이 날카로운 얼음 조각을 쏘아냅니다!",
        dodgePhrase: "재빨리 몸을 숙이기",
        damage: 26,
        windupMs: 3200,
      },
      {
        id: "wraith_blizzard",
        telegraphText: "망령이 주변 전체에 눈보라를 일으킵니다!",
        dodgePhrase: "숨을 참고 눈보라 견디기",
        damage: 30,
        windupMs: 4200,
      },
    ],
  },
  {
    id: "lava_golem",
    name: "용암 골렘",
    icon: "🌋",
    hp: 460,
    attackIntervalMs: 7000,
    xpReward: 360,
    isBoss: true,
    lootTable: [
      "wep_magma_sword",
      "wep_magma_symbol",
      "wep_magma_staff",
      "wep_magma_bow",
      "wep_magma_dagger",
      "wep_magma_lute",
      "armor_magma",
    ],
    attacks: [
      {
        id: "golem_eruption",
        telegraphText: "골렘의 몸에서 균열이 벌어지며 용암이 솟구칩니다!",
        dodgePhrase: "갈라진 틈을 피해 물러서기",
        damage: 26,
        windupMs: 3800,
      },
      {
        id: "golem_slam",
        telegraphText: "골렘이 불타는 주먹으로 땅을 내리찍으려 합니다!",
        dodgePhrase: "충격파가 오기 전에 뛰어오르기",
        damage: 32,
        windupMs: 3400,
      },
      {
        id: "golem_breath",
        telegraphText: "골렘이 가슴의 화구에서 열기를 내뿜습니다!",
        dodgePhrase: "뜨거운 숨결 피해 몸을 돌리기",
        damage: 34,
        windupMs: 4400,
      },
    ],
  },
];

export function getMonster(id: MonsterId): MonsterDefinition {
  const m = MONSTERS.find((x) => x.id === id);
  if (!m) throw new Error(`Unknown monster id: ${id}`);
  return m;
}
