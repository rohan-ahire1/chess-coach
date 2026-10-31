/**
 * Board sounds, synthesized so no audio files ship: a short filtered noise burst
 * reads as wood on wood, and a capture is two of them close together.
 */
export type BoardSound = "move" | "capture" | "check" | "end";

const MUTE_KEY = "coachmate:muted";
let context: AudioContext | null = null;
let noise: AudioBuffer | null = null;

export function isMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setMuted(muted: boolean) {
  try {
    window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    // Falls back to the default next visit.
  }
}

function ensureContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!context) {
    const Ctor = window.AudioContext;
    if (!Ctor) return null;
    context = new Ctor();
    noise = context.createBuffer(1, context.sampleRate * 0.08, context.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (context.state === "suspended") void context.resume();
  return context;
}

function knock(ctx: AudioContext, at: number, gain: number, freq: number) {
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = freq;
  filter.Q.value = 1.4;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(gain, at + 0.002);
  env.gain.exponentialRampToValueAtTime(0.0008, at + 0.06);
  src.connect(filter).connect(env).connect(ctx.destination);
  src.start(at);
  src.stop(at + 0.08);

  const body = ctx.createOscillator();
  body.frequency.setValueAtTime(190, at);
  body.frequency.exponentialRampToValueAtTime(90, at + 0.04);
  const bodyEnv = ctx.createGain();
  bodyEnv.gain.setValueAtTime(gain * 0.7, at);
  bodyEnv.gain.exponentialRampToValueAtTime(0.0008, at + 0.05);
  body.connect(bodyEnv).connect(ctx.destination);
  body.start(at);
  body.stop(at + 0.06);
}

export function playSound(sound: BoardSound) {
  if (isMuted()) return;
  const ctx = ensureContext();
  if (!ctx || !noise) return;
  const now = ctx.currentTime;
  if (sound === "move") knock(ctx, now, 0.32, 1900);
  if (sound === "capture") {
    knock(ctx, now, 0.36, 2300);
    knock(ctx, now + 0.032, 0.26, 1500);
  }
  if (sound === "check") {
    knock(ctx, now, 0.34, 2600);
    knock(ctx, now + 0.09, 0.2, 2600);
  }
  if (sound === "end") {
    knock(ctx, now, 0.3, 1200);
    knock(ctx, now + 0.12, 0.3, 900);
  }
}

export function soundForSan(san: string): BoardSound {
  if (san.includes("#")) return "end";
  if (san.includes("+")) return "check";
  if (san.includes("x")) return "capture";
  return "move";
}
