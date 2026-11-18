// 탑뷰 도트 그래픽 캐릭터 렌더링
//
// 실제 이미지 에셋 없이, 캔버스에 작은 픽셀 그리드를 직접 그려서
// "도트 캐릭터"처럼 보이도록 합니다. 16(가로) x 18(세로) 유닛 그리드를
// 기준으로 좌표를 잡고, 캔버스를 정수배로 확대해 각지게(pixelated) 표시합니다.

export type Direction = "down" | "up" | "left" | "right";
export type CharKind = "warrior" | "priest" | "mage" | "archer" | "rogue" | "bard";
export type MonsterKind = "forest_slime" | "goblin_raider" | "forest_guardian" | "ice_wraith" | "lava_golem";

export const SPRITE_UNIT_W = 16;
export const SPRITE_UNIT_H = 18;

interface CharPalette {
  skin: string;
  hair: string;
  outfit: string;
  accent: string;
  weapon: string;
  outline: string;
}

const CHAR_PALETTES: Record<CharKind, CharPalette> = {
  warrior: {
    skin: "#e8b98a",
    hair: "#5c3a21",
    outfit: "#5a6b7a",
    accent: "#b33a3a",
    weapon: "#d7d7e0",
    outline: "#1b1d2b",
  },
  priest: {
    skin: "#e8b98a",
    hair: "#e8d9a0",
    outfit: "#eae3cf",
    accent: "#d4af6a",
    weapon: "#d4af6a",
    outline: "#2b2820",
  },
  mage: {
    skin: "#e8b98a",
    hair: "#2a2a35",
    outfit: "#5b3d8a",
    accent: "#6fb3ff",
    weapon: "#6fb3ff",
    outline: "#15121f",
  },
  archer: {
    skin: "#e8b98a",
    hair: "#7a4a2a",
    outfit: "#3f6b4a",
    accent: "#7a5a3a",
    weapon: "#7a5a3a",
    outline: "#15201a",
  },
  rogue: {
    skin: "#e8b98a",
    hair: "#1f1f26",
    outfit: "#3a3a44",
    accent: "#7a2d3a",
    weapon: "#c9c9d4",
    outline: "#0f0f16",
  },
  bard: {
    skin: "#e8b98a",
    hair: "#c9a227",
    outfit: "#8a3f6b",
    accent: "#2fa6a0",
    weapon: "#e8c547",
    outline: "#241a28",
  },
};

interface MonsterPalette {
  body: string;
  shade: string;
  eye: string;
  accent: string;
}

const MONSTER_PALETTES: Record<MonsterKind, MonsterPalette> = {
  forest_slime: { body: "#6fcf61", shade: "#4a9e40", eye: "#1b1d2b", accent: "#bdf0b4" },
  goblin_raider: { body: "#7a8a4a", shade: "#566035", eye: "#d8304a", accent: "#6b4a2e" },
  forest_guardian: { body: "#6b4a2e", shade: "#3f2d1c", eye: "#8ff0e8", accent: "#4a7a3a" },
  ice_wraith: { body: "#aee4f0", shade: "#6fb6cc", eye: "#1b3a4a", accent: "#e8fbff" },
  lava_golem: { body: "#4a3228", shade: "#2a1c16", eye: "#ff8a3d", accent: "#ff5a2e" },
};

function px(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

/**
 * 플레이어 직업 캐릭터를 그린다.
 * frame: 0 또는 1 (걷기 2프레임), moving이 false면 항상 0(서있는 포즈)
 */
export function drawCharacter(
  ctx: CanvasRenderingContext2D,
  kind: CharKind,
  direction: Direction,
  frame: 0 | 1
) {
  const p = CHAR_PALETTES[kind];
  ctx.clearRect(0, 0, SPRITE_UNIT_W, SPRITE_UNIT_H);

  // 그림자
  px(ctx, 4, 16, 8, 1, "rgba(0,0,0,0.35)");

  // 머리카락(뒤통수) - 뒤를 볼 때는 얼굴 없이 전부 머리카락
  if (direction === "up") {
    px(ctx, 5, 0, 6, 6, p.hair);
  } else {
    px(ctx, 5, 0, 6, 2, p.hair);
    px(ctx, 5, 2, 6, 4, p.skin);
    if (direction === "down") {
      px(ctx, 6, 3, 1, 1, p.outline);
      px(ctx, 9, 3, 1, 1, p.outline);
    } else if (direction === "left") {
      px(ctx, 6, 3, 1, 1, p.outline);
    } else if (direction === "right") {
      px(ctx, 9, 3, 1, 1, p.outline);
    }
  }

  // 몸통
  px(ctx, 4, 6, 8, 5, p.outfit);
  px(ctx, 4, 9, 8, 1, p.accent);

  // 팔 (살짝 좌우 비대칭으로 입체감)
  px(ctx, 2, 6, 2, 4, p.outfit);
  px(ctx, 12, 6, 2, 4, p.outfit);

  // 무기/상징물 (직업별, 뒤를 볼 때는 생략)
  if (direction !== "up") {
    const side = direction === "left" ? 1 : 13;
    if (kind === "warrior") {
      px(ctx, side, 4, 1, 8, p.weapon);
    } else if (kind === "mage") {
      px(ctx, side, 2, 1, 9, p.weapon);
      px(ctx, side - 1, 1, 3, 2, p.accent);
    } else if (kind === "priest") {
      px(ctx, side, 5, 1, 3, p.weapon);
      px(ctx, side - 1, 6, 3, 1, p.weapon);
    } else if (kind === "archer") {
      px(ctx, side, 3, 1, 8, p.weapon);
    } else if (kind === "rogue") {
      px(ctx, side, 7, 1, 4, p.weapon);
    } else if (kind === "bard") {
      px(ctx, side - (direction === "left" ? 1 : 0), 6, 2, 3, p.weapon);
      px(ctx, side - (direction === "left" ? 1 : 0), 6, 2, 1, p.accent);
    }
  }

  // 다리 (걷기 2프레임: 좌우 다리가 번갈아 앞으로/뒤로 벌어지며 걷는 것처럼 보이게 함.
  // 가만히 있을 때(frame 0)는 다리가 몸통 아래 가운데에 모여 있고, 걸을 때는
  // 가로로도 벌어지고(scissor) 높이도 번갈아 바뀌어서 실제로 다리가 교차하는
  // 느낌을 준다.
  const legColor = p.outline;
  if (frame === 0) {
    px(ctx, 5, 11, 2, 4, legColor);
    px(ctx, 9, 11, 2, 5, legColor);
  } else {
    px(ctx, 4, 11, 2, 5, legColor);
    px(ctx, 10, 11, 2, 4, legColor);
  }
}

export function drawMonster(ctx: CanvasRenderingContext2D, kind: MonsterKind, frame: 0 | 1) {
  const p = MONSTER_PALETTES[kind];
  ctx.clearRect(0, 0, SPRITE_UNIT_W, SPRITE_UNIT_H);
  px(ctx, 4, 16, 8, 1, "rgba(0,0,0,0.35)");

  if (kind === "forest_slime") {
    const squish = frame === 1;
    const w = squish ? 12 : 10;
    const h = squish ? 6 : 8;
    const x = (SPRITE_UNIT_W - w) / 2;
    const y = 15 - h;
    px(ctx, x, y, w, h, p.body);
    px(ctx, x + 1, y + h - 2, w - 2, 2, p.shade);
    px(ctx, x + 2, y + 2, 2, 2, p.accent);
    px(ctx, x + w - 2, y + h - 4, 1, 1, p.eye);
    px(ctx, x + 2, y + h - 4, 1, 1, p.eye);
  } else if (kind === "goblin_raider") {
    const bob = frame === 1 ? 1 : 0;
    // 몸
    px(ctx, 4, 7 + bob, 8, 6, p.body);
    // 귀
    px(ctx, 2, 5 + bob, 2, 2, p.body);
    px(ctx, 12, 5 + bob, 2, 2, p.body);
    // 얼굴
    px(ctx, 5, 8 + bob, 2, 2, p.eye);
    px(ctx, 9, 8 + bob, 2, 2, p.eye);
    // 누더기 옷
    px(ctx, 4, 11 + bob, 8, 2, p.accent);
    // 다리
    px(ctx, 5, 13 + bob, 2, 3, p.shade);
    px(ctx, 9, 13 + bob, 2, 3, p.shade);
    // 곤봉
    px(ctx, 13, 3 + bob, 1, 7, p.accent);
    px(ctx, 12, 2 + bob, 3, 2, p.shade);
  } else if (kind === "forest_guardian") {
    const bob = frame === 1 ? 1 : 0;
    // 거대한 몸통 (나무/바위 혼합 실루엣)
    px(ctx, 2, 5 + bob, 12, 9, p.body);
    px(ctx, 1, 6 + bob, 1, 7, p.shade);
    px(ctx, 14, 6 + bob, 1, 7, p.shade);
    // 어깨의 이끼/나뭇잎
    px(ctx, 1, 3 + bob, 5, 3, p.accent);
    px(ctx, 10, 3 + bob, 5, 3, p.accent);
    // 균열/질감
    px(ctx, 5, 9 + bob, 1, 4, p.shade);
    px(ctx, 10, 8 + bob, 1, 4, p.shade);
    // 빛나는 눈
    px(ctx, 5, 7 + bob, 2, 2, p.eye);
    px(ctx, 9, 7 + bob, 2, 2, p.eye);
    // 다리
    px(ctx, 4, 14 + bob, 3, 2, p.shade);
    px(ctx, 9, 14 + bob, 3, 2, p.shade);
  } else if (kind === "ice_wraith") {
    const drift = frame === 1 ? 1 : 0;
    // 둥둥 떠다니는 서리 망토 형태 (다리 없음)
    px(ctx, 3, 4 + drift, 10, 8, p.body);
    px(ctx, 2, 10 + drift, 2, 4, p.body);
    px(ctx, 12, 10 + drift, 2, 4, p.body);
    px(ctx, 5, 12 + drift, 6, 3, p.accent);
    // 냉기 입자
    px(ctx, 1, 2 + drift, 1, 1, p.accent);
    px(ctx, 14, 3 + drift, 1, 1, p.accent);
    // 빛나는 눈
    px(ctx, 5, 6 + drift, 2, 2, p.eye);
    px(ctx, 9, 6 + drift, 2, 2, p.eye);
    // 가장자리 음영
    px(ctx, 3, 9 + drift, 10, 1, p.shade);
  } else if (kind === "lava_golem") {
    const bob = frame === 1 ? 1 : 0;
    // 육중한 돌/용암 몸통
    px(ctx, 3, 5 + bob, 10, 7, p.body);
    px(ctx, 2, 7 + bob, 2, 4, p.body);
    px(ctx, 12, 7 + bob, 2, 4, p.body);
    // 갈라진 틈 사이로 보이는 용암(가슴 화구 + 균열)
    px(ctx, 6, 7 + bob, 4, 3, p.accent);
    px(ctx, 4, 6 + bob, 1, 1, p.accent);
    px(ctx, 11, 9 + bob, 1, 1, p.accent);
    // 눈
    px(ctx, 5, 6 + bob, 2, 1, p.eye);
    px(ctx, 9, 6 + bob, 2, 1, p.eye);
    // 다리
    px(ctx, 4, 12 + bob, 3, 3, p.shade);
    px(ctx, 9, 12 + bob, 3, 3, p.shade);
  }
}
