import type { JobDefinition, MonsterAttack, MonsterDefinition, Skill } from "../types";

export interface TypedChar {
  char: string;
  status: "pending" | "current" | "correct" | "wrong";
}

/**
 * 목표 문구와 현재까지 입력한 텍스트를 비교해 글자별 상태를 계산한다.
 * 화면에 "어디까지 맞게 입력했는지"를 보여주기 위한 순수 함수.
 */
export function diffPhrase(target: string, typed: string): TypedChar[] {
  const chars: TypedChar[] = [];
  for (let i = 0; i < target.length; i++) {
    const targetChar = target[i];
    if (i < typed.length) {
      chars.push({
        char: targetChar,
        status: typed[i] === targetChar ? "correct" : "wrong",
      });
    } else if (i === typed.length) {
      chars.push({ char: targetChar, status: "current" });
    } else {
      chars.push({ char: targetChar, status: "pending" });
    }
  }
  return chars;
}

/** 입력이 목표 문구와 완전히 일치하는지 (공백 포함 정확 일치) */
export function isPhraseComplete(target: string, typed: string): boolean {
  return typed === target;
}

/** 입력이 더 이상 진행할 수 없을 만큼 틀렸는지 (오타 발생 즉시 알려주기 위함) */
export function hasTypo(target: string, typed: string): boolean {
  for (let i = 0; i < typed.length; i++) {
    if (typed[i] !== target[i]) return true;
  }
  return false;
}

export function pickRandom<T>(arr: T[], excludeId?: string): T {
  const pool = excludeId && arr.length > 1 ? arr.filter((x: any) => x.id !== excludeId) : arr;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * 다음 스킬을 무작위로 고른다. availableMp를 넘기면 현재 마나로 쓸 수 있는
 * 스킬 중에서만 고르고, 하나도 감당할 수 없으면(마나 0에 가까운 상황) 그 중
 * 가장 적은 마나가 드는 스킬로 안전하게 대체한다 (직업마다 mpCost 0인 기본
 * 스킬이 하나씩 있으므로 실제로는 거의 발생하지 않는다).
 */
export function pickSkill(job: JobDefinition, excludeId?: string, availableMp?: number): Skill {
  if (typeof availableMp === "number") {
    const affordable = job.skills.filter((s) => s.mpCost <= availableMp);
    if (affordable.length > 0) return pickRandom(affordable, excludeId);
    return [...job.skills].sort((a, b) => a.mpCost - b.mpCost)[0];
  }
  return pickRandom(job.skills, excludeId);
}

export function pickAttack(monster: MonsterDefinition, excludeId?: string): MonsterAttack {
  return pickRandom(monster.attacks, excludeId);
}

export interface ResolvedSkillEffect {
  kind: "damage" | "heal" | "partyBuff" | "taunt" | "debuff" | "partyHeal";
  amount: number; // damage: 피해량, heal/partyHeal: 회복량, partyBuff/debuff: 비율(0.3=30%)
  durationMs?: number; // partyBuff/debuff/taunt 지속 시간
}

/** 스킬의 효과 종류에 따라 실제로 적용할 수치를 계산한다 (순수 함수) */
export function resolveSkillEffect(skill: Skill, atkBonus: number): ResolvedSkillEffect {
  const effect = skill.effect ?? "damage";
  if (effect === "damage") {
    return { kind: "damage", amount: skill.damage + atkBonus };
  }
  if (effect === "heal") {
    return { kind: "heal", amount: skill.value ?? 0 };
  }
  if (effect === "partyBuff") {
    return { kind: "partyBuff", amount: skill.value ?? 0, durationMs: 8000 };
  }
  if (effect === "debuff") {
    return { kind: "debuff", amount: skill.value ?? 0, durationMs: 8000 };
  }
  if (effect === "partyHeal") {
    return { kind: "partyHeal", amount: skill.value ?? 0 };
  }
  return { kind: "taunt", amount: 0, durationMs: 8000 };
}
