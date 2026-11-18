import { useState } from "react";
import { CONSUMABLES } from "../data/items";
import { getEquipment } from "../data/equipment";
import { GRADE_COLORS, GRADE_LABELS, GRADE_SELL_PRICE } from "../data/grades";
import { RANK_COLORS, computePowerRank } from "../data/powerRank";
import type { EquipmentStashEntry } from "../types";

interface Props {
  gold: number;
  onBuy: (itemId: string) => void;
  equipmentInventory: EquipmentStashEntry[];
  onSellEquipment: (instanceId: string) => void;
}

type Tab = "buy" | "sell";

/** 오버월드에서 열 수 있는 상점. 골드로 포션을 구매하거나, 여분 장비를 팔아 골드를 얻는다. */
export function ShopPanel({ gold, onBuy, equipmentInventory, onSellEquipment }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("buy");

  return (
    <div className="shop-panel-anchor">
      <button type="button" className="shop-toggle-btn" onClick={() => setOpen((o) => !o)}>
        🛒 상점
      </button>
      {open && (
        <div className="shop-panel">
          <div className="shop-panel-header">
            <span>🛒 상점</span>
            <span className="shop-gold">💰 {gold} G</span>
            <button type="button" className="shop-close-btn" onClick={() => setOpen(false)}>
              ✕
            </button>
          </div>
          <div className="shop-tabs">
            <button
              type="button"
              className={`shop-tab-btn${tab === "buy" ? " active" : ""}`}
              onClick={() => setTab("buy")}
            >
              구매
            </button>
            <button
              type="button"
              className={`shop-tab-btn${tab === "sell" ? " active" : ""}`}
              onClick={() => setTab("sell")}
            >
              판매 {equipmentInventory.length > 0 ? `(${equipmentInventory.length})` : ""}
            </button>
          </div>
          <div className="shop-list">
            {tab === "buy" &&
              CONSUMABLES.map((item) => {
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
            {tab === "sell" &&
              (equipmentInventory.length === 0 ? (
                <p className="login-hint">판매할 여분 장비가 없습니다.</p>
              ) : (
                equipmentInventory.map((entry) => {
                  const item = getEquipment(entry.itemId);
                  if (!item) return null;
                  const price = Math.round(GRADE_SELL_PRICE[item.grade] * (0.5 + entry.quality / 100));
                  const rank = computePowerRank(item.grade, entry.quality);
                  return (
                    <div key={entry.instanceId} className="shop-row">
                      <div className="shop-item-info">
                        <span className="shop-item-name">
                          <span style={{ color: RANK_COLORS[rank], fontWeight: 700 }}>[{rank}]</span>{" "}
                          <span style={{ color: GRADE_COLORS[item.grade] }}>
                            [{GRADE_LABELS[item.grade]}] {item.name}
                          </span>
                        </span>
                        <span className="shop-item-desc">품질 {entry.quality}</span>
                      </div>
                      <button
                        type="button"
                        className="btn-secondary tiny"
                        onClick={() => onSellEquipment(entry.instanceId)}
                      >
                        {price} G 판매
                      </button>
                    </div>
                  );
                })
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
