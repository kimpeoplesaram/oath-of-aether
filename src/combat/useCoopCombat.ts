import { useCallback, useEffect, useRef, useState } from "react";
import { hasTypo, isPhraseComplete, pickSkill, resolveSkillEffect } from "./engine";
import { rollCrit, useBattleEffects } from "./effects";
import type { MultiplayerApi } from "../multiplayer/useMultiplayer";
import type { LogEntry, PlayerCharacter, PlayerStats, Skill } from "../types";

let logSeq = 0;

/**
 * 협동 전투 훅. 몬스터 HP/공격 대상은 서버가 authoritative하게 관리하고,
 * 이 훅은 "내가 지금 무엇을 입력해야 하는가"와 로컬 스킬 로테이션만 다룬다.
 */
export function useCoopCombat(
  mp: MultiplayerApi,
  instanceId: string,
  monsterId: string,
  player: PlayerCharacter,
  stats: PlayerStats
) {
  const [currentSkill, setCurrentSkill] = useState<Skill>(() => pickSkill(player.job));
  const [typed, setTyped] = useState("");
  const [log, setLog] = useState<LogEntry[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [playerAnim, setPlayerAnim] = useState<"idle" | "attack" | "dodge">("idle");
  const [monsterAnim, setMonsterAnim] = useState<"idle" | "attack" | "dodge">("idle");
  const joinedRef = useRef(false);
  const animTimeouts = useRef<{ player?: ReturnType<typeof setTimeout>; monster?: ReturnType<typeof setTimeout> }>({});
  const prevPendingRef = useRef<string | null>(null);
  const { popups, shake, pushPopup, triggerShake } = useBattleEffects();

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

  const atkBonus = stats.atk - player.job.baseAtk;

  const pushLog = useCallback((text: string, kind: LogEntry["kind"]) => {
    logSeq += 1;
    setLog((prev: LogEntry[]) => [...prev.slice(-30), { id: logSeq, text, kind }]);
  }, []);

  // 입장 (최초 1회) / 이탈 (언마운트 시)
  useEffect(() => {
    if (!joinedRef.current) {
      mp.joinEncounter(instanceId, monsterId, player.hp, stats.maxHp);
      joinedRef.current = true;
    }
    return () => {
      mp.leaveEncounter(instanceId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instanceId]);

  // 타이머 UI 갱신(회피 제한시간 표시용)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 50);
    return () => clearInterval(id);
  }, []);

  const enc = mp.encounterState && mp.encounterState.instanceId === instanceId ? mp.encounterState : null;
  const self = enc?.participants.find((p) => p.id === mp.selfId) ?? null;
  const prevSelfHpRef = useRef<number | null>(null);

  // 서버가 권위를 가진 내 체력이 줄어들면(=내가 공격을 맞음) 피해 팝업과 화면 흔들림을 보여준다.
  useEffect(() => {
    if (self == null) {
      prevSelfHpRef.current = null;
      return;
    }
    const prev = prevSelfHpRef.current;
    if (prev != null && self.hp < prev) {
      pushPopup("player", `-${prev - self.hp}`, "damage");
      triggerShake("small");
    }
    prevSelfHpRef.current = self.hp;
  }, [self?.hp, pushPopup, triggerShake]);
  const isTargeted = !!(enc?.pendingAttack && enc.pendingAttack.targetId === mp.selfId);
  const buffActive = !!enc && Date.now() < enc.partyBuffUntil;
  const debuffActive = !!enc && Date.now() < (enc.monsterDebuffUntil ?? 0);

  const activeTarget = isTargeted && enc?.pendingAttack ? enc.pendingAttack.dodgePhrase : currentSkill.inputPhrase;

  // 몬스터의 공격이 (누군가의 회피 성공이든 실패든) 종료되는 순간 몬스터 공격 모션을 재생한다.
  useEffect(() => {
    const pendingId = enc?.pendingAttack ? enc.pendingAttack.targetId + ":" + enc.pendingAttack.deadlineAt : null;
    if (prevPendingRef.current && !pendingId) {
      triggerMonsterAnim("attack");
      triggerShake("small");
    }
    prevPendingRef.current = pendingId;
  }, [enc?.pendingAttack, triggerMonsterAnim, triggerShake]);

  const handleInputChange = useCallback(
    (value: string, isComposing?: boolean) => {
      const bounded = value.slice(0, activeTarget.length);
      setTyped(bounded);

      // 한글 조합 중에는 완성되지 않은 글자이므로 오타/완성 판정을 미룬다.
      if (isComposing) return;

      if (hasTypo(activeTarget, bounded)) {
        setTyped("");
        return;
      }

      if (isPhraseComplete(activeTarget, bounded)) {
        if (isTargeted) {
          mp.sendDodgeSuccess(instanceId);
          pushLog("공격을 회피했습니다!", "hit");
          pushPopup("player", "DODGE!", "dodge");
          triggerPlayerAnim("dodge");
        } else {
          const effect = resolveSkillEffect(currentSkill, atkBonus);
          triggerPlayerAnim("attack");
          if (effect.kind === "damage") {
            // 몬스터도 일정 확률로 공격을 회피한다 (플레이어의 회피와 대칭되는 연출)
            if (Math.random() < 0.15) {
              triggerMonsterAnim("dodge");
              pushPopup("monster", "MISS", "miss");
              pushLog("몬스터가 공격을 회피했습니다!", "miss");
            } else {
              const buffed = Math.round(effect.amount * (buffActive ? 1 + 0.3 : 1));
              const { amount: total, crit } = rollCrit(buffed);
              mp.sendEncounterAction(instanceId, "damage", total);
              pushPopup("monster", `-${total}`, crit ? "crit" : "damage");
              triggerShake(crit ? "big" : "small");
              pushLog(
                crit
                  ? `치명타! ${currentSkill.name}로 ${total}의 피해를 입혔습니다!`
                  : `${currentSkill.name}! ${total}의 피해를 입혔습니다.`,
                "hit"
              );
            }
          } else if (effect.kind === "heal") {
            mp.sendEncounterAction(instanceId, "heal", effect.amount);
            pushPopup("player", `+${effect.amount}`, "heal");
            pushLog(`${currentSkill.name}! 아군을 회복시켰습니다.`, "hit");
          } else if (effect.kind === "partyBuff") {
            mp.sendEncounterAction(instanceId, "buff", undefined, effect.durationMs);
            pushPopup("player", "ATK UP", "buff");
            pushLog(`${currentSkill.name}! 파티 공격력이 상승했습니다.`, "hit");
          } else if (effect.kind === "debuff") {
            mp.sendEncounterAction(instanceId, "debuff", effect.amount, effect.durationMs);
            pushPopup("monster", "WEAKEN", "buff");
            pushLog(`${currentSkill.name}! 적의 공격력을 약화시켰습니다.`, "hit");
          } else if (effect.kind === "partyHeal") {
            mp.sendEncounterAction(instanceId, "partyHeal", effect.amount);
            pushPopup("player", `+${effect.amount}`, "heal");
            pushLog(`${currentSkill.name}! 파티 전원을 회복시켰습니다.`, "hit");
          } else {
            mp.sendEncounterAction(instanceId, "taunt");
            pushLog(`${currentSkill.name}! 적의 시선을 끌었습니다.`, "hit");
          }
          setCurrentSkill(pickSkill(player.job, currentSkill.id));
        }
        setTyped("");
      }
    },
    [
      activeTarget,
      isTargeted,
      currentSkill,
      atkBonus,
      buffActive,
      instanceId,
      mp,
      player.job,
      pushLog,
      triggerPlayerAnim,
      triggerMonsterAnim,
      pushPopup,
      triggerShake,
    ]
  );

  const timeRemainingRatio =
    isTargeted && enc?.pendingAttack
      ? Math.max(0, (enc.pendingAttack.deadlineAt - now) / enc.pendingAttack.windupMs)
      : 1;

  return {
    enc,
    self,
    isTargeted,
    buffActive,
    debuffActive,
    playerAnim,
    monsterAnim,
    popups,
    shake,
    currentSkill,
    typed,
    activeTarget,
    timeRemainingRatio,
    log,
    handleInputChange,
  };
}
