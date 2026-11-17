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
 * 2) 실루엣 바깥 둘레에 1px 짙은 외곽선을 둘러 윤곽을 또렷하게 만든다.
 * 각 직업/몬스터의 개별 픽셀아트를 건드리지 않고도 전체적으로 덜 밋밋하게 보이게 한다.
 */
function polishSprite(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // 1) 음영 (실루엣 내부에만 적용되도록 source-atop 사용)
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "rgba(255,255,255,0.22)");
  grad.addColorStop(0.45, "rgba(255,255,255,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.28)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // 2) 외곽선 (실루엣 알파를 읽어 인접 투명 픽셀에만 어두운 색을 둘러줌)
  const img = ctx.getImageData(0, 0, w, h);
  const data = img.data;
  const isOpaque = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    return data[(y * w + x) * 4 + 3] > 10;
  };
  ctx.save();
  ctx.globalCompositeOperation = "destination-over";
  ctx.fillStyle = "rgba(8,9,16,0.9)";
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (isOpaque(x, y)) continue;
      if (isOpaque(x - 1, y) || isOpaque(x + 1, y) || isOpaque(x, y - 1) || isOpaque(x, y + 1)) {
        ctx.fillRect(x, y, 1, 1);
      }
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
