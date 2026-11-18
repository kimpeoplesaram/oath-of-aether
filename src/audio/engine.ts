// 게임 전체 배경음악(BGM) + 효과음(SFX) 엔진.
// 외부 오디오 파일을 전혀 쓰지 않고 Web Audio API의 오실레이터로 모든 소리를
// 그 자리에서 합성한다 (네트워크/에셋 다운로드가 필요 없고, 픽셀 아트 톤과도 잘 어울린다).

export type SfxKind =
  | "attack"
  | "crit"
  | "dodge"
  | "hitTaken"
  | "miss"
  | "heal"
  | "mana"
  | "buff"
  | "debuff"
  | "victory"
  | "defeat"
  | "flee"
  | "levelUp"
  | "click"
  | "warn";

export type BgmTrack = "none" | "title" | "overworld" | "combat" | "boss";

const STORAGE_KEY = "oath_audio_settings_v1";

interface AudioSettings {
  muted: boolean;
  volume: number; // 0..1
}

function loadSettings(): AudioSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        muted: !!parsed.muted,
        volume: typeof parsed.volume === "number" ? parsed.volume : 0.5,
      };
    }
  } catch {
    /* ignore */
  }
  return { muted: false, volume: 0.5 };
}

function saveSettings(s: AudioSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

let settings = loadSettings();
let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
let bgmGain: GainNode | null = null;

function ensureContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    const created: AudioContext = new AC();
    ctx = created;
    const mg = created.createGain();
    mg.gain.value = settings.muted ? 0 : settings.volume;
    mg.connect(created.destination);
    masterGain = mg;
    const sg = created.createGain();
    sg.gain.value = 0.9;
    sg.connect(mg);
    sfxGain = sg;
    const bg = created.createGain();
    bg.gain.value = 0.55;
    bg.connect(mg);
    bgmGain = bg;
  }
  return ctx;
}

/** 첫 사용자 클릭/터치 시 호출해 브라우저 자동재생 정책을 해제한다. */
export function unlockAudio() {
  const c = ensureContext();
  if (c && c.state === "suspended") {
    c.resume().catch(() => {});
  }
}

export function isMuted() {
  return settings.muted;
}

export function getVolume() {
  return settings.volume;
}

export function setMuted(muted: boolean) {
  settings = { ...settings, muted };
  saveSettings(settings);
  if (masterGain) masterGain.gain.value = muted ? 0 : settings.volume;
}

export function toggleMuted() {
  setMuted(!settings.muted);
  return settings.muted;
}

export function setVolume(volume: number) {
  const v = Math.max(0, Math.min(1, volume));
  settings = { ...settings, volume: v };
  saveSettings(settings);
  if (masterGain && !settings.muted) masterGain.gain.value = v;
}

// ---------- SFX ----------

type WaveType = "sine" | "square" | "triangle" | "sawtooth";

function tone(
  dest: AudioNode,
  startAt: number,
  freq: number,
  durationSec: number,
  type: WaveType = "sine",
  peakGain = 0.25,
  slideTo?: number
) {
  const c = ctx!;
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startAt);
  if (slideTo) osc.frequency.linearRampToValueAtTime(slideTo, startAt + durationSec);
  const g = c.createGain();
  g.gain.setValueAtTime(0, startAt);
  g.gain.linearRampToValueAtTime(peakGain, startAt + Math.min(0.02, durationSec * 0.25));
  g.gain.exponentialRampToValueAtTime(0.001, startAt + durationSec);
  osc.connect(g);
  g.connect(dest);
  osc.start(startAt);
  osc.stop(startAt + durationSec + 0.02);
}

export function playSfx(kind: SfxKind) {
  const c = ensureContext();
  if (!c || !sfxGain) return;
  if (c.state === "suspended") c.resume().catch(() => {});
  const t = c.currentTime;

  switch (kind) {
    case "attack":
      tone(sfxGain, t, 300, 0.09, "square", 0.22, 180);
      break;
    case "crit":
      tone(sfxGain, t, 220, 0.14, "square", 0.3, 480);
      tone(sfxGain, t + 0.05, 660, 0.12, "triangle", 0.22);
      break;
    case "dodge":
      tone(sfxGain, t, 700, 0.1, "sine", 0.18, 1000);
      tone(sfxGain, t + 0.06, 500, 0.08, "sine", 0.12, 800);
      break;
    case "hitTaken":
      tone(sfxGain, t, 160, 0.16, "sawtooth", 0.26, 70);
      break;
    case "miss":
      tone(sfxGain, t, 500, 0.08, "sine", 0.1, 400);
      break;
    case "heal":
      tone(sfxGain, t, 440, 0.1, "sine", 0.18, 660);
      tone(sfxGain, t + 0.09, 660, 0.14, "sine", 0.16, 880);
      break;
    case "mana":
      tone(sfxGain, t, 523, 0.09, "triangle", 0.16, 784);
      tone(sfxGain, t + 0.08, 784, 0.12, "triangle", 0.14, 1046);
      break;
    case "buff":
      tone(sfxGain, t, 520, 0.08, "triangle", 0.16);
      tone(sfxGain, t + 0.07, 780, 0.1, "triangle", 0.16);
      break;
    case "debuff":
      tone(sfxGain, t, 300, 0.18, "sawtooth", 0.18, 160);
      break;
    case "victory":
      tone(sfxGain, t, 523, 0.14, "triangle", 0.22);
      tone(sfxGain, t + 0.13, 659, 0.14, "triangle", 0.22);
      tone(sfxGain, t + 0.26, 784, 0.22, "triangle", 0.24);
      break;
    case "defeat":
      tone(sfxGain, t, 330, 0.18, "sine", 0.2, 220);
      tone(sfxGain, t + 0.17, 220, 0.24, "sine", 0.18, 140);
      break;
    case "flee":
      tone(sfxGain, t, 500, 0.14, "sine", 0.16, 150);
      break;
    case "levelUp":
      tone(sfxGain, t, 523, 0.1, "square", 0.2);
      tone(sfxGain, t + 0.09, 659, 0.1, "square", 0.2);
      tone(sfxGain, t + 0.18, 784, 0.1, "square", 0.2);
      tone(sfxGain, t + 0.27, 1046, 0.2, "square", 0.22);
      break;
    case "click":
      tone(sfxGain, t, 900, 0.03, "square", 0.1);
      break;
    case "warn":
      tone(sfxGain, t, 760, 0.07, "square", 0.14);
      break;
  }
}

// ---------- BGM ----------
// 간단한 룩어헤드 스케줄러로 짧은 멜로디 루프를 재생한다.

interface Pattern {
  bpm: number;
  // [주파수(Hz, null=쉼), 박자(단위: 16분음표 개수)]
  notes: [number | null, number][];
  wave: WaveType;
  baseGain: number;
}

const PATTERNS: Record<Exclude<BgmTrack, "none">, Pattern> = {
  title: {
    bpm: 84,
    wave: "triangle",
    baseGain: 0.14,
    notes: [
      [392, 4], [440, 4], [494, 4], [440, 4],
      [392, 4], [330, 4], [392, 8],
      [440, 4], [494, 4], [523, 4], [494, 4],
      [440, 4], [392, 4], [349, 8],
    ],
  },
  overworld: {
    bpm: 108,
    wave: "triangle",
    baseGain: 0.14,
    notes: [
      [330, 3], [392, 3], [440, 2], [392, 4],
      [330, 3], [294, 3], [330, 2], [392, 4],
      [349, 3], [392, 3], [440, 2], [494, 4],
      [440, 3], [392, 3], [349, 2], [330, 4],
    ],
  },
  combat: {
    bpm: 150,
    wave: "square",
    baseGain: 0.11,
    notes: [
      [220, 2], [220, 2], [330, 2], [220, 2],
      [262, 2], [262, 2], [330, 2], [294, 2],
      [220, 2], [220, 2], [349, 2], [330, 2],
      [294, 2], [262, 2], [330, 2], [220, 2],
    ],
  },
  boss: {
    bpm: 168,
    wave: "sawtooth",
    baseGain: 0.1,
    notes: [
      [196, 2], [196, 2], [233, 2], [196, 2],
      [220, 2], [196, 2], [233, 2], [247, 2],
      [196, 2], [233, 2], [277, 2], [233, 2],
      [247, 2], [233, 2], [196, 2], [185, 2],
    ],
  },
};

let currentTrack: BgmTrack = "none";
let schedulerId: ReturnType<typeof setInterval> | null = null;
let nextNoteTime = 0;
let noteCursor = 0;

function scheduleNote(pattern: Pattern, time: number, steps: number) {
  const [freq, beats] = pattern.notes[noteCursor % pattern.notes.length];
  const stepSec = 60 / pattern.bpm / 4; // 16분음표 길이
  const durationSec = stepSec * beats * 0.92;
  if (freq && bgmGain) {
    tone(bgmGain, time, freq, durationSec, pattern.wave, pattern.baseGain);
  }
  noteCursor += 1;
  return stepSec * beats;
}

function schedulerTick() {
  const c = ctx;
  if (!c || currentTrack === "none") return;
  const pattern = PATTERNS[currentTrack];
  const lookahead = 0.6;
  while (nextNoteTime < c.currentTime + lookahead) {
    const stepDur = scheduleNote(pattern, nextNoteTime, 1);
    nextNoteTime += stepDur;
  }
}

export function startBgm(track: BgmTrack) {
  if (track === currentTrack) return;
  const c = ensureContext();
  if (!c) return;
  currentTrack = track;
  noteCursor = 0;
  nextNoteTime = c.currentTime + 0.05;
  if (schedulerId) clearInterval(schedulerId);
  if (track === "none") {
    schedulerId = null;
    return;
  }
  schedulerTick();
  schedulerId = setInterval(schedulerTick, 120);
}

export function stopBgm() {
  startBgm("none");
}
