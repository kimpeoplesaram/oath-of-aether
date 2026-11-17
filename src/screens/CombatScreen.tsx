import { useEffect, useRef } from "react";
import { useCombat, type CombatResult } from "../combat/useCombat";
import { diffPhrase } from "../combat/engine";
import { CharacterSprite, MonsterSprite } from "../render/SpriteCanvas";
import type { MonsterDefinition, PlayerCharacter, PlayerStats } from "../types";

interface Props {
  player: PlayerCharacter;
  monster: MonsterDefinition;
  startHp: number;
  stats: PlayerStats;
  onResolved: (result: CombatResult, finalHp: number) => void;
}

export function CombatScreen({ player, monster, startHp, stats, onResolved }: Props) {
  const {
    playerHp,
    playerMaxHp,
    monsterHp,
    monsterMaxHp,
    currentSkill,
    incoming,
    typed,
    activeTarget,
    timeRemainingRatio,
    log,
    result,
    lastHitFlash,
    playerAnim,
    monsterAnim,
    handleInputChange,
  } = useCombat(player, monster, startHp, stats);

  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [incoming]);

  const chars = diffPhrase(activeTarget, typed);
  const playerHpRatio = playerHp / playerMaxHp;
  const monsterHpRatio = monsterHp / monsterMaxHp;

  return (
    <div className="panel combat-screen">
      <div className="battle-stage">
        <div
          className={`battle-side player-side${lastHitFlash === "player" ? " hit-flash" : ""}${
            playerAnim === "attack" ? " anim-attack-right" : playerAnim === "dodge" ? " anim-dodge" : ""
          }`}
        >
          <CharacterSprite kind={player.job.id} direction="right" scale={7} />
        </div>
        <div className="battle-ground" />
        <div
          className={`battle-side monster-side${lastHitFlash === "monster" ? " hit-flash" : ""}${
            monsterAnim === "attack" ? " anim-attack-left" : monsterAnim === "dodge" ? " anim-dodge" : ""
          }`}
        >
          <MonsterSprite kind={monster.id} flip scale={monster.isBoss ? 9 : 7} />
        </div>
      </div>
      {monster.isBoss && <div className="boss-banner">⚔ 보스전: {monster.name}</div>}

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
    </div>
  );
}
