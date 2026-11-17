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

let popupSeq = 0;

export function useBattleEffects() {
  const [popups, setPopups] = useState<BattlePopup[]>([]);
  const [shake, setShake] = useState<"none" | "small" | "big">("none");
  const shakeTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const pushPopup = useCallback((side: "player" | "monster", text: string, kind: PopupKind) => {
    popupSeq += 1;
    const id = popupSeq;
    setPopups((prev) => [...prev.slice(-11), { id, side, text, kind }]);
    setTimeout(() => {
      setPopups((prev) => prev.filter((p) => p.id !== id));
    }, 850);
  }, []);

  const triggerShake = useCallback((level: "small" | "big" = "small", ms = 260) => {
    if (shakeTimeout.current) clearTimeout(shakeTimeout.current);
    setShake(level);
    shakeTimeout.current = setTimeout(() => setShake("none"), ms);
  }, []);

  return { popups, shake, pushPopup, triggerShake };
}

// 치명타 판정: 20% 확률로 1.6배 피해. 공격을 가하는 쪽(플레이어/파티원)에만 적용해
// 전투에 변주를 준다.
export function rollCrit(amount: number): { amount: number; crit: boolean } {
  if (Math.random() < 0.2) {
    return { amount: Math.round(amount * 1.6), crit: true };
  }
  return { amount, crit: false };
}
