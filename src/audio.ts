import { get } from 'svelte/store';
import { salon } from './state';

/**
 * Sound effects, made with the Web Audio API so there are no audio files to load and nothing needs a network.
 * Everything respects the mute button, and does nothing where Web Audio is missing.
 */

let ctx: AudioContext | undefined;
let noise: AudioBuffer | undefined;

function context(): AudioContext | undefined {
  if (get(salon).audio.muted) return undefined;
  try {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return undefined;
      ctx = new Ctor();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return undefined;
  }
}

function noiseBuffer(c: AudioContext): AudioBuffer {
  if (!noise) {
    noise = c.createBuffer(1, Math.floor(c.sampleRate * 0.2), c.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noise;
}

/** One scissor snip: a short bright rasp of noise with a small metallic ring on top. */
export function playSnip(): void {
  const c = context();
  if (!c) return;
  const t = c.currentTime;

  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 5200;
  filter.Q.value = 0.9;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.5, t + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
  src.connect(filter).connect(gain).connect(c.destination);
  src.start(t, Math.random() * 0.1, 0.1);

  const ring = c.createOscillator();
  ring.type = 'triangle';
  ring.frequency.setValueAtTime(3100, t);
  ring.frequency.exponentialRampToValueAtTime(2300, t + 0.06);
  const ringGain = c.createGain();
  ringGain.gain.setValueAtTime(0.0001, t);
  ringGain.gain.exponentialRampToValueAtTime(0.07, t + 0.004);
  ringGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
  ring.connect(ringGain).connect(c.destination);
  ring.start(t);
  ring.stop(t + 0.08);
}

/** A soft rising chime, for hair growing back longer. */
export function playGrow(): void {
  const c = context();
  if (!c) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(420, t);
  osc.frequency.exponentialRampToValueAtTime(880, t + 0.22);
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.12, t + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.32);
}

// ---------------------------------------------------------------------------------------------------
// Washing: running water, fizzing foam, soft conditioner
// ---------------------------------------------------------------------------------------------------

export type WashSound = 'water' | 'foam' | 'cream' | null;

let loopNoise: AudioBuffer | undefined;
let running:
  | { mode: Exclude<WashSound, null>; src: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode; timer?: number }
  | undefined;

function longNoise(c: AudioContext): AudioBuffer {
  if (!loopNoise) {
    loopNoise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = loopNoise.getChannelData(0);
    let last = 0;
    // A little smoothing makes it a softer hiss than raw white noise.
    for (let i = 0; i < d.length; i++) {
      last = last * 0.35 + (Math.random() * 2 - 1) * 0.65;
      d[i] = last;
    }
  }
  return loopNoise;
}

function stopWash(): void {
  if (!running) return;
  const r = running;
  running = undefined;
  if (r.timer !== undefined) window.clearInterval(r.timer);
  try {
    const t = ctx?.currentTime ?? 0;
    r.gain.gain.cancelScheduledValues(t);
    r.gain.gain.setTargetAtTime(0, t, 0.03);
    r.src.stop(t + 0.2);
  } catch {
    /* already stopped */
  }
}

function pop(c: AudioContext, gain: number): void {
  const t = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 2500 + Math.random() * 3500;
  f.Q.value = 3;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03 + Math.random() * 0.03);
  src.connect(f).connect(g).connect(c.destination);
  src.start(t, Math.random() * 0.1, 0.08);
}

function bloop(c: AudioContext, gain: number): void {
  const t = c.currentTime;
  const o = c.createOscillator();
  o.type = 'sine';
  const base = 220 + Math.random() * 120;
  o.frequency.setValueAtTime(base * 1.6, t);
  o.frequency.exponentialRampToValueAtTime(base, t + 0.1);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + 0.16);
}

/**
 * Keep the washing sound matching what the hold buttons are doing. Call it every frame or whenever things change:
 * it does nothing if the sound is already right, and stops everything for null or when muted.
 */
export function updateWashSound(mode: WashSound, pressure: number): void {
  const c = mode ? context() : undefined;
  if (!mode || !c) {
    stopWash();
    return;
  }
  const t = c.currentTime;
  const level = mode === 'water' ? 0.05 + 0.2 * pressure : mode === 'foam' ? 0.035 : 0.025;
  const cutoff = mode === 'water' ? 900 + 3600 * pressure : mode === 'foam' ? 3000 : 700;

  if (running && running.mode === mode) {
    running.gain.gain.setTargetAtTime(level, t, 0.05);
    running.filter.frequency.setTargetAtTime(cutoff, t, 0.05);
    return;
  }
  stopWash();

  const src = c.createBufferSource();
  src.buffer = longNoise(c);
  src.loop = true;
  const filter = c.createBiquadFilter();
  filter.type = mode === 'foam' ? 'highpass' : 'lowpass';
  filter.frequency.value = cutoff;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.setTargetAtTime(level, t, 0.04);
  src.connect(filter).connect(gain).connect(c.destination);
  src.start();

  running = { mode, src, filter, gain };
  if (mode === 'foam') {
    running.timer = window.setInterval(() => {
      const cc = context();
      if (cc) pop(cc, 0.05 + Math.random() * 0.06);
    }, 70);
  } else if (mode === 'cream') {
    running.timer = window.setInterval(() => {
      const cc = context();
      if (cc) bloop(cc, 0.05);
    }, 230);
  }
}
