import { useCallback, useEffect, useRef, useState } from "react";
import type {
  LogEntry,
  MonsterAttack,
  MonsterDefinition,
  PlayerCharacter,
  PlayerStats,
  Skill,
} from "../types";
import { hasTypo, isPhraseComplete, pickAttack, pickSkill, resolveSkillEffect } from "./engine";

export type CombatResult = "ongoing" | "victory" | "defeat";

interface IncomingAttack {
  attack: MonsterAttack;
  deadlineAt: number;
  startedAt: number;
}

let logSeq = 0;

/**
 * @param startHp 전투 시작 시 체력 (오버월드에서 유지되던 현재 체력을 그대로 이어받는다)
 * @param stats 레벨/장비가 반영된 실질 스탯 (maxHp, atk)
 */
export function useCombat(
  player: PlayerCharacter,
  monsterDef: MonsterDefinition,
  startHp: number,
  stats: PlayerStats
) {
  const [playerHp, setPlayerHp] = useState(startHp);
  const [monsterHp, setMonsterHp] = useState(monsterDef.hp);
  const [currentSkill, setCurrentSkill] = useState<Skill>(() => pickSkill(player.job));
  const [incoming, setIncoming] = useState<IncomingAttack | null>(null);
  const [typed, setTyped] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [log, setLog] = useState<LogEntry[]>([]);
  const [result, setResult] = useState<CombatResult>("ongoing");
  const [lastHitFlash, setLastHitFlash] = useState<"player" | "monster" | null>(null);
  const [buffUntil, setBuffUntil] = useState(0);
  const [buffRatio, setBuffRatio] = useState(0);
  const [debuffUntil, setDebuffUntil] = useState(0);
  const [debuffRatio, setDebuffRatio] = useState(0);
  const debuffRef = useRef({ until: 0, ratio: 0 });

  const resultRef = useRef(result);
  resultRef.current = result;
  const nextAttackAtRef = useRef(Date.now() + monsterDef.attackIntervalMs);
  const incomingRef = useRef(incoming);
  incomingRef.current = incoming;

  // 기본 공격력 대비 추가된 만큼을 스킬 피해에 그대로 더해, 레벨업/장비가 전투에 체감되게 한다.
  const atkBonus = stats.atk - player.job.baseAtk;

  const pushLog = useCallback((text: string, kind: LogEntry["kind"]) => {
    logSeq += 1;
    setLog((prev: LogEntry[]) => [...prev.slice(-30), { id: logSeq, text, kind }]);
  }, []);

  const flash = useCallback((who: "player" | "monster") => {
    setLastHitFlash(who);
    setTimeout(() => setLastHitFlash((cur) => (cur === who ? null : cur)), 180);
  }, []);

  // 전투 틱: 몬스터 공격 스폰, 타임아웃 판정, 타이머 UI 갱신
  useEffect(() => {
    if (result !== "ongoing") return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);

      if (!incomingRef.current && t >= nextAttackAtRef.current) {
        const attack = pickAttack(monsterDef);
        const startedAt = t;
        const deadlineAt = t + attack.windupMs;
        setIncoming({ attack, deadlineAt, startedAt });
        incomingRef.current = { attack, deadlineAt, startedAt };
        setTyped("");
        pushLog(attack.telegraphText, "system");
      } else if (incomingRef.current && t >= incomingRef.current.deadlineAt) {
        const debuffActive = t < debuffRef.current.until;
        const dmg = Math.round(
          incomingRef.current.attack.damage * (debuffActive ? 1 - debuffRef.current.ratio : 1)
        );
        setPlayerHp((hp: number) => Math.max(0, hp - dmg));
        flash("player");
        pushLog(`회피 실패! ${dmg}의 피해를 입었습니다.`, "miss");
        setIncoming(null);
        incomingRef.current = null;
        setTyped("");
        nextAttackAtRef.current = Date.now() + monsterDef.attackIntervalMs;
      }
    }, 50);
    return () => clearInterval(id);
  }, [result, monsterDef, pushLog, flash]);

  // 승패 판정
  useEffect(() => {
    if (result !== "ongoing") return;
    if (playerHp <= 0) {
      setResult("defeat");
      pushLog("쓰러졌습니다...", "system");
    } else if (monsterHp <= 0) {
      setResult("victory");
      pushLog(`${monsterDef.name}을(를) 쓰러뜨렸습니다!`, "system");
    }
  }, [playerHp, monsterHp, result, monsterDef.name, pushLog]);

  const activeTarget = incoming ? incoming.attack.dodgePhrase : currentSkill.inputPhrase;

  const handleInputChange = useCallback(
    (value: string) => {
      if (resultRef.current !== "ongoing") return;
      // 목표 문구보다 길게 입력할 수 없도록 제한
      const bounded = value.slice(0, activeTarget.length);
      setTyped(bounded);

      if (hasTypo(activeTarget, bounded)) {
        // 오타 발생: 입력을 즉시 리셋해 다시 처음부터 입력하게 한다
        setTyped("");
        return;
      }

      if (isPhraseComplete(activeTarget, bounded)) {
        if (incomingRef.current) {
          pushLog(`"${incomingRef.current.attack.dodgePhrase}" 입력 성공! 공격을 회피했습니다.`, "hit");
          setIncoming(null);
          incomingRef.current = null;
          nextAttackAtRef.current = Date.now() + monsterDef.attackIntervalMs;
        } else {
          const buffActive = Date.now() < buffUntil;
          const effect = resolveSkillEffect(currentSkill, atkBonus);
          if (effect.kind === "damage") {
            const totalDamage = Math.round(effect.amount * (buffActive ? 1 + buffRatio : 1));
            setMonsterHp((hp: number) => Math.max(0, hp - totalDamage));
            flash("monster");
            pushLog(`${currentSkill.name}! ${totalDamage}의 피해를 입혔습니다.`, "hit");
          } else if (effect.kind === "heal") {
            setPlayerHp((hp: number) => Math.min(stats.maxHp, hp + effect.amount));
            pushLog(`${currentSkill.name}! 체력을 ${effect.amount} 회복했습니다.`, "hit");
          } else if (effect.kind === "partyBuff") {
            setBuffUntil(Date.now() + (effect.durationMs ?? 8000));
            setBuffRatio(effect.amount);
            pushLog(`${currentSkill.name}! 공격력이 일시적으로 상승했습니다.`, "hit");
          } else if (effect.kind === "debuff") {
            const until = Date.now() + (effect.durationMs ?? 8000);
            debuffRef.current = { until, ratio: effect.amount };
            setDebuffUntil(until);
            setDebuffRatio(effect.amount);
            pushLog(`${currentSkill.name}! 적의 공격력을 약화시켰습니다.`, "hit");
          } else if (effect.kind === "partyHeal") {
            setPlayerHp((hp: number) => Math.min(stats.maxHp, hp + effect.amount));
            pushLog(`${currentSkill.name}! 체력을 ${effect.amount} 회복했습니다.`, "hit");
          } else {
            pushLog(`${currentSkill.name}! 적의 시선을 끌었다.`, "hit");
          }
          setCurrentSkill(pickSkill(player.job, currentSkill.id));
        }
        setTyped("");
      }
    },
    [activeTarget, currentSkill, monsterDef.attackIntervalMs, player.job, pushLog, atkBonus, flash, buffUntil, buffRatio, stats.maxHp]
  );

  const timeRemainingRatio = incoming
    ? Math.max(0, (incoming.deadlineAt - now) / (incoming.deadlineAt - incoming.startedAt))
    : 1;

  return {
    playerHp,
    playerMaxHp: stats.maxHp,
    monsterHp,
    monsterMaxHp: monsterDef.hp,
    currentSkill,
    incoming,
    typed,
    activeTarget,
    timeRemainingRatio,
    log,
    result,
    lastHitFlash,
    handleInputChange,
    buffActive: Date.now() < buffUntil,
    debuffActive: Date.now() < debuffUntil,
  };
}
