import { useCallback, useEffect, useRef, useState } from "react";
import { hasTypo, isPhraseComplete, pickSkill, resolveSkillEffect } from "./engine";
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
  const joinedRef = useRef(false);

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
  const isTargeted = !!(enc?.pendingAttack && enc.pendingAttack.targetId === mp.selfId);
  const buffActive = !!enc && Date.now() < enc.partyBuffUntil;
  const debuffActive = !!enc && Date.now() < (enc.monsterDebuffUntil ?? 0);

  const activeTarget = isTargeted && enc?.pendingAttack ? enc.pendingAttack.dodgePhrase : currentSkill.inputPhrase;

  const handleInputChange = useCallback(
    (value: string) => {
      const bounded = value.slice(0, activeTarget.length);
      setTyped(bounded);

      if (hasTypo(activeTarget, bounded)) {
        setTyped("");
        return;
      }

      if (isPhraseComplete(activeTarget, bounded)) {
        if (isTargeted) {
          mp.sendDodgeSuccess(instanceId);
          pushLog("공격을 회피했습니다!", "hit");
        } else {
          const effect = resolveSkillEffect(currentSkill, atkBonus);
          if (effect.kind === "damage") {
            const total = Math.round(effect.amount * (buffActive ? 1 + 0.3 : 1));
            mp.sendEncounterAction(instanceId, "damage", total);
            pushLog(`${currentSkill.name}! ${total}의 피해를 입혔습니다.`, "hit");
          } else if (effect.kind === "heal") {
            mp.sendEncounterAction(instanceId, "heal", effect.amount);
            pushLog(`${currentSkill.name}! 아군을 회복시켰습니다.`, "hit");
          } else if (effect.kind === "partyBuff") {
            mp.sendEncounterAction(instanceId, "buff", undefined, effect.durationMs);
            pushLog(`${currentSkill.name}! 파티 공격력이 상승했습니다.`, "hit");
          } else if (effect.kind === "debuff") {
            mp.sendEncounterAction(instanceId, "debuff", effect.amount, effect.durationMs);
            pushLog(`${currentSkill.name}! 적의 공격력을 약화시켰습니다.`, "hit");
          } else if (effect.kind === "partyHeal") {
            mp.sendEncounterAction(instanceId, "partyHeal", effect.amount);
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
    [activeTarget, isTargeted, currentSkill, atkBonus, buffActive, instanceId, mp, player.job, pushLog]
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
    currentSkill,
    typed,
    activeTarget,
    timeRemainingRatio,
    log,
    handleInputChange,
  };
}
