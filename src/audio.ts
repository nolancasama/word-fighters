// Tiny synthesized sound effects (Web Audio) and optional text-to-speech.
// Nothing here is required for play: every call is a safe no-op if audio is unavailable.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
try {
  muted = localStorage.getItem("wf.muted") === "1";
} catch {
  /* storage may be blocked */
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(m: boolean): void {
  muted = m;
  try {
    localStorage.setItem("wf.muted", m ? "1" : "0");
  } catch {
    /* ignore */
  }
  if (master) master.gain.value = m ? 0 : 0.5;
  if (m) stopSpeech();
}

/** Call from a user gesture so the browser lets audio start. */
export function unlockAudio(): void {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    ctx = null;
  }
}

function tone(freq: number, dur: number, type: OscillatorType = "sine", vol = 0.3, slideTo?: number, delay = 0): void {
  if (!ctx || !master || muted) return;
  const t0 = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function noise(dur: number, vol = 0.2, delay = 0): void {
  if (!ctx || !master || muted) return;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.value = vol;
  const f = ctx.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 1400;
  src.connect(f).connect(g).connect(master);
  src.start(ctx.currentTime + delay);
}

export const sfx = {
  move: () => tone(520, 0.04, "square", 0.05),
  rotate: () => tone(700, 0.05, "triangle", 0.12, 900),
  land: () => tone(160, 0.08, "sine", 0.25, 90),
  clear: (chain: number) => {
    const base = 440 * Math.pow(1.19, chain - 1);
    tone(base, 0.12, "triangle", 0.25);
    tone(base * 1.25, 0.12, "triangle", 0.22, undefined, 0.07);
    tone(base * 1.5, 0.18, "triangle", 0.2, undefined, 0.14);
    noise(0.15, 0.08);
  },
  match: () => {
    [660, 830, 990, 1320].forEach((f, i) => tone(f, 0.14, "sine", 0.22, undefined, i * 0.07));
  },
  wrong: () => tone(300, 0.18, "sine", 0.12, 240),
  hit: () => {
    noise(0.12, 0.25);
    tone(200, 0.12, "square", 0.08, 80);
  },
  warn: () => {
    tone(880, 0.09, "square", 0.08);
    tone(660, 0.09, "square", 0.08, undefined, 0.12);
  },
  garbage: () => {
    tone(120, 0.18, "sawtooth", 0.12, 70);
    noise(0.1, 0.12);
  },
  blast: () => {
    tone(300, 0.5, "sawtooth", 0.12, 1200);
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.2, "triangle", 0.2, undefined, 0.3 + i * 0.06));
  },
  win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.25, "triangle", 0.22, undefined, i * 0.12)),
  lose: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, "sine", 0.2, undefined, i * 0.18)),
  tap: () => tone(600, 0.05, "sine", 0.12)
};

// ---- Text-to-speech: optional, rate-limited, never awaited by gameplay.
let lastSpeak = 0;
export function speakWord(word: string): void {
  if (muted) return;
  try {
    const synth = window.speechSynthesis;
    if (!synth || typeof SpeechSynthesisUtterance === "undefined") return;
    const now = performance.now();
    if (now - lastSpeak < 700) return;
    lastSpeak = now;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(word);
    u.lang = "en-US";
    u.rate = 0.85;
    const v = synth.getVoices().find((v) => v.lang.startsWith("en"));
    if (v) u.voice = v;
    synth.speak(u);
  } catch {
    /* speech is a bonus */
  }
}

export function stopSpeech(): void {
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* ignore */
  }
}
