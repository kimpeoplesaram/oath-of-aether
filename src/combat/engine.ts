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

export function pickSkill(job: JobDefinition, excludeId?: string): Skill {
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
