import { useCallback, useRef, useState } from "react";

// 전투 화면에 떠오르는 피해/회복/치명타 숫자 팝업과, 큰 타격 시 화면을 흔드는
// 연출을 solo/coop 전투 훅이 공통으로 쓰기 위한 작은 유틸. 상태만 관리하고
// 실제 렌더링(위치/애니메이션)은 각 전투 화면 컴포넌트에서 CSS로 처리한다.

export type PopupKind = "damage" | "crit" | "heal" | "buff" | "miss" | "dodge";

export interface BattlePopup {
  id: number;
  side: "player" | "monster";
  text: string;
  kind: PopupKind;
}

export type BurstKind = "hit" | "crit" | "heal";

export interface BattleBurst {
  id: number;
  side: "player" | "monster";
  kind: BurstKind;
}

let popupSeq = 0;
let burstSeq = 0;

export function useBattleEffects() {
  const [popups, setPopups] = useState<BattlePopup[]>([]);
  const [bursts, setBursts] = useState<BattleBurst[]>([]);
  const [shake, setShake] = useState<"none" | "small" | "big">("none");
  const [flash, setFlash] = useState(false);
  const shakeTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const flashTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const pushPopup = useCallback((side: "player" | "monster", text: string, kind: PopupKind) => {
    popupSeq += 1;
    const id = popupSeq;
    setPopups((prev) => [...prev.slice(-11), { id, side, text, kind }]);
    setTimeout(() => {
      setPopups((prev) => prev.filter((p) => p.id !== id));
    }, 850);
  }, []);

  const triggerBurst = useCallback((side: "player" | "monster", kind: BurstKind) => {
    burstSeq += 1;
    const id = burstSeq;
    setBursts((prev) => [...prev.slice(-7), { id, side, kind }]);
    setTimeout(() => {
      setBursts((prev) => prev.filter((b) => b.id !== id));
    }, 500);
  }, []);

  const triggerShake = useCallback((level: "small" | "big" = "small", ms = 260) => {
    if (shakeTimeout.current) clearTimeout(shakeTimeout.current);
    setShake(level);
    shakeTimeout.current = setTimeout(() => setShake("none"), ms);
  }, []);

  // 치명타처럼 아주 강한 타격일 때 화면 전체가 짧게 번쩍이는 플래시 연출.
  const triggerFlash = useCallback((ms = 140) => {
    if (flashTimeout.current) clearTimeout(flashTimeout.current);
    setFlash(true);
    flashTimeout.current = setTimeout(() => setFlash(false), ms);
  }, []);

  return { popups, bursts, shake, flash, pushPopup, triggerBurst, triggerShake, triggerFlash };
}

// 치명타 판정: 20% 확률로 1.6배 피해. 공격을 가하는 쪽(플레이어/파티원)에만 적용해
// 전투에 변주를 준다.
export function rollCrit(amount: number): { amount: number; crit: boolean } {
  if (Math.random() < 0.2) {
    return { amount: Math.round(amount * 1.6), crit: true };
  }
  return { amount, crit: false };
}
