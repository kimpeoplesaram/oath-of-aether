import { useState } from "react";
import { CONSUMABLES } from "../data/items";
import { GRADE_COLORS, GRADE_LABELS } from "../data/grades";

interface Props {
  gold: number;
  onBuy: (itemId: string) => void;
}

/** 오버월드에서 열 수 있는 상점. 골드로 포션을 구매한다. */
export function ShopPanel({ gold, onBuy }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="shop-panel-anchor">
      <button type="button" className="shop-toggle-btn" onClick={() => setOpen((o) => !o)}>
        🛒 상점
      </button>
      {open && (
        <div className="shop-panel">
          <div className="shop-panel-header">
            <span>🛒 물약 상점</span>
            <span className="shop-gold">💰 {gold} G</span>
            <button type="button" className="shop-close-btn" onClick={() => setOpen(false)}>
              ✕
            </button>
          </div>
          <div className="shop-list">
            {CONSUMABLES.map((item) => {
              const affordable = gold >= item.price;
              return (
                <div key={item.id} className="shop-row">
                  <div className="shop-item-info">
                    <span className="shop-item-name" style={{ color: GRADE_COLORS[item.grade] }}>
                      [{GRADE_LABELS[item.grade]}] {item.name}
                    </span>
                    <span className="shop-item-desc">{item.description}</span>
                  </div>
                  <button
                    type="button"
                    className="btn-secondary tiny"
                    disabled={!affordable}
                    title={affordable ? "구매" : "골드가 부족합니다"}
                    onClick={() => onBuy(item.id)}
                  >
                    {item.price} G
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
