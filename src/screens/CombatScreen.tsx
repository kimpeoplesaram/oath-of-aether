import { useEffect, useRef } from "react";
import { useCombat, type CombatResult } from "../combat/useCombat";
import { diffPhrase } from "../combat/engine";
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
}

export function CombatScreen({ player, monster, startHp, stats, inventory, onUseItem, onResolved }: Props) {
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
  } = useCombat(player, monster, startHp, stats);

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
          />
          {!incoming && (
            <div className="skill-legend">
              {player.job.skills.map((s) => (
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
        {log.map((entry: (typeof log)[number]) => (
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
