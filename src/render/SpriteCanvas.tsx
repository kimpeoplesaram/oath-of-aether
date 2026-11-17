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

function useCanvasDraw(draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    draw(ctx);
  });
  return canvasRef;
}

export function CharacterSprite({ kind, direction, moving, flip, scale = 6, className }: CharacterProps) {
  const frame = useWalkFrame(moving, 220);
  const canvasRef = useCanvasDraw((ctx) => drawCharacter(ctx, kind, direction, frame));

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
  const canvasRef = useCanvasDraw((ctx) => drawMonster(ctx, kind, frame));

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
