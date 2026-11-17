// 《에테르의 서약》 공용 타입 정의

export type JobId = "warrior" | "priest" | "mage" | "archer" | "rogue" | "bard";

export type SkillEffect = "damage" | "heal" | "partyBuff" | "taunt" | "debuff" | "partyHeal";

export interface Skill {
  id: string;
  name: string; // 스킬명
  inputPhrase: string; // 타자 입력 문구 (주문/기합)
  damage: number; // effect가 damage일 때 기본 피해량
  description: string;
  /** 생략 시 damage. 협동 전투에서 직업별 역할(탱커/힐러/버퍼/디버퍼)을 구현하는 데 쓰인다. */
  effect?: SkillEffect;
  /** heal: 회복량, partyBuff: 피해량 증가 비율(0.3 = 30%), debuff: 몬스터 공격력 감소 비율, partyHeal: 파티 전원 회복량 */
  value?: number;
}

export interface JobDefinition {
  id: JobId;
  name: string; // 검사 / 성직자 / 마법사 / 궁수
  icon: string;
  tagline: string;
  baseHp: number;
  baseAtk: number;
  skills: Skill[];
}

export interface MonsterAttack {
  id: string;
  telegraphText: string; // 몬스터가 공격을 준비할 때 표시되는 설명
  dodgePhrase: string; // 플레이어가 입력해 회피/경감해야 하는 문구
  damage: number;
  windupMs: number; // 입력 제한 시간
}

export type MonsterId = "forest_slime" | "goblin_raider" | "forest_guardian" | "ice_wraith";

export interface MonsterDefinition {
  id: MonsterId;
  name: string;
  icon: string;
  hp: number;
  attackIntervalMs: number; // 다음 공격까지 대기 시간
  attacks: MonsterAttack[];
  xpReward: number;
  lootTable: string[]; // EquipmentItem id 목록 (victory 시 랜덤 드랍 후보)
  /** 던전 보스 여부. true면 드랍률 100%이며, 플레이어 직업이 사용 가능한 장비 중에서만 드랍된다. */
  isBoss?: boolean;
}

export type EquipmentSlot = "weapon" | "armor";

export interface EquipmentItem {
  id: string;
  name: string;
  slot: EquipmentSlot;
  jobId?: JobId; // weapon은 특정 직업 전용, armor는 공용
  atkBonus?: number;
  hpBonus?: number;
}

export interface PlayerEquipment {
  weaponId?: string;
  armorId?: string;
}

export interface PlayerCharacter {
  name: string;
  job: JobDefinition;
  level: number;
  xp: number;
  hp: number; // 현재 체력 (오버월드/전투 간에 유지됨)
  equipment: PlayerEquipment;
}

/** 레벨/장비를 반영한 실질 전투 스탯 */
export interface PlayerStats {
  maxHp: number;
  atk: number;
}

export type GameScreen = "title" | "create" | "login" | "resume" | "overworld" | "combat";

/** 로그인된 계정 세션. 서버에 등록된 계정에서만 존재한다 (게스트 플레이는 null). */
export interface AccountSession {
  username: string;
  token: string;
  /** 계정/길드 REST API를 호출할 http(s) 베이스 주소 (멀티플레이 서버와 동일). */
  apiBaseUrl: string;
  guildId: string | null;
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  targetMonsterId?: MonsterId; // 생략 시 몬스터 종류 무관
  targetCount: number;
  rewardXp: number;
}

export interface LogEntry {
  id: number;
  text: string;
  kind: "hit" | "miss" | "system";
}
