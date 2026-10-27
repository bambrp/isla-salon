import { clamp, smoothstep } from './geometry';

/**
 * How the water temperature shows on her face. Hot water turns her pink, and the hottest makes her look annoyed;
 * cold water turns her blue. The colour comes up in about a second while the water runs and fades back over three
 * seconds once it stops or is made gentler. Pure numbers with no drawing, so the rules can be unit-tested.
 */
export interface Mood {
  /** -1 (fully blue) to 1 (fully pink); 0 is her own skin. */
  tone: number;
  /** 0 to 1: how annoyed she looks (brows slanted in, a frown). */
  annoyed: number;
  /** 0 to 1: how hard she clenches her teeth against the cold (only at the very coldest setting). */
  clench: number;
}

export const CALM: Mood = { tone: 0, annoyed: 0, clench: 0 };

/** Seconds for the colour to come up while the water runs, and to fade back to normal after. */
export const MOOD_RISE_SECONDS = 1;
export const MOOD_FADE_SECONDS = 3;

/** The face the water is working towards: nothing while it is off, warm water leaves her as she is. */
export function moodTarget(waterRunning: boolean, temperature: number): Mood {
  if (!waterRunning) return CALM;
  const t = clamp(temperature, 0, 1);
  if (t < 0.5) return { tone: -(1 - smoothstep(0, 0.4, t)), annoyed: 0, clench: 1 - smoothstep(0, 0.12, t) };
  return { tone: smoothstep(0.5, 0.95, t), annoyed: smoothstep(0.88, 1, t), clench: 0 };
}

/** Move a value towards its target: quickly when it is growing in strength, slowly when it is fading back. */
function approach(value: number, target: number, dt: number): number {
  // A change of sign (pink to blue) passes through her own colour first, fading back at the slow rate.
  const goal = value !== 0 && target !== 0 && Math.sign(value) !== Math.sign(target) ? 0 : target;
  const rising = Math.abs(goal) > Math.abs(value);
  const step = dt / (rising ? MOOD_RISE_SECONDS : MOOD_FADE_SECONDS);
  return value < goal ? Math.min(goal, value + step) : Math.max(goal, value - step);
}

export function stepMood(m: Mood, dt: number, target: Mood): Mood {
  return { tone: approach(m.tone, target.tone, dt), annoyed: approach(m.annoyed, target.annoyed, dt), clench: approach(m.clench, target.clench, dt) };
}

export function sameMood(a: Mood, b: Mood): boolean {
  return Math.abs(a.tone - b.tone) < 1e-6 && Math.abs(a.annoyed - b.annoyed) < 1e-6 && Math.abs(a.clench - b.clench) < 1e-6;
}

export function isCalm(m: Mood): boolean {
  return Math.abs(m.tone) < 1e-6 && Math.abs(m.annoyed) < 1e-6 && Math.abs(m.clench) < 1e-6;
}

const PINK = 0xff7f9a;
const BLUE = 0x7fb8ff;

function mix(a: number, b: number, k: number): number {
  const ch = (shift: number) => Math.round(((a >> shift) & 255) * (1 - k) + ((b >> shift) & 255) * k);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/** Her skin colour with the temperature showing: pink for hot, blue for cold. */
export function tintedSkin(skin: number, tone: number): number {
  const t = clamp(tone, -1, 1);
  if (t === 0) return skin;
  return t > 0 ? mix(skin, PINK, 0.55 * t) : mix(skin, BLUE, 0.6 * -t);
}

/**
 * How far (design pixels, sideways) the character shivers at a moment in the cold water: nothing unless the water is cold
 * (below the middle of the dial), growing to a little over a pixel at the coldest. Only she and what sits on her hair move
 * by this; the sink's fixtures (dial, tap, shower, water, bottle ring) and the backdrop never do.
 */
export function shiverOffset(temperature: number, seconds: number): number {
  if (!(temperature < 0.5)) return 0;
  return clamp(Math.sin(seconds * 55) * 1.3 * (1 - temperature * 2), -1.3, 1.3);
}
