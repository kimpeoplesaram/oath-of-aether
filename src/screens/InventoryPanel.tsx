import { useState } from "react";
import { CONSUMABLES } from "../data/items";
import { GRADE_COLORS, GRADE_LABELS } from "../data/grades";
import type { PlayerInventory } from "../types";

interface Props {
  inventory: PlayerInventory;
  onUse: (itemId: string) => void;
  /** 전투 중이 아니면 마나 포션은 비활성화 표시 (오버월드에는 마나가 없으므로) */
  manaUsable?: boolean;
  /** 전투 화면처럼 좁은 공간에서 쓸 때 (항상 펼쳐진 상태, 접기 버튼 없음) */
  compact?: boolean;
}

/** 소지 중인 포션을 보여주고 "사용" 버튼으로 바로 쓸 수 있는 인벤토리 패널. */
export function InventoryPanel({ inventory, onUse, manaUsable = true, compact = false }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const owned = CONSUMABLES.filter((c) => (inventory[c.id] ?? 0) > 0);

  const body = (
    <div className={`inventory-list${compact ? " compact" : ""}`}>
      {owned.length === 0 ? (
        <p className="login-hint">보유한 아이템이 없습니다.</p>
      ) : (
        owned.map((item) => {
          const disabled = item.kind === "manaPotion" && !manaUsable;
          return (
            <div key={item.id} className="inventory-row">
              <span className="inventory-item-name" style={{ color: GRADE_COLORS[item.grade] }}>
                [{GRADE_LABELS[item.grade]}] {item.name}
              </span>
              <span className="inventory-item-count">x{inventory[item.id]}</span>
              <button
                type="button"
                className="btn-secondary tiny"
                disabled={disabled}
                title={disabled ? "전투 중에만 사용할 수 있습니다" : item.description}
                onClick={() => onUse(item.id)}
              >
                사용
              </button>
            </div>
          );
        })
      )}
    </div>
  );

  if (compact) {
    return <div className="inventory-panel compact">{body}</div>;
  }

  return (
    <div className={`inventory-panel${collapsed ? " collapsed" : ""}`}>
      <div className="inventory-panel-header" onClick={() => setCollapsed((c) => !c)}>
        <span>🎒 인벤토리 {owned.length > 0 ? `(${owned.length})` : ""}</span>
        <span className="party-panel-toggle">{collapsed ? "▲" : "▼"}</span>
      </div>
      {!collapsed && <div className="inventory-panel-body">{body}</div>}
    </div>
  );
}
