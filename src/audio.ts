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
