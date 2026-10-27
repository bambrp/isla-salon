import { clamp, lerp, smoothstep } from './geometry';

/**
 * The washing model: how the hair responds while water, shampoo or conditioner is applied. Pure numbers with
 * no drawing, so every rule can be unit-tested. All levels run from 0 to 1.
 */

export type Shampoo = 'mint' | 'citrus' | 'tropical';
export type Product = Shampoo | 'conditioner';
/**
 * What is happening to the hair right now: the water running, or product being rubbed in (swiping across her hair
 * while there is product on it), or neither. Only the water is held in the store; rubbing is worked out by the scene.
 */
export type Applying = 'water' | 'product' | null;

export interface WashLevels {
  /** How soaked the hair is. */
  wet: number;
  /** Shampoo lather sitting on the hair. */
  foam: number;
  /** Conditioner sitting on the hair, before it is rinsed off. */
  cream: number;
  /** How clean the hair is. Shampooing raises it. */
  clean: number;
  /** How silky the hair is. Conditioner raises it, and rinsing keeps it. */
  conditioned: number;
}

export interface WashInput {
  applying: Applying;
  product: Product;
  /** 0 = icy, 0.5 = warm, 1 = hot. */
  temperature: number;
  /** 0 = off, 1 = full blast. */
  pressure: number;
  /** How hard the hair is being rubbed, 0 (not at all) to 1 (a brisk scrub). Product only works in while this is above 0. */
  rub: number;
  /** Product squirted on and waiting to be rubbed in. One squirt is 1. */
  load: number;
}

/** One squirt rubbed in all the way is worth this much of a full lather (or of full cream). */
export const GAIN_PER_LOAD = 0.67;
export const LOAD_PER_SQUIRT = 1;

export const SHAMPOOS: readonly Shampoo[] = ['mint', 'citrus', 'tropical'];
export const PRODUCTS: readonly Product[] = ['mint', 'citrus', 'tropical', 'conditioner'];

export function isShampoo(p: Product): p is Shampoo {
  return p !== 'conditioner';
}

/** Per-second rates. The pace is for play: a full lather takes about three seconds of holding. */
const SOAK_RATE = 0.9;
const LATHER_RATE = 0.34;
const CLEAN_RATE = 0.25;
/** A full lather or coat of conditioner rinses off in 10 seconds at the lowest setting (see rinseSpeed for full pressure). */
const RINSE_FOAM = 0.1;
const RINSE_CREAM = 0.1;
/** The rinse speed multiple at full pressure: a full rinse takes 3 seconds there, against 10 at the lowest setting. */
export const RINSE_FASTEST = 10 / 3;

/**
 * How fast water rinses lather and conditioner off, as a multiple of the gentlest flow: 1 at the lowest setting
 * above off, rising evenly to 10/3 at full pressure, so a full rinse takes 10 seconds at the lowest setting and
 * 3 seconds at full pressure.
 */
export function rinseSpeed(pressure: number): number {
  return 1 + (RINSE_FASTEST - 1) * clamp(pressure, 0, 1);
}

/** Advance the levels by dt seconds of whatever is being applied. Returns a new object; the input is untouched. */
export function stepWash(l: WashLevels, dt: number, input: WashInput): WashLevels {
  return stepWashLoad(l, dt, input).levels;
}

/** As stepWash, and also says how much of the waiting product (input.load) was rubbed in during the step. */
export function stepWashLoad(l: WashLevels, dt: number, input: WashInput): { levels: WashLevels; used: number } {
  const next = { ...l };
  let used = 0;
  const p = clamp(input.pressure, 0, 1);

  if (input.applying === 'water') {
    next.wet += SOAK_RATE * (0.4 + 0.6 * p) * dt;
    // Harder water rinses faster.
    next.foam -= RINSE_FOAM * rinseSpeed(p) * dt;
    next.cream -= RINSE_CREAM * rinseSpeed(p) * dt;
  } else if (input.applying === 'product' && isShampoo(input.product) && input.load > 0 && input.rub > 0) {
    // Rubbing works product in at a pace that follows how hard she is rubbed, until the squirt runs out.
    const rub = clamp(input.rub, 0, 1);
    const main = LATHER_RATE * (0.45 + 0.55 * l.wet);
    const wanted = main * rub * dt;
    const gain = Math.min(wanted, input.load * GAIN_PER_LOAD);
    const share = wanted > 0 ? gain / wanted : 0;
    used = gain / GAIN_PER_LOAD;
    // Only shampoo lathers. Conditioner is not rubbed in continuously: each swipe lightens the hair a step (conditionSwipe).
    if (isShampoo(input.product)) {
      // Lather builds faster on wet hair.
      next.foam += gain;
      next.clean += CLEAN_RATE * rub * dt * share;
    }
  }

  return {
    levels: {
      wet: clamp(next.wet, 0, 1),
      foam: clamp(next.foam, 0, 1),
      cream: clamp(next.cream, 0, 1),
      clean: clamp(next.clean, 0, 1),
      conditioned: clamp(next.conditioned, 0, 1),
    },
    used,
  };
}

/** Swipes it takes to bring conditioner to its full effect on the hair, and so the swipes one squirt of it lasts. */
export const CONDITION_SWIPES = 8;

/**
 * One swipe across the hair with conditioner on it: the hair goes a step lighter (an eighth of the way to its lightest)
 * and a step silkier, using up an eighth of the squirt. With no conditioner waiting there is no effect.
 */
export function conditionSwipe(l: WashLevels, load: number): { levels: WashLevels; used: number } {
  const perSwipe = LOAD_PER_SQUIRT / CONDITION_SWIPES;
  const used = Math.min(perSwipe, Math.max(0, load));
  if (used <= 0) return { levels: l, used: 0 };
  const step = used / perSwipe / CONDITION_SWIPES;
  return { levels: { ...l, cream: clamp(l.cream + step, 0, 1), conditioned: clamp(l.conditioned + step, 0, 1) }, used };
}

export function sameLevels(a: WashLevels, b: WashLevels): boolean {
  return a.wet === b.wet && a.foam === b.foam && a.cream === b.cream && a.clean === b.clean && a.conditioned === b.conditioned;
}

/** True when the hair is freshly washed and conditioned, and so sparkles. */
export function isShiny(l: WashLevels): boolean {
  return l.conditioned >= 0.6 && l.clean >= 0.6 && l.foam < 0.15 && l.cream < 0.15;
}

// ---------------------------------------------------------------------------------------------------
// How the water looks
// ---------------------------------------------------------------------------------------------------

export type TemperatureBand = 'cold' | 'warm' | 'hot';

export function temperatureBand(t: number): TemperatureBand {
  return t < 0.34 ? 'cold' : t < 0.67 ? 'warm' : 'hot';
}

export const TEMPERATURE_LABEL: Record<TemperatureBand, string> = { cold: 'Cold', warm: 'Warm', hot: 'Hot' };

export interface WaterLook {
  /** Colour of the water drops. */
  tint: number;
  /** 0 to 1: how much icy chill shows (blue wash, frost sparkles). */
  chill: number;
  /** 0 to 1: how much steam rises. */
  steam: number;
}

function mix(a: number, b: number, t: number): number {
  const ch = (shift: number) => Math.round(lerp((a >> shift) & 255, (b >> shift) & 255, t)) << shift;
  return ch(16) | ch(8) | ch(0);
}

const ICY = 0x8fd0ff;
const CLEAR = 0xbdeeff;
const BLUSH = 0xffd0c0;

export function waterLook(temperature: number): WaterLook {
  const t = clamp(temperature, 0, 1);
  const tint = t < 0.5 ? mix(ICY, CLEAR, t / 0.5) : mix(CLEAR, BLUSH, (t - 0.5) / 0.5);
  return { tint, chill: 1 - smoothstep(0, 0.4, t), steam: smoothstep(0.6, 1, t) };
}

/** The look of the stream for a given pressure: how many streaks, how fast, how wide a fan, how thick. */
export function streamFor(pressure: number): { streaks: number; speed: number; spread: number; width: number } {
  const p = clamp(pressure, 0, 1);
  return { streaks: Math.round(6 + 18 * p), speed: 320 + 480 * p, spread: 5 + 11 * p, width: 1.6 + 2.4 * p };
}
