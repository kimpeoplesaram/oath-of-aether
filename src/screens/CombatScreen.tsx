import { useEffect, useRef, useState } from "react";
import { useCombat, type CombatResult } from "../combat/useCombat";
import { diffPhrase, getUnlockedSkills } from "../combat/engine";
import { CharacterSprite, MonsterSprite } from "../render/SpriteCanvas";
import { HitBurst } from "./HitBurst";
import { InventoryPanel } from "./InventoryPanel";
import { getConsumable } from "../data/items";
import type { MonsterDefinition, PlayerCharacter, PlayerInventory, PlayerStats } from "../types";

interface Props {
  player: PlayerCharacter;
  monster: MonsterDefinition;
  startHp: number;
  stats: PlayerStats;
  inventory: PlayerInventory;
  onUseItem: (itemId: string) => boolean;
  onResolved: (result: CombatResult, finalHp: number) => void;
  /** 첫 솔로 전투인지 — true면 시간을 멈추고 튜토리얼을 먼저 보여준다. */
  showTutorial?: boolean;
  /** 튜토리얼을 다 보고 닫았을 때 호출 (다시 뜨지 않도록 저장). */
  onTutorialDone?: () => void;
}

interface TutorialStep {
  title: string;
  body: string;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: "전투 방식 안내",
    body: "이 게임의 전투는 키보드 타이핑으로 진행됩니다. 화면 아래 입력창에 표시된 문구를 정확히 입력하면 공격이나 스킬이 발동됩니다.",
  },
  {
    title: "공격 / 스킬 입력",
    body: "'문구를 입력하세요' 아래에 적힌 글자를 그대로 입력하세요. 한 글자씩 맞으면 초록색으로 표시됩니다. 다 입력하면 자동으로 스킬이 발동됩니다.",
  },
  {
    title: "몬스터 공격 회피",
    body: "몬스터가 공격을 준비하면 화면 위쪽에 경고와 타이머가 뜨고, 입력창의 문구가 '회피 문구'로 바뀝니다. 타이머가 다 되기 전에 입력을 마치면 피해를 피하거나 줄일 수 있습니다.",
  },
  {
    title: "아이템 사용",
    body: "전투 중에도 가방 🎒 아이콘을 눌러 포션 등을 사용할 수 있습니다. 체력이나 마나가 부족할 때 활용하세요.",
  },
  {
    title: "도망치기",
    body: "위험하다고 느껴지면 '🏃 도망치기' 버튼으로 전투를 즉시 포기하고 빠져나올 수 있습니다. 보상은 없지만 목숨은 지킬 수 있습니다.",
  },
];

export function CombatScreen({
  player,
  monster,
  startHp,
  stats,
  inventory,
  onUseItem,
  onResolved,
  showTutorial,
  onTutorialDone,
}: Props) {
  const [tutorialActive, setTutorialActive] = useState(!!showTutorial);
  const [tutorialStep, setTutorialStep] = useState(0);

  function handleTutorialNext() {
    if (tutorialStep < TUTORIAL_STEPS.length - 1) {
      setTutorialStep((s) => s + 1);
    } else {
      setTutorialActive(false);
      onTutorialDone?.();
    }
  }

  const {
    playerHp,
    playerMaxHp,
    mana,
    manaMax,
    monsterHp,
    monsterMaxHp,
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
    guardActive,
  } = useCombat(player, monster, startHp, stats, tutorialActive);

  function handleUseItem(itemId: string) {
    const item = getConsumable(itemId);
    if (!item) return;
    if (!onUseItem(itemId)) return;
    if (item.kind === "hpPotion") applyHeal(item.restoreAmount);
    else applyManaRestore(item.restoreAmount);
  }

  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [incoming]);

  const chars = diffPhrase(activeTarget, typed);
  const playerHpRatio = playerHp / playerMaxHp;
  const monsterHpRatio = monsterHp / monsterMaxHp;

  return (
    <div className="panel combat-screen">
      {tutorialActive && (
        <div className="tutorial-overlay">
          <div className="tutorial-box">
            <div className="tutorial-step-label">
              튜토리얼 {tutorialStep + 1} / {TUTORIAL_STEPS.length}
            </div>
            <h3 className="tutorial-title">{TUTORIAL_STEPS[tutorialStep].title}</h3>
            <p className="tutorial-body">{TUTORIAL_STEPS[tutorialStep].body}</p>
            <div className="tutorial-actions">
              <button
                type="button"
                className="btn-secondary tutorial-skip-btn"
                onClick={() => {
                  setTutorialActive(false);
                  onTutorialDone?.();
                }}
              >
                건너뛰기
              </button>
              <button type="button" className="btn-primary tutorial-next-btn" onClick={handleTutorialNext}>
                {tutorialStep < TUTORIAL_STEPS.length - 1 ? "다음" : "전투 시작!"}
              </button>
            </div>
          </div>
        </div>
      )}
      <div
        className={`battle-stage${monster.isBoss ? " boss" : ""}${
          shake === "small" ? " shake-small" : shake === "big" ? " shake-big" : ""
        }`}
      >
        <div className="battle-embers" aria-hidden>
          {Array.from({ length: 10 }).map((_, i) => (
            <span key={i} className="ember" />
          ))}
        </div>
        <div
          className={`battle-side player-side${lastHitFlash === "player" ? " hit-flash" : ""}${
            playerAnim === "attack" ? " anim-attack-right" : playerAnim === "dodge" ? " anim-dodge" : ""
          }`}
        >
          <CharacterSprite kind={player.job.id} direction="right" scale={9.5} />
          {popups
            .filter((p) => p.side === "player")
            .map((p) => (
              <span key={p.id} className={`battle-popup ${p.kind}`}>
                {p.text}
              </span>
            ))}
          {bursts
            .filter((b) => b.side === "player")
            .map((b) => (
              <HitBurst key={b.id} kind={b.kind} />
            ))}
        </div>
        <div className="battle-ground" />
        <div
          className={`battle-side monster-side${lastHitFlash === "monster" ? " hit-flash" : ""}${
            monsterAnim === "attack" ? " anim-attack-left" : monsterAnim === "dodge" ? " anim-dodge" : ""
          }`}
        >
          <MonsterSprite kind={monster.id} flip scale={monster.isBoss ? 13 : 9.5} />
          {popups
            .filter((p) => p.side === "monster")
            .map((p) => (
              <span key={p.id} className={`battle-popup ${p.kind}`}>
                {p.text}
              </span>
            ))}
          {bursts
            .filter((b) => b.side === "monster")
            .map((b) => (
              <HitBurst key={b.id} kind={b.kind} />
            ))}
        </div>
      </div>
      {critFlash && <div className="combat-flash" />}
      {monster.isBoss && (
        <div className="boss-banner">
          ⚔ 보스전: {monster.name}
          {isEnraged && <span className="enrage-tag">⚡ 분노 상태! 공격이 빨라졌습니다</span>}
        </div>
      )}

      <div className="combatants">
        <div className="combatant-card player">
          <div className="combatant-name">
            {player.job.icon} {player.name}
          </div>
          <div className="combatant-sub">
            {player.job.name} · Lv.{player.level}
          </div>
          <div className="hp-bar-track">
            <div
              className={`hp-bar-fill${playerHpRatio < 0.3 ? " danger" : ""}`}
              style={{ width: `${Math.max(0, playerHpRatio) * 100}%` }}
            />
          </div>
          <div className="hp-text">
            {Math.max(0, playerHp)} / {playerMaxHp}
          </div>
          <div className="mp-bar-track">
            <div className="mp-bar-fill" style={{ width: `${Math.max(0, (mana / manaMax) * 100)}%` }} />
          </div>
          <div className="mp-text">
            MP {Math.max(0, Math.round(mana))} / {manaMax}
          </div>
        </div>

        <div className="vs-mark">VS</div>

        <div className="combatant-card monster">
          <div className="combatant-name">
            {monster.name} {monster.icon}
          </div>
          <div className="combatant-sub">&nbsp;</div>
          <div className="hp-bar-track">
            <div
              className={`hp-bar-fill${monsterHpRatio < 0.3 ? " danger" : ""}`}
              style={{ width: `${Math.max(0, monsterHpRatio) * 100}%` }}
            />
          </div>
          <div className="hp-text">
            {Math.max(0, monsterHp)} / {monsterMaxHp}
          </div>
        </div>
      </div>

      {guardActive && <div className="buff-banner">🛡️ 방어 태세 중! 받는 피해가 줄어듭니다</div>}

      {incoming && result === "ongoing" && (
        <div className="incoming-attack">
          <span className="label">⚠ {incoming.attack.telegraphText}</span>
          <div className="timer-track">
            <div className="timer-fill" style={{ width: `${timeRemainingRatio * 100}%` }} />
          </div>
        </div>
      )}

      {result === "ongoing" && (
        <div className="phrase-box">
          <div className="phrase-hint">
            {incoming ? "회피 문구를 입력하세요!" : `${currentSkill.name} — ${currentSkill.description}`}
          </div>
          <div className="phrase-display mono">
            {chars.map((c, i) => (
              <span key={i} className={`phrase-char ${c.status}`}>
                {c.char}
              </span>
            ))}
          </div>
          <input
            ref={inputRef}
            className="typing-input"
            value={typed}
            onChange={(e: any) => handleInputChange(e.target.value, e.nativeEvent?.isComposing)}
            onCompositionEnd={(e: any) => handleInputChange(e.target.value, false)}
            autoFocus
            spellCheck={false}
            autoComplete="off"
            placeholder="위 문구를 그대로 입력하세요"
            disabled={tutorialActive}
          />
          {!incoming && (
            <div className="skill-legend">
              {getUnlockedSkills(player.job, player.level).map((s) => (
                <span key={s.id} className="skill-chip">
                  {s.name}: {s.inputPhrase}
                </span>
              ))}
            </div>
          )}
          <div className="combat-inventory-row">
            <InventoryPanel inventory={inventory} onUse={handleUseItem} manaUsable compact />
            <button
              type="button"
              className="btn-secondary flee-btn"
              onClick={() => onResolved("flee", Math.max(0, playerHp))}
            >
              🏃 도망치기
            </button>
          </div>
        </div>
      )}

      {result !== "ongoing" && (
        <div className={`result-overlay ${result === "victory" ? "victory" : "defeat"}`}>
          <h2 className="title-font">{result === "victory" ? "승리!" : "패배..."}</h2>
          <p className="combatant-sub">
            {result === "victory"
              ? `${monster.name}을(를) 물리쳤습니다.`
              : "체력을 회복하고 다시 도전하세요."}
          </p>
          <button
            className="btn-primary"
            onClick={() => onResolved(result as CombatResult, Math.max(0, playerHp))}
          >
            계속하기
          </button>
        </div>
      )}

      <div className="log-panel">
        {[...log].reverse().map((entry: (typeof log)[number]) => (
          <div key={entry.id} className={`log-line ${entry.kind}`}>
            {entry.text}
          </div>
        ))}
      </div>

      {result === "ongoing" && secondsToNextAttack !== null && secondsToNextAttack <= 3 && (
        <div className="attack-warning">
          {secondsToNextAttack}초 뒤 {monster.name} 공격!
        </div>
      )}
    </div>
  );
}
