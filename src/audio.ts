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

/** A magic wand's sparkle: a quick run of tiny bell notes climbing upwards, each with a faint shimmer above it. */
export function playSparkle(): void {
  const c = context();
  if (!c) return;
  const t = c.currentTime;
  const notes = [1318, 1568, 1976, 2349, 2637, 3136];
  notes.forEach((freq, i) => {
    const at = t + i * 0.055;
    for (const [mult, peak] of [[1, 0.07], [2.01, 0.025]] as const) {
      const osc = c.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * mult, at);
      const gain = c.createGain();
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(peak, at + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
      osc.connect(gain).connect(c.destination);
      osc.start(at);
      osc.stop(at + 0.24);
    }
  });
}

// ---------------------------------------------------------------------------------------------------
// Washing: running water, fizzing foam, soft conditioner
// ---------------------------------------------------------------------------------------------------

export type WashSound = 'water' | 'foam' | null;

let loopNoise: AudioBuffer | undefined;
let running:
  | { mode: Exclude<WashSound, null>; src: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode; timer?: number; rub: number }
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
export function updateWashSound(mode: WashSound, pressure: number, rub = 1): void {
  const c = mode ? context() : undefined;
  if (!mode || !c) {
    stopWash();
    return;
  }
  const t = c.currentTime;
  // Rubbing in product is louder and brighter the harder she is rubbed.
  const scrub = Math.min(1, Math.max(0, rub));
  const level = mode === 'water' ? 0.05 + 0.2 * pressure : 0.012 + 0.05 * scrub;
  const cutoff = mode === 'water' ? 900 + 3600 * pressure : 1800 + 2600 * scrub;

  if (running && running.mode === mode) {
    running.rub = scrub;
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

  running = { mode, src, filter, gain, rub: scrub };
  if (mode === 'foam') {
    // A foamy squelch: lots of small bursting bubbles, more of them the harder she rubs, and the odd gloop.
    running.timer = window.setInterval(() => {
      const cc = context();
      if (!cc || !running) return;
      if (Math.random() < 0.25 + 0.75 * running.rub) pop(cc, 0.04 + Math.random() * 0.07 * (0.4 + running.rub));
      if (Math.random() < 0.05 + 0.1 * running.rub) bloop(cc, 0.035);
    }, 55);
  }
}

/**
 * A product squirting out of its bottle: a wet "pfft" of filtered noise that rises in pitch, a short gap, a smaller
 * "pt", and a soft low blip as the blob lands.
 */
export function playSquirt(): void {
  const c = context();
  if (!c) return;
  const t = c.currentTime;
  const burst = (start: number, length: number, from: number, to: number, peak: number): void => {
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(c);
    src.loop = true;
    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 2.5;
    filter.frequency.setValueAtTime(from, t + start);
    filter.frequency.exponentialRampToValueAtTime(to, t + start + length);
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, t + start);
    gain.gain.exponentialRampToValueAtTime(peak, t + start + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + start + length);
    src.connect(filter).connect(gain).connect(c.destination);
    src.start(t + start);
    src.stop(t + start + length + 0.02);
  };
  burst(0, 0.22, 900, 2600, 0.3);
  burst(0.27, 0.1, 1500, 3200, 0.2);
  const o = c.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(230, t + 0.38);
  o.frequency.exponentialRampToValueAtTime(110, t + 0.5);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t + 0.38);
  g.gain.exponentialRampToValueAtTime(0.16, t + 0.4);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.52);
  o.connect(g).connect(c.destination);
  o.start(t + 0.38);
  o.stop(t + 0.54);
}

/** A springy boing, for hair being curled. */
export function playBoing(): void {
  const c = context();
  if (!c) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(260, t);
  osc.frequency.exponentialRampToValueAtTime(620, t + 0.12);
  osc.frequency.exponentialRampToValueAtTime(330, t + 0.3);
  const lfo = c.createOscillator();
  lfo.frequency.value = 22;
  const depth = c.createGain();
  depth.gain.value = 30;
  lfo.connect(depth).connect(osc.frequency);
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
  osc.connect(gain).connect(c.destination);
  osc.start(t);
  lfo.start(t);
  osc.stop(t + 0.36);
  lfo.stop(t + 0.36);
}

/** A short aerosol hiss, for styling product being sprayed on. */
export function playSpray(): void {
  const c = context();
  if (!c) return;
  const t = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  src.loop = true;
  const filter = c.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 3200;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.22, t + 0.05);
  gain.gain.setValueAtTime(0.22, t + 0.3);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.48);
  src.connect(filter).connect(gain).connect(c.destination);
  src.start(t);
  src.stop(t + 0.5);
}

/** A soft pat, for hair being pressed flat. */
export function playPat(): void {
  const c = context();
  if (!c) return;
  const t = c.currentTime + 0.4;
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, t);
  osc.frequency.exponentialRampToValueAtTime(60, t + 0.12);
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.3, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.18);
}

/** A camera shutter: two quick clicks. */
export function playShutter(): void {
  const c = context();
  if (!c) return;
  const t = c.currentTime;
  for (const [offset, freq] of [[0, 2600], [0.055, 1900]] as const) {
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(c);
    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = 1.4;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, t + offset);
    gain.gain.exponentialRampToValueAtTime(0.5, t + offset + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + offset + 0.04);
    src.connect(filter).connect(gain).connect(c.destination);
    src.start(t + offset, 0, 0.06);
  }
}

/** A squeak of clean, conditioned hair being rubbed: a short rubbery chirp that rises, with a little wobble. */
export function playSqueak(): void {
  const c = context();
  if (!c) return;
  const t = c.currentTime;
  const base = 1500 + Math.random() * 500;
  const osc = c.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(base, t);
  osc.frequency.exponentialRampToValueAtTime(base * 1.7, t + 0.09);
  osc.frequency.exponentialRampToValueAtTime(base * 1.35, t + 0.17);
  const wobble = c.createOscillator();
  wobble.frequency.value = 38;
  const depth = c.createGain();
  depth.gain.value = 60;
  wobble.connect(depth).connect(osc.frequency);
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 2400;
  filter.Q.value = 3;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.19);
  osc.connect(filter).connect(gain).connect(c.destination);
  osc.start(t);
  wobble.start(t);
  osc.stop(t + 0.2);
  wobble.stop(t + 0.2);
}
