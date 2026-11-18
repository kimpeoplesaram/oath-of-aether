// 오버월드에 서 있는 NPC. 전투 없이 대화만 하며, 세계관/공략 팁을 들려준다.
export interface NpcDefinition {
  id: string;
  name: string;
  icon: string;
  x: number;
  y: number;
  lines: string[];
}

export const NPCS: NpcDefinition[] = [
  {
    id: "npc_elder",
    name: "장로 에이린",
    icon: "🧙",
    x: 1060,
    y: 760,
    lines: [
      "모험가여, 에테르의 균열이 벌어진 뒤로 이 숲에도 몬스터가 들끓는다네.",
      "자네가 입으로 외는 말이 곧 검이자 지팡이일세. 정확히, 그리고 망설임 없이 외워야 해.",
      "서쪽 숲의 수호자, 북쪽 얼음 망령, 동쪽 용암 골렘... 세 보스를 모두 물리쳐야 균열의 중심에 닿을 수 있다네.",
    ],
  },
  {
    id: "npc_merchant",
    name: "떠돌이 상인 모라",
    icon: "🧳",
    x: 1340,
    y: 640,
    lines: [
      "어서오게! 물약은 저쪽 🛒 상점에서 골드로 살 수 있다네.",
      "안 쓰는 장비는 버리지 말고 보관함에 넣어두게. 상점 '판매' 탭에서 전부 골드로 바꿔주지.",
      "품질이 좋은 장비는 랭크가 SSS까지 올라간다네. 같은 장비라도 운에 따라 천차만별이지.",
    ],
  },
  {
    id: "npc_guard",
    name: "수비대장 테오",
    icon: "🛡️",
    x: 900,
    y: 560,
    lines: [
      "전투 중 너무 버겁다면 주저 말고 도망치게. 목숨이 우선이니까.",
      "레벨이 오르면 새로운 스킬도 배우게 될 걸세. 같은 입력만 반복하면 금방 질리니, 꾸준히 성장하시게.",
      "협동 전투에서는 역할을 나누게 — 탱커는 도발, 힐러는 회복, 서포터는 버프를 맡아야 파티가 오래 버틴다네.",
    ],
  },
];

export function getNpc(id: string): NpcDefinition | undefined {
  return NPCS.find((n) => n.id === id);
}
