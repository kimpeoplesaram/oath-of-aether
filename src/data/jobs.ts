import type { JobDefinition } from "../types";

// 직업별 기본 스탯과 타자 입력 스킬 문구.
// 문구는 직업의 컨셉에 맞춰 주문/기합 형태로 구성했습니다.
export const JOBS: JobDefinition[] = [
  {
    id: "warrior",
    name: "검사",
    icon: "⚔️",
    tagline: "최전선에서 적을 베어내는 근접 전투의 달인",
    baseHp: 140,
    baseAtk: 18,
    skills: [
      {
        id: "warrior_slash",
        name: "연격베기",
        inputPhrase: "하나 둘 셋 베어라",
        damage: 22,
        description: "빠른 3연속 베기",
      },
      {
        id: "warrior_break",
        name: "파쇄격",
        inputPhrase: "대지를 가르는 일격",
        damage: 34,
        description: "강력한 일격으로 방어를 무너뜨린다",
      },
      {
        id: "warrior_taunt",
        name: "도발",
        inputPhrase: "내가 상대해주마",
        damage: 0,
        effect: "taunt",
        description: "[탱커] 몬스터의 다음 공격을 자신에게 집중시킨다 (협동 전투에서 효과)",
      },
    ],
  },
  {
    id: "priest",
    name: "성직자",
    icon: "✨",
    tagline: "빛의 힘으로 아군을 지키고 적을 정화하는 치유사",
    baseHp: 120,
    baseAtk: 14,
    skills: [
      {
        id: "priest_smite",
        name: "성스러운 심판",
        inputPhrase: "빛이여 심판하라",
        damage: 20,
        description: "신성한 빛으로 적을 응징한다",
      },
      {
        id: "priest_purify",
        name: "정화의 불꽃",
        inputPhrase: "어둠을 정화하는 불꽃",
        damage: 30,
        description: "어둠의 존재에게 특히 강력하다",
      },
      {
        id: "priest_heal",
        name: "치유의 빛",
        inputPhrase: "빛이여 상처를 감싸라",
        damage: 0,
        effect: "heal",
        value: 28,
        description: "[힐러] 가장 다친 아군(혼자일 땐 자신)의 체력을 회복시킨다",
      },
    ],
  },
  {
    id: "mage",
    name: "마법사",
    icon: "🔮",
    tagline: "에테르를 다루어 압도적인 화력을 쏟아내는 술사",
    baseHp: 100,
    baseAtk: 24,
    skills: [
      {
        id: "mage_bolt",
        name: "에테르 볼트",
        inputPhrase: "에테르여 응축하라",
        damage: 26,
        description: "압축된 에테르 탄환을 발사한다",
      },
      {
        id: "mage_meteor",
        name: "유성 낙하",
        inputPhrase: "하늘의 별이 떨어진다",
        damage: 40,
        description: "긴 영창이 필요하지만 강력한 광역 피해",
      },
    ],
  },
  {
    id: "archer",
    name: "궁수",
    icon: "🏹",
    tagline: "정확한 사격으로 원거리에서 적을 제압하는 사수",
    baseHp: 110,
    baseAtk: 20,
    skills: [
      {
        id: "archer_pin",
        name: "관통사격",
        inputPhrase: "바람을 가르는 화살",
        damage: 24,
        description: "적을 꿰뚫는 정밀 사격",
      },
      {
        id: "archer_rain",
        name: "화살비",
        inputPhrase: "하늘에서 쏟아지는 화살비",
        damage: 32,
        description: "넓은 범위에 화살을 퍼붓는다",
      },
      {
        id: "archer_focus",
        name: "집중 사격 지원",
        inputPhrase: "모두 조준하라",
        damage: 0,
        effect: "partyBuff",
        value: 0.3,
        description: "[서포터] 일정 시간 파티 전체의 공격력을 30% 올린다",
      },
    ],
  },
  {
    id: "rogue",
    name: "도적",
    icon: "🗡️",
    tagline: "그림자 속에서 적의 급소를 노리는 민첩한 전사",
    baseHp: 105,
    baseAtk: 22,
    skills: [
      {
        id: "rogue_strike",
        name: "급소 찌르기",
        inputPhrase: "그림자 속에서 찌른다",
        damage: 28,
        description: "빠르고 정확한 일격",
      },
      {
        id: "rogue_flurry",
        name: "연속 베기",
        inputPhrase: "순식간에 베고 빠진다",
        damage: 36,
        description: "짧은 틈을 노려 강하게 베어낸다",
      },
      {
        id: "rogue_weaken",
        name: "급소 가격",
        inputPhrase: "적의 힘줄을 끊는다",
        damage: 0,
        effect: "debuff",
        value: 0.3,
        description: "[디버퍼] 일정 시간 몬스터의 공격력을 30% 낮춘다",
      },
    ],
  },
  {
    id: "bard",
    name: "음유시인",
    icon: "🎵",
    tagline: "노래와 선율로 파티 전체를 다독이는 음유시인",
    baseHp: 115,
    baseAtk: 16,
    skills: [
      {
        id: "bard_strike",
        name: "불협화음",
        inputPhrase: "귀를 찢는 불협화음",
        damage: 18,
        description: "소리의 충격파로 적을 공격한다",
      },
      {
        id: "bard_heal",
        name: "회복의 노래",
        inputPhrase: "다 함께 숨을 고르자",
        damage: 0,
        effect: "partyHeal",
        value: 18,
        description: "[힐러-광역] 파티 전원의 체력을 소량 회복시킨다",
      },
    ],
  },
];

export function getJob(id: string): JobDefinition {
  const job = JOBS.find((j) => j.id === id);
  if (!job) throw new Error(`Unknown job id: ${id}`);
  return job;
}
