import { useMemo } from "react";
import type { BurstKind } from "../combat/effects";

const SHARD_COLORS: Record<BurstKind, string> = {
  hit: "#ffd27a",
  crit: "#ff9b3d",
  heal: "#7de38b",
};

const RING_COLORS: Record<BurstKind, string> = {
  hit: "rgba(255,255,255,0.85)",
  crit: "rgba(255,170,70,0.95)",
  heal: "rgba(130,255,170,0.85)",
};

/**
 * 타격 순간 터지는 파편 + 충격파 링. 한 번 마운트되면 CSS 애니메이션이 끝나고
 * 부모(effects.ts의 triggerBurst)가 알아서 목록에서 제거해 언마운트한다.
 */
export function HitBurst({ kind }: { kind: BurstKind; key?: number | string }) {
  const shardCount = kind === "crit" ? 10 : 6;
  const shards = useMemo(
    () =>
      Array.from({ length: shardCount }).map((_, i) => {
        const angle = (360 / shardCount) * i + (Math.random() * 20 - 10);
        const dist = (kind === "crit" ? 44 : 30) + Math.random() * 16;
        return { id: i, angle, dist };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <>
      <div className="hit-ring" style={{ ["--ring-color" as any]: RING_COLORS[kind] }} />
      <div className={`hit-burst${kind === "crit" ? " crit" : ""}`} style={{ ["--shard-color" as any]: SHARD_COLORS[kind] }}>
        {shards.map((s: { id: number; angle: number; dist: number }) => (
          <span
            key={s.id}
            className="shard"
            style={{ ["--ang" as any]: `${s.angle}deg`, ["--dist" as any]: `${s.dist}px` }}
          />
        ))}
      </div>
    </>
  );
}
