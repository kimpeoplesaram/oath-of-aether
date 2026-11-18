import { useState } from "react";
import { ACHIEVEMENTS } from "../data/achievements";

interface Props {
  achievements: string[];
}

/** 달성한/달성하지 못한 업적을 모두 보여주는 토글형 패널. */
export function AchievementsPanel({ achievements }: Props) {
  const [open, setOpen] = useState(false);
  const unlockedCount = ACHIEVEMENTS.filter((a) => achievements.includes(a.id)).length;

  return (
    <div className="achievements-panel-anchor">
      <button type="button" className="achievements-toggle-btn" onClick={() => setOpen((o) => !o)}>
        🏆 업적 ({unlockedCount}/{ACHIEVEMENTS.length})
      </button>
      {open && (
        <div className="achievements-panel">
          <div className="achievements-panel-header">
            <span>🏆 업적</span>
            <button type="button" className="shop-close-btn" onClick={() => setOpen(false)}>
              ✕
            </button>
          </div>
          <div className="achievements-list">
            {ACHIEVEMENTS.map((a) => {
              const unlocked = achievements.includes(a.id);
              return (
                <div key={a.id} className={`achievement-row${unlocked ? " unlocked" : " locked"}`}>
                  <span className="achievement-icon">{unlocked ? a.icon : "🔒"}</span>
                  <div className="achievement-info">
                    <span className="achievement-name">{a.name}</span>
                    <span className="achievement-desc">{a.description}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
