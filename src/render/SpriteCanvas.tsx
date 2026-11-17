import { useEffect, useRef, useState } from "react";
import {
  drawCharacter,
  drawMonster,
  SPRITE_UNIT_H,
  SPRITE_UNIT_W,
  type CharKind,
  type Direction,
  type MonsterKind,
} from "./sprites";

interface BaseProps {
  scale?: number; // 픽셀 확대 배율 (기본 6)
  moving?: boolean; // 걷는 중이면 true (다리 애니메이션)
  flip?: boolean; // 좌우 반전 (전투 화면에서 몬스터를 플레이어 쪽으로 바라보게)
  className?: string;
}

interface CharacterProps extends BaseProps {
  kind: CharKind;
  direction: Direction;
}

interface MonsterProps extends BaseProps {
  kind: MonsterKind;
}

/** moving이 true인 동안 0/1을 번갈아 내보내는 걷기 애니메이션 프레임 */
function useWalkFrame(moving: boolean | undefined, intervalMs: number): 0 | 1 {
  const [frame, setFrame] = useState<0 | 1>(0);
  useEffect(() => {
    if (!moving) {
      setFrame(0);
      return;
    }
    const id = setInterval(() => {
      setFrame((f) => (f === 0 ? 1 : 0));
    }, intervalMs);
    return () => clearInterval(id);
  }, [moving, intervalMs]);
  return frame;
}

/**
 * 그려진 스프라이트에 입체감을 더하는 후처리.
 * 1) 위는 밝고 아래는 어두운 그라데이션을 실루엣 안쪽에만 입혀 단색 블록에 음영을 준다.
 * 2) 실루엣의 맨 윗부분에 얇은 하이라이트(스페큘러)를 더해 광택을 준다.
 * 3) 실루엣 바깥 둘레에 1px 외곽선을 둘러 윤곽을 또렷하게 만든다. 순수 검정 대신
 *    스프라이트 자신의 주조색을 짙게 눌러 만든 색을 써서(색상별 아웃라인) 더
 *    정교하고 따뜻한 인상을 준다 — 많은 모던 픽셀아트 게임이 쓰는 기법이다.
 * 각 직업/몬스터의 개별 픽셀아트를 건드리지 않고도 전체적으로 더 다듬어 보이게 한다.
 */
function polishSprite(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // 1) 음영 (실루엣 내부에만 적용되도록 source-atop 사용)
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "rgba(255,255,255,0.3)");
  grad.addColorStop(0.22, "rgba(255,255,255,0.08)");
  grad.addColorStop(0.5, "rgba(255,255,255,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.32)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  const img = ctx.getImageData(0, 0, w, h);
  const data = img.data;
  const isOpaque = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    return data[(y * w + x) * 4 + 3] > 10;
  };

  // 2) 실루엣에서 가장 많이 쓰인 불투명 색을 찾아 외곽선 색으로 어둡게 눌러 쓴다.
  const counts = new Map<string, number>();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] <= 10) continue;
    const key = `${data[i]},${data[i + 1]},${data[i + 2]}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let dominant = "8,9,16";
  let best = -1;
  for (const [key, c] of counts) {
    if (c > best) {
      best = c;
      dominant = key;
    }
  }
  const [dr, dg, db] = dominant.split(",").map(Number);
  const outlineColor = `rgba(${Math.round(dr * 0.28)}, ${Math.round(dg * 0.28)}, ${Math.round(db * 0.32)}, 0.92)`;

  // 3) 외곽선 (인접 투명 픽셀에만 어두운 주조색을 둘러줌)
  ctx.save();
  ctx.globalCompositeOperation = "destination-over";
  ctx.fillStyle = outlineColor;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (isOpaque(x, y)) continue;
      if (isOpaque(x - 1, y) || isOpaque(x + 1, y) || isOpaque(x, y - 1) || isOpaque(x, y + 1)) {
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  ctx.restore();

  // 4) 맨 위 1px 라인에 얇은 하이라이트를 더해 광택 있는 느낌을 준다.
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  for (let x = 0; x < w; x++) {
    if (isOpaque(x, 0) || (isOpaque(x, 1) && !isOpaque(x, 0))) {
      ctx.fillRect(x, isOpaque(x, 0) ? 0 : 1, 1, 1);
    }
  }
  ctx.restore();
}

function useCanvasDraw(draw: (ctx: CanvasRenderingContext2D) => void, w: number, h: number) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    draw(ctx);
    polishSprite(ctx, w, h);
  });
  return canvasRef;
}

export function CharacterSprite({ kind, direction, moving, flip, scale = 6, className }: CharacterProps) {
  const frame = useWalkFrame(moving, 220);
  const canvasRef = useCanvasDraw((ctx) => drawCharacter(ctx, kind, direction, frame), SPRITE_UNIT_W, SPRITE_UNIT_H);

  return (
    <canvas
      ref={canvasRef}
      width={SPRITE_UNIT_W}
      height={SPRITE_UNIT_H}
      className={className}
      style={{
        width: SPRITE_UNIT_W * scale,
        height: SPRITE_UNIT_H * scale,
        imageRendering: "pixelated",
        transform: flip ? "scaleX(-1)" : undefined,
      }}
    />
  );
}

export function MonsterSprite({ kind, moving = true, flip, scale = 6, className }: MonsterProps) {
  const frame = useWalkFrame(moving, 650);
  const canvasRef = useCanvasDraw((ctx) => drawMonster(ctx, kind, frame), SPRITE_UNIT_W, SPRITE_UNIT_H);

  return (
    <canvas
      ref={canvasRef}
      width={SPRITE_UNIT_W}
      height={SPRITE_UNIT_H}
      className={className}
      style={{
        width: SPRITE_UNIT_W * scale,
        height: SPRITE_UNIT_H * scale,
        imageRendering: "pixelated",
        transform: flip ? "scaleX(-1)" : undefined,
      }}
    />
  );
}
