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
import { rollCrit, useBattleEffects } from "./effects";
import { playSfx } from "../audio/engine";

export type CombatResult = "ongoing" | "victory" | "defeat" | "flee";

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
  const [mana, setMana] = useState(stats.maxMp);
  const [monsterHp, setMonsterHp] = useState(monsterDef.hp);
  const [currentSkill, setCurrentSkill] = useState<Skill>(() => pickSkill(player.job));
  const [incoming, setIncoming] = useState<IncomingAttack | null>(null);
  const [typed, setTyped] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [log, setLog] = useState<LogEntry[]>([]);
  const [result, setResult] = useState<CombatResult>("ongoing");
  const [lastHitFlash, setLastHitFlash] = useState<"player" | "monster" | null>(null);
  const [playerAnim, setPlayerAnim] = useState<"idle" | "attack" | "dodge">("idle");
  const [monsterAnim, setMonsterAnim] = useState<"idle" | "attack" | "dodge">("idle");
  const [buffUntil, setBuffUntil] = useState(0);
  const [buffRatio, setBuffRatio] = useState(0);
  const [debuffUntil, setDebuffUntil] = useState(0);
  const [debuffRatio, setDebuffRatio] = useState(0);
  const debuffRef = useRef({ until: 0, ratio: 0 });
  const {
    popups,
    bursts,
    shake,
    flash: critFlash,
    pushPopup,
    triggerBurst,
    triggerShake,
    triggerFlash,
  } = useBattleEffects();

  const resultRef = useRef(result);
  resultRef.current = result;
  const nextAttackAtRef = useRef(Date.now() + monsterDef.attackIntervalMs);
  const incomingRef = useRef(incoming);
  incomingRef.current = incoming;
  const monsterHpRef = useRef(monsterHp);
  monsterHpRef.current = monsterHp;
  const manaRef = useRef(mana);
  manaRef.current = mana;

  // 보스는 체력이 30% 이하로 떨어지면 "분노"해서 공격 주기가 짧아진다. 일반
  // 몬스터전과 달리 보스전만 뒤로 갈수록 더 긴박해지도록 하기 위한 장치.
  const isEnraged = monsterDef.isBoss && monsterHp > 0 && monsterHp / monsterDef.hp <= 0.3;
  const nextAttackInterval = useCallback(() => {
    const enraged = monsterDef.isBoss && monsterHpRef.current > 0 && monsterHpRef.current / monsterDef.hp <= 0.3;
    return enraged ? Math.round(monsterDef.attackIntervalMs * 0.55) : monsterDef.attackIntervalMs;
  }, [monsterDef]);

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

  const animTimeouts = useRef<{ player?: ReturnType<typeof setTimeout>; monster?: ReturnType<typeof setTimeout> }>({});

  const triggerPlayerAnim = useCallback((kind: "attack" | "dodge", ms = 300) => {
    if (animTimeouts.current.player) clearTimeout(animTimeouts.current.player);
    setPlayerAnim(kind);
    animTimeouts.current.player = setTimeout(() => setPlayerAnim("idle"), ms);
  }, []);

  const triggerMonsterAnim = useCallback((kind: "attack" | "dodge", ms = 300) => {
    if (animTimeouts.current.monster) clearTimeout(animTimeouts.current.monster);
    setMonsterAnim(kind);
    animTimeouts.current.monster = setTimeout(() => setMonsterAnim("idle"), ms);
  }, []);

  useEffect(() => {
    return () => {
      if (animTimeouts.current.player) clearTimeout(animTimeouts.current.player);
      if (animTimeouts.current.monster) clearTimeout(animTimeouts.current.monster);
    };
  }, []);

  // 전투 틱: 몬스터 공격 스폰, 타임아웃 판정, 타이머 UI 갱신
  useEffect(() => {
    if (result !== "ongoing") return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);

      // 마나는 가만히 있어도 천천히 회복된다 (최대치의 약 4%/초).
      if (manaRef.current < stats.maxMp) {
        setMana((m: number) => Math.min(stats.maxMp, m + stats.maxMp * 0.04 * 0.05));
      }

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
        triggerMonsterAnim("attack");
        playSfx("hitTaken");
        pushPopup("player", `-${dmg}`, "damage");
        triggerBurst("player", "hit");
        triggerShake(monsterDef.isBoss ? "big" : "small");
        if (monsterDef.isBoss) triggerFlash();
        pushLog(`회피 실패! ${dmg}의 피해를 입었습니다.`, "miss");
        setIncoming(null);
        incomingRef.current = null;
        setTyped("");
        nextAttackAtRef.current = Date.now() + nextAttackInterval();
      }
    }, 50);
    return () => clearInterval(id);
  }, [
    result,
    monsterDef,
    pushLog,
    flash,
    triggerMonsterAnim,
    pushPopup,
    triggerBurst,
    triggerShake,
    triggerFlash,
    nextAttackInterval,
    stats.maxMp,
  ]);

  // 승패 판정
  useEffect(() => {
    if (result !== "ongoing") return;
    if (playerHp <= 0) {
      setResult("defeat");
      playSfx("defeat");
      pushLog("쓰러졌습니다...", "system");
    } else if (monsterHp <= 0) {
      setResult("victory");
      playSfx("victory");
      pushLog(`${monsterDef.name}을(를) 쓰러뜨렸습니다!`, "system");
    }
  }, [playerHp, monsterHp, result, monsterDef.name, pushLog]);

  const activeTarget = incoming ? incoming.attack.dodgePhrase : currentSkill.inputPhrase;

  // 브라우저에 따라 한글 조합이 끝났을 때 onChange와 onCompositionEnd가 같은
  // 완성된 값에 대해 중복으로 호출되는 경우가 있다. 이미 처리한 값과 목표
  // 문구가 그대로 반복되면 다시 처리하지 않도록 막아, 중복 판정으로 입력이
  // 갑자기 초기화되거나 두 번 처리되는 문제를 방지한다.
  const lastProcessedRef = useRef<{ value: string; target: string } | null>(null);

  const handleInputChange = useCallback(
    (value: string, isComposing?: boolean) => {
      if (resultRef.current !== "ongoing") return;
      // 목표 문구보다 길게 입력할 수 없도록 제한
      const bounded = value.slice(0, activeTarget.length);
      setTyped(bounded);

      // 한글 등 조합형 입력(IME) 중에는 아직 완성되지 않은 글자이므로
      // 오타/완성 판정을 미루고 화면 표시만 갱신한다. 그렇지 않으면
      // 조합 중간 상태(예: "ㅇ")가 목표 글자와 달라 즉시 오타로 처리되어
      // 입력이 계속 초기화되는 것처럼 보인다.
      if (isComposing) return;

      if (
        lastProcessedRef.current &&
        lastProcessedRef.current.value === bounded &&
        lastProcessedRef.current.target === activeTarget
      ) {
        return;
      }
      lastProcessedRef.current = { value: bounded, target: activeTarget };

      if (hasTypo(activeTarget, bounded)) {
        // 오타 발생: 입력을 즉시 리셋해 다시 처음부터 입력하게 한다
        setTyped("");
        lastProcessedRef.current = null;
        return;
      }

      if (isPhraseComplete(activeTarget, bounded)) {
        lastProcessedRef.current = null;
        if (incomingRef.current) {
          pushLog(`"${incomingRef.current.attack.dodgePhrase}" 입력 성공! 공격을 회피했습니다.`, "hit");
          pushPopup("player", "DODGE!", "dodge");
          playSfx("dodge");
          triggerPlayerAnim("dodge");
          setIncoming(null);
          incomingRef.current = null;
          nextAttackAtRef.current = Date.now() + nextAttackInterval();
        } else {
          const buffActive = Date.now() < buffUntil;
          const effect = resolveSkillEffect(currentSkill, atkBonus);
          triggerPlayerAnim("attack");
          if (effect.kind === "damage") {
            // 몬스터도 일정 확률로 공격을 회피한다 (플레이어의 회피와 대칭되는 연출)
            if (Math.random() < 0.15) {
              triggerMonsterAnim("dodge");
              playSfx("miss");
              pushPopup("monster", "MISS", "miss");
              pushLog(`${monsterDef.name}이(가) 공격을 회피했습니다!`, "miss");
            } else {
              const buffed = Math.round(effect.amount * (buffActive ? 1 + buffRatio : 1));
              const { amount: totalDamage, crit } = rollCrit(buffed);
              setMonsterHp((hp: number) => Math.max(0, hp - totalDamage));
              flash("monster");
              playSfx(crit ? "crit" : "attack");
              pushPopup("monster", `-${totalDamage}`, crit ? "crit" : "damage");
              triggerBurst("monster", crit ? "crit" : "hit");
              triggerShake(crit ? "big" : "small");
              if (crit) triggerFlash();
              pushLog(
                crit
                  ? `치명타! ${currentSkill.name}로 ${totalDamage}의 피해를 입혔습니다!`
                  : `${currentSkill.name}! ${totalDamage}의 피해를 입혔습니다.`,
                "hit"
              );
            }
          } else if (effect.kind === "heal") {
            setPlayerHp((hp: number) => Math.min(stats.maxHp, hp + effect.amount));
            playSfx("heal");
            pushPopup("player", `+${effect.amount}`, "heal");
            pushLog(`${currentSkill.name}! 체력을 ${effect.amount} 회복했습니다.`, "hit");
          } else if (effect.kind === "partyBuff") {
            setBuffUntil(Date.now() + (effect.durationMs ?? 8000));
            setBuffRatio(effect.amount);
            playSfx("buff");
            pushPopup("player", "ATK UP", "buff");
            pushLog(`${currentSkill.name}! 공격력이 일시적으로 상승했습니다.`, "hit");
          } else if (effect.kind === "debuff") {
            const until = Date.now() + (effect.durationMs ?? 8000);
            debuffRef.current = { until, ratio: effect.amount };
            setDebuffUntil(until);
            setDebuffRatio(effect.amount);
            playSfx("debuff");
            pushPopup("monster", "WEAKEN", "buff");
            pushLog(`${currentSkill.name}! 적의 공격력을 약화시켰습니다.`, "hit");
          } else if (effect.kind === "partyHeal") {
            setPlayerHp((hp: number) => Math.min(stats.maxHp, hp + effect.amount));
            playSfx("heal");
            pushPopup("player", `+${effect.amount}`, "heal");
            pushLog(`${currentSkill.name}! 체력을 ${effect.amount} 회복했습니다.`, "hit");
          } else {
            pushLog(`${currentSkill.name}! 적의 시선을 끌었다.`, "hit");
          }
          const manaAfterCast = Math.max(0, manaRef.current - currentSkill.mpCost);
          setMana(manaAfterCast);
          manaRef.current = manaAfterCast;
          setCurrentSkill(pickSkill(player.job, currentSkill.id, manaAfterCast));
        }
        setTyped("");
      }
    },
    [
      activeTarget,
      currentSkill,
      monsterDef,
      player.job,
      pushLog,
      atkBonus,
      flash,
      buffUntil,
      buffRatio,
      stats.maxHp,
      triggerPlayerAnim,
      triggerMonsterAnim,
      pushPopup,
      triggerBurst,
      triggerShake,
      triggerFlash,
      nextAttackInterval,
    ]
  );

  // 포션 사용: 인벤토리 차감은 상위(App.tsx)에서 처리하고, 여기서는 전투 중인
  // 체력/마나 상태에 회복 효과만 적용한다.
  const applyHeal = useCallback(
    (amount: number) => {
      if (resultRef.current !== "ongoing") return;
      setPlayerHp((hp: number) => Math.min(stats.maxHp, hp + amount));
      playSfx("heal");
      pushPopup("player", `+${amount}`, "heal");
      pushLog(`체력 물약 사용! 체력을 ${amount} 회복했습니다.`, "hit");
    },
    [stats.maxHp, pushPopup, pushLog]
  );

  const applyManaRestore = useCallback(
    (amount: number) => {
      if (resultRef.current !== "ongoing") return;
      const next = Math.min(stats.maxMp, manaRef.current + amount);
      setMana(next);
      manaRef.current = next;
      playSfx("mana");
      pushPopup("player", `+${amount} MP`, "buff");
      pushLog(`마나 물약 사용! 마나를 ${amount} 회복했습니다.`, "hit");
    },
    [stats.maxMp, pushPopup, pushLog]
  );

  const timeRemainingRatio = incoming
    ? Math.max(0, (incoming.deadlineAt - now) / (incoming.deadlineAt - incoming.startedAt))
    : 1;

  // 공격 예고(incoming)가 뜨기 전, 몇 초 뒤에 몬스터가 공격할지 미리 보여주는 카운트다운.
  // 이미 incoming이 떠서 회피 문구를 입력해야 하는 동안에는 보여줄 필요가 없다.
  const secondsToNextAttack = !incoming
    ? Math.max(0, Math.ceil((nextAttackAtRef.current - now) / 1000))
    : null;

  return {
    playerHp,
    playerMaxHp: stats.maxHp,
    mana,
    manaMax: stats.maxMp,
    monsterHp,
    monsterMaxHp: monsterDef.hp,
    currentSkill,
    incoming,
    typed,
    activeTarget,
    timeRemainingRatio,
    secondsToNextAttack,
    log,
    result,
    lastHitFlash,
    playerAnim,
    monsterAnim,
    popups,
    bursts,
    shake,
    critFlash,
    isEnraged,
    handleInputChange,
    applyHeal,
    applyManaRestore,
    buffActive: Date.now() < buffUntil,
    debuffActive: Date.now() < debuffUntil,
  };
}
