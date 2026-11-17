import { useEffect, useRef } from "react";
import { useCoopCombat } from "../combat/useCoopCombat";
import { diffPhrase } from "../combat/engine";
import { CharacterSprite, MonsterSprite } from "../render/SpriteCanvas";
import { getMonster } from "../data/monsters";
import type { MultiplayerApi } from "../multiplayer/useMultiplayer";
import type { MonsterId, PlayerCharacter, PlayerStats } from "../types";

const ROLE_LABEL: Record<string, string> = {
  warrior: "탱커",
  priest: "힐러",
  mage: "딜러",
  archer: "서포터",
  rogue: "디버퍼",
  bard: "힐러(광역)",
};

interface Props {
  mp: MultiplayerApi;
  instanceId: string;
  monsterId: MonsterId;
  player: PlayerCharacter;
  stats: PlayerStats;
  onLeave: () => void;
}

export function CoopCombatScreen({ mp, instanceId, monsterId, player, stats, onLeave }: Props) {
  const monster = getMonster(monsterId);
  const {
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
    playerAnim,
    monsterAnim,
    handleInputChange,
  } = useCoopCombat(mp, instanceId, monsterId, player, stats);

  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [isTargeted]);

  if (!enc) {
    return (
      <div className="panel combat-screen">
        <div className="phrase-hint" style={{ textAlign: "center", padding: "40px 0" }}>
          전투 준비 중...
        </div>
      </div>
    );
  }

  const chars = diffPhrase(activeTarget, typed);
  const monsterHpRatio = enc.monsterHp / enc.monsterMaxHp;
  const targetedParticipant = enc.pendingAttack
    ? enc.participants.find((p) => p.id === enc.pendingAttack!.targetId)
    : null;

  return (
    <div className="panel combat-screen">
      <div className="battle-stage coop">
        <div className="party-row">
          {enc.participants.map((p) => {
            const isSelf = p.id === mp.selfId;
            const selfAnimClass = isSelf
              ? playerAnim === "attack"
                ? " anim-attack-right"
                : playerAnim === "dodge"
                ? " anim-dodge"
                : ""
              : "";
            return (
              <div
                key={p.id}
                className={`battle-side party-member${
                  enc.pendingAttack?.targetId === p.id ? " targeted" : ""
                }${selfAnimClass}`}
              >
                <CharacterSprite kind={p.jobId} direction="right" scale={6} />
                {enc.pendingAttack?.targetId === p.id && <div className="target-marker">⚠</div>}
              </div>
            );
          })}
        </div>
        <div className="battle-ground" />
        <div
          className={`battle-side monster-side${
            monsterAnim === "attack" ? " anim-attack-left" : monsterAnim === "dodge" ? " anim-dodge" : ""
          }`}
        >
          <MonsterSprite kind={monsterId} flip scale={monster.isBoss ? 11 : 8} />
        </div>
      </div>
      {monster.isBoss && <div className="boss-banner">⚔ 보스전: {monster.name}</div>}

      <div className="party-hp-row">
        {enc.participants.map((p) => (
          <div key={p.id} className={`party-hp-card${p.id === mp.selfId ? " self" : ""}`}>
            <span className="party-hp-name">
              {p.name} · {ROLE_LABEL[p.jobId] ?? p.jobId}
            </span>
            <div className="hp-bar-track small">
              <div
                className={`hp-bar-fill${p.hp / p.maxHp < 0.3 ? " danger" : ""}`}
                style={{ width: `${Math.max(0, (p.hp / p.maxHp) * 100)}%` }}
              />
            </div>
            <span className="hud-hp-text">
              {p.hp}/{p.maxHp}
            </span>
          </div>
        ))}
      </div>

      <div className="combatants">
        <div className="combatant-card monster" style={{ gridColumn: "1 / -1" }}>
          <div className="combatant-name">
            {monster.name} {monster.icon}
          </div>
          <div className="hp-bar-track">
            <div
              className={`hp-bar-fill${monsterHpRatio < 0.3 ? " danger" : ""}`}
              style={{ width: `${Math.max(0, monsterHpRatio) * 100}%` }}
            />
          </div>
          <div className="hp-text">
            {Math.max(0, enc.monsterHp)} / {enc.monsterMaxHp}
          </div>
        </div>
      </div>

      {buffActive && <div className="buff-banner">⚡ 파티 공격력 상승 중!</div>}
      {debuffActive && <div className="buff-banner debuff">🗡️ 몬스터 공격력 약화 중!</div>}

      {enc.pendingAttack && !isTargeted && targetedParticipant && (
        <div className="incoming-attack">
          <span className="label">⚠ {targetedParticipant.name}이(가) 공격받는 중!</span>
          <div className="timer-track">
            <div
              className="timer-fill"
              style={{
                width: `${Math.max(
                  0,
                  ((enc.pendingAttack.deadlineAt - Date.now()) / enc.pendingAttack.windupMs) * 100
                )}%`,
              }}
            />
          </div>
        </div>
      )}

      <div className="phrase-box">
        <div className="phrase-hint">
          {isTargeted
            ? "내가 공격받는 중! 회피 문구를 입력하세요!"
            : `${currentSkill.name} — ${currentSkill.description}`}
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
        {!isTargeted && (
          <div className="skill-legend">
            {player.job.skills.map((s) => (
              <span key={s.id} className="skill-chip">
                {s.name}: {s.inputPhrase}
              </span>
            ))}
          </div>
        )}
      </div>

      <button className="btn-secondary" style={{ alignSelf: "center" }} onClick={onLeave}>
        전투 이탈
      </button>

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
