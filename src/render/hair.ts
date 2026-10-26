import type { Graphics } from 'pixi.js';
import type { Length, Region } from '../state';
import type { Band } from './colour';
import { DEG, HEAD, lerp, mulberry32, project, smoothstep } from './geometry';
import { NO_LOOK, type Look } from './look';
import { INK, OUTLINE_THIN, SHADOW_FACTOR, shade } from './style';

/**
 * Strand-based hair.
 *
 * Hair is a ring of LOCK_COUNT locks hanging from the scalp. Each lock is a ribbon lying on a shell around
 * the head (head space, see geometry.ts), so the same data can be projected for any view angle. A lock is
 * stored as a list of samples from the crown down to its tip; drawing projects the ribbon's two edges,
 * sorts locks by depth, and fills each with a lit and a shadow tone plus an outline.
 */

export const LOCK_COUNT = 24;

/** Absolute design-space y where hair ends, for the left and right sides. */
export const SIDE_REACH: Record<Length, number> = {
  back: 478,
  shoulders: 424,
  bob: 336,
  short1: 292,
  short2: 262,
  short3: 232,
  trimmed: 220,
  shaved: 220,
};

/**
 * The back of the head. Short cuts finish lower here than at the sides, at the nape, so the hairline
 * tapers from the temples down to the neck instead of running level round the head like a bowl.
 */
export const BACK_REACH: Record<Length, number> = {
  back: 478,
  shoulders: 424,
  bob: 336,
  short1: 322,
  short2: 300,
  short3: 272,
  trimmed: 254,
  shaved: 254,
};

/**
 * Front hair: the long lengths are swept aside (curtains); the short ones are fringes above the brows,
 * so they end higher than the side lengths of the same name.
 */
export const FRONT_REACH: Record<Length, number> = {
  back: 478,
  shoulders: 424,
  bob: 336,
  short1: 234,
  short2: 212,
  short3: 194,
  trimmed: 188,
  shaved: 188,
};

/** Front-sector locks with a reach (relative to the head centre) at or below this are swept to the sides. */
export const SWEEP_MIN_REACH = 10;
/** Fringes never hang lower than this (relative y), so brows and eyes stay clear. */
export const FRINGE_MAX_REACH = -26;
/** Locks rooted within this azimuth of straight ahead are "front" locks. */
export const FRONT_SECTOR = 62 * DEG;

/** Half-width of a lock, as an angle round the head. Neighbours are 15 degrees apart, so they overlap. */
const LOCK_HALF_ANGLE = 12 * DEG;
/** Fraction of a lock's width that is lit (the screen-left part). */
const LIT_FRACTION = 0.58;

export interface LockSample {
  /** Height relative to the head centre (down is positive). */
  y: number;
  /** Shell radii at this height. */
  rx: number;
  rz: number;
  /** Azimuth of the lock's centre line (0 = straight ahead, + = character's left). */
  a: number;
  /** Half-width as an angle. */
  hw: number;
}

export interface Lock {
  index: number;
  /** Azimuth where the lock is rooted. */
  a0: number;
  /** Shell thickness above the scalp. */
  th: number;
  /** Tip height relative to the head centre. */
  reach: number;
  swept: boolean;
  /** 0 to 1: how solid the lock is. Hair thins out to nothing as it is shaved off. */
  alpha: number;
  /** 0 to 1: how much of a close-clipped stubble this is (1 is the clipper cut). */
  stubble: number;
  samples: LockSample[];
}

export type Lengths = Record<Region, Length>;
/** A cut part-way between lengths: 0 is the longest length ('back') and 5 the shortest ('short3'); 2.5 is half way from bob to short. */
export type Positions = Record<Region, number>;
/** What the hair builders accept: whole lengths, or positions between them while a cut is in progress. */
export type CutLengths = Record<Region, Length | number>;

const ORDER: readonly Length[] = ['back', 'shoulders', 'bob', 'short1', 'short2', 'short3', 'trimmed', 'shaved'];

/**
 * How much of the hair is there at each length: all of it, until shaved, when there is none. A cut part-way from
 * trimmed to shaved fades the stubble out, so the head grows bare gradually.
 */
export const DENSITY: Record<Length, number> = { back: 1, shoulders: 1, bob: 1, short1: 1, short2: 1, short3: 1, trimmed: 1, shaved: 0 };

/**
 * How much of a normal head of hair's thickness the hair has: 1 down to a crop, then thinning to a clipper
 * cut (grade 1, 3 mm), which lies as close to the scalp as stubble does.
 */
export const BULK: Record<Length, number> = { back: 1, shoulders: 1, bob: 1, short1: 1, short2: 1, short3: 1, trimmed: 0, shaved: 0 };

/** A reach table read at a length, or half way between two of them. */
export function tableAt(table: Record<Length, number>, at: Length | number): number {
  const pos = typeof at === 'number' ? Math.min(ORDER.length - 1, Math.max(0, at)) : ORDER.indexOf(at);
  const lo = Math.floor(pos);
  const hi = Math.min(ORDER.length - 1, lo + 1);
  return lerp(table[ORDER[lo]], table[ORDER[hi]], pos - lo);
}

/** Wrap an angle into [0, 2pi). */
function wrap(a: number): number {
  const t = a % (2 * Math.PI);
  return t < 0 ? t + 2 * Math.PI : t;
}

/**
 * Where hair ends at a given azimuth, relative to the head centre. Region lengths sit at the compass points
 * (front 0, back 180, and the sides at +90 and -90) and blend smoothly between them, so a bob next to a shoulder-length
 * cut grades gently instead of stepping. Regions are named as the player sees Isla from the front, so Right is
 * the screen-right side of the front view at +90, and Left is at -90.
 */
export function reachAt(az: number, lengths: CutLengths): number {
  return blendRegions(az, [
    tableAt(FRONT_REACH, lengths.front),
    tableAt(SIDE_REACH, lengths.right),
    tableAt(BACK_REACH, lengths.back),
    tableAt(SIDE_REACH, lengths.left),
  ]) - HEAD.cy;
}

/** A value for each region (front, right, back, left), blended smoothly round the head to the azimuth az. */
function blendRegions(az: number, centres: number[]): number {
  const t = wrap(az) / (Math.PI / 2);
  const q = Math.min(3, Math.floor(t));
  const f = smoothstep(0, 1, t - q);
  return lerp(centres[q], centres[(q + 1) % 4], f);
}

/** The same blend for a table of per-length values that does not depend on the region (density, bulk). */
function blendAt(table: Record<Length, number>, az: number, lengths: CutLengths): number {
  return blendRegions(az, [tableAt(table, lengths.front), tableAt(table, lengths.right), tableAt(table, lengths.back), tableAt(table, lengths.left)]);
}

/** How much hair there is at this azimuth, 0 (bare skin) to 1. */
export function densityAt(az: number, lengths: CutLengths): number {
  return blendAt(DENSITY, az, lengths);
}

/**
 * Azimuth a swept lock settles at. Inner locks sit closer to the face, outer ones further round. They stop
 * well behind the cheek, so in profile the cheek and mouth stay visible instead of vanishing under the hair.
 */
function sweepTarget(a0: number): number {
  const side = Math.sign(a0);
  const rank = (Math.abs(a0) - 7.5 * DEG) / (45 * DEG);
  return side * (70 + 14 * Math.min(1, Math.max(0, rank))) * DEG;
}

/** Swept locks are a little narrower than the rest: they gather as they fall past the face. */
const SWEPT_NARROWING = 0.8;

function buildSamples(
  a0: number,
  th: number,
  reach: number,
  swept: boolean,
  phase: number,
  look: Look,
): LockSample[] {
  // Flat product plasters the hair down and takes most of the curl out.
  const flat = look.flat;
  const curl = look.curl * (1 - 0.85 * flat);
  const top = HEAD.ry + th;
  const ys: number[] = [];

  // Over the dome, sampled by polar angle so the curve stays smooth near the crown.
  const domeEnd = Math.min(reach, 0);
  const steps = 9;
  for (let k = 0; k <= steps; k++) {
    const y = -top * Math.cos((k / steps) * (Math.PI / 2));
    if (y >= domeEnd) break;
    ys.push(y);
  }
  ys.push(domeEnd);
  // Below the equator, evenly spaced.
  for (let y = 18; y < reach - 4; y += 18) ys.push(y);
  if (reach > 0) ys.push(reach);

  const aT = sweepTarget(a0);
  const waveAmp = (reach > 0 ? 0.03 : 0.012) * (1 - flat);
  const curlAmp = 0.06 * curl;
  const curlFreq = 0.04 + 0.039 * curl;
  const span = reach - ys[0];

  return ys.map((y) => {
    const scale = y <= 0 ? Math.sqrt(Math.max(0, 1 - (y / top) ** 2)) : 1;
    const flare = 1 + 0.1 * (1 - flat) * smoothstep(110, 230, y);
    const sweep = swept ? (aT - a0) * smoothstep(-58, -18, y) : 0;
    const wave = waveAmp * Math.sin(y * 0.045 + phase) * smoothstep(-60, 40, y);
    const u = span > 0 ? (y - ys[0]) / span : 1;
    // Curl swings the lock from side to side and in and out, so the silhouette ripples in every view.
    const curlEnv = smoothstep(-85, -5, y);
    const curlSwing = curlAmp * Math.sin(y * curlFreq + phase) * curlEnv;
    const curlPuff = 1 + 0.05 * curl * Math.sin(y * curlFreq + phase + 1.3) * curlEnv;
    const size = scale * flare * curlPuff;
    return {
      y,
      rx: (HEAD.rx + th) * size,
      rz: (HEAD.rz + th) * size,
      a: a0 + sweep + wave + curlSwing,
      hw:
        LOCK_HALF_ANGLE *
        (swept ? SWEPT_NARROWING : 1) *
        (1 - 0.55 * smoothstep(0.62, 1, u)),
    };
  });
}

/** Build every lock for the given cut. Deterministic for a given seed. */
export function buildLocks(lengths: CutLengths, seed: number, look: Look = NO_LOOK): Lock[] {
  const rand = mulberry32(seed * 7919 + 13);
  const locks: Lock[] = [];

  for (let i = 0; i < LOCK_COUNT; i++) {
    const a0 = -Math.PI + ((i + 0.5) * 2 * Math.PI) / LOCK_COUNT;
    const alpha = smoothstep(0, 0.9, densityAt(a0, lengths));
    // Shaved: no hair is left here at all.
    if (alpha < 0.02) continue;
    const bulk = blendAt(BULK, a0, lengths);
    let reach = reachAt(a0, lengths);
    reach += (rand() - 0.5) * 2 * (reach > 0 ? 7 : 3);
    // Curls spring the hair up, so it hangs a little shorter the tighter it is.
    if (reach > 0) reach *= 1 - 0.07 * look.curl * (1 - 0.85 * look.flat);

    const inFront = Math.abs(a0) < FRONT_SECTOR;
    const swept = inFront && reach >= SWEEP_MIN_REACH;
    if (inFront && !swept) reach = Math.min(reach, FRINGE_MAX_REACH);

    // Longer hair is fuller; every other lock sits slightly proud for a layered look.
    // Fuller with curl, and pressed close to the head with flat product.
    const fullness = 3 + 7 * smoothstep(-30, 180, reach) + (i % 2) * 2 + 1.5 * look.curl;
    const slick = fullness + (1.5 - fullness) * look.flat;
    // A clipper cut lies as close as stubble: 3 mm, which is barely any thickness at all.
    const th = 1.3 + (slick - 1.3) * bulk;
    const phase = rand() * Math.PI * 2;
    locks.push({ index: i, a0, th, reach, swept, alpha, stubble: 1 - bulk, samples: buildSamples(a0, th, reach, swept, phase, look) });
  }
  return locks;
}

// ---------------------------------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------------------------------

export interface ProjectedLock {
  lock: Lock;
  depth: number;
  /** Flat x,y pairs along the screen-left and screen-right edges, and the lit/shadow boundary. */
  left: number[];
  right: number[];
  boundary: number[];
  /** Position of each sample along the lock: 0 at the crown, 1 at the tip. Colour bands are cut along this. */
  u: number[];
  /** The point just beyond the last sample, where the lock comes to a tip. */
  apex: [number, number];
}

function projectLock(lock: Lock, phi: number): ProjectedLock {
  const samples = lock.samples;
  const mid = samples[Math.floor(samples.length / 2)];
  const facing = Math.cos(mid.a - phi) > 0;

  const left: number[] = [];
  const right: number[] = [];
  const boundary: number[] = [];
  const u: number[] = [];
  let depth = 0;

  const top = samples[0].y;
  const span = Math.max(1e-6, samples[samples.length - 1].y - top);

  for (const s of samples) {
    const a1 = s.a - s.hw;
    const a2 = s.a + s.hw;
    // Screen-left is the lower azimuth when the lock faces us, the higher one when it faces away.
    const aLeft = facing ? a1 : a2;
    const aRight = facing ? a2 : a1;
    const aBoundary = facing ? a1 + 2 * s.hw * LIT_FRACTION : a2 - 2 * s.hw * LIT_FRACTION;

    const pl = project(s.rx * Math.sin(aLeft), s.y, s.rz * Math.cos(aLeft), phi);
    const pr = project(s.rx * Math.sin(aRight), s.y, s.rz * Math.cos(aRight), phi);
    const pb = project(s.rx * Math.sin(aBoundary), s.y, s.rz * Math.cos(aBoundary), phi);
    left.push(pl.sx, pl.sy);
    right.push(pr.sx, pr.sy);
    boundary.push(pb.sx, pb.sy);
    u.push((s.y - top) / span);
    depth += project(s.rx * Math.sin(s.a), s.y, s.rz * Math.cos(s.a), phi).d;
  }

  const last = samples[samples.length - 1];
  const tip = project(last.rx * Math.sin(last.a), last.y + 5, last.rz * Math.cos(last.a), phi);
  return { lock, depth: depth / samples.length, left, right, boundary, u, apex: [tip.sx, tip.sy] };
}

/** Project every lock and split into those behind the head and those in front, each sorted back to front. */
export function splitLocks(
  locks: Lock[],
  phi: number,
): { behind: ProjectedLock[]; front: ProjectedLock[] } {
  const projected = locks.map((l) => projectLock(l, phi));
  const byDepth = (a: ProjectedLock, b: ProjectedLock) => a.depth - b.depth || a.lock.index - b.lock.index;
  return {
    behind: projected.filter((p) => p.depth < 0).sort(byDepth),
    front: projected.filter((p) => p.depth >= 0).sort(byDepth),
  };
}

function reversePairs(flat: number[]): number[] {
  const out: number[] = [];
  for (let i = flat.length - 2; i >= 0; i -= 2) out.push(flat[i], flat[i + 1]);
  return out;
}

/**
 * A flat x,y outline with repeated points taken out, including the last point when it repeats the first. Pixi builds
 * a broken (NaN) outline from two identical neighbouring points, and phone graphics chips then draw stray lines from
 * the corner of the picture to wherever the broken point sits; desktop chips quietly skip it.
 */
export function withoutRepeats(flat: number[], eps = 0.01): number[] {
  const out: number[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) {
    const x = flat[i];
    const y = flat[i + 1];
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const n = out.length;
    if (n >= 2 && Math.abs(out[n - 2] - x) < eps && Math.abs(out[n - 1] - y) < eps) continue;
    out.push(x, y);
  }
  while (out.length > 4 && Math.abs(out[0] - out[out.length - 2]) < eps && Math.abs(out[1] - out[out.length - 1]) < eps) out.length -= 2;
  return out;
}

/**
 * The part of a flat x,y polyline between u0 and u1, where u gives each point's position along it.
 * The cut ends are interpolated, so a band edge lands exactly on u0 and u1 instead of on the nearest sample.
 */
export function sliceEdge(flat: number[], u: number[], u0: number, u1: number): number[] {
  const out: number[] = [];
  for (let k = 0; k < u.length - 1; k++) {
    const a = u[k];
    const b = u[k + 1];
    if (b <= u0 || a >= u1) continue;
    const span = b - a;
    const f0 = span > 1e-9 ? Math.max(0, (u0 - a) / span) : 0;
    const f1 = span > 1e-9 ? Math.min(1, (u1 - a) / span) : 1;
    const x0 = flat[2 * k];
    const y0 = flat[2 * k + 1];
    const dx = flat[2 * k + 2] - x0;
    const dy = flat[2 * k + 3] - y0;
    if (out.length === 0) out.push(x0 + dx * f0, y0 + dy * f0);
    out.push(x0 + dx * f1, y0 + dy * f1);
  }
  return out;
}

/** Each colour band runs this much into the next, which is painted over it, so no hairline gap shows between bands. */
const BAND_OVERLAP = 0.006;

/**
 * Draw locks back to front. Each lock is painted band by band (one band for a plain colour, several for an
 * ombre), each with a lit and a shadow tone, then outlined once so the outline runs unbroken down the lock.
 */
export function drawLocks(g: Graphics, projected: ProjectedLock[], bandsOf: (lock: Lock) => Band[]): void {
  for (const p of projected) {
    for (const band of bandsOf(p.lock)) {
      const u1 = band.u1 >= 1 ? 1 : Math.min(1, band.u1 + BAND_OVERLAP);
      const whole = band.u0 <= 0 && u1 >= 1;
      const left = whole ? p.left : sliceEdge(p.left, p.u, band.u0, u1);
      const right = whole ? p.right : sliceEdge(p.right, p.u, band.u0, u1);
      const boundary = whole ? p.boundary : sliceEdge(p.boundary, p.u, band.u0, u1);
      if (left.length < 4) continue;

      // Alternate locks are a touch darker so neighbours read as separate layers.
      const lit = p.lock.index % 2 ? shade(band.colour, 0.95) : band.colour;
      const shadow = shade(lit, SHADOW_FACTOR);
      const tip = u1 >= 1 ? p.apex : [];

      g.poly(withoutRepeats([...left, ...tip, ...reversePairs(right)])).fill({ color: shadow, alpha: p.lock.alpha });
      g.poly(withoutRepeats([...left, ...reversePairs(boundary)])).fill({ color: lit, alpha: p.lock.alpha });
    }
    g.poly(withoutRepeats([...p.left, p.apex[0], p.apex[1], ...reversePairs(p.right)])).stroke({
      width: OUTLINE_THIN,
      // Stubble is outlined only faintly, so a close crop reads as short hair rather than a cap of petals.
      color: INK,
      alpha: p.lock.alpha * (1 - 0.65 * p.lock.stubble),
      join: 'round',
      cap: 'round',
    });
  }
}

// ---------------------------------------------------------------------------------------------------
// Highlight
// ---------------------------------------------------------------------------------------------------

/** True if some lock actually covers head-space azimuth az at height y. */
export function isCovered(locks: Lock[], az: number, y: number): boolean {
  for (const lock of locks) {
    const s = lock.samples;
    if (y > lock.reach || y < s[0].y) continue;
    for (let k = 0; k < s.length - 1; k++) {
      if (y > s[k + 1].y) continue;
      const t = (y - s[k].y) / Math.max(1e-6, s[k + 1].y - s[k].y);
      const a = lerp(s[k].a, s[k + 1].a, t);
      const hw = lerp(s[k].hw, s[k + 1].hw, t);
      let diff = Math.abs(az - a) % (2 * Math.PI);
      if (diff > Math.PI) diff = 2 * Math.PI - diff;
      if (diff <= hw * 0.75) return true;
      break;
    }
  }
  return false;
}

/** A point on the highlight: its screen position, and the azimuth round the head it lies at (for split colour). */
export interface SheenPoint {
  x: number;
  y: number;
  az: number;
}

/**
 * The glossy highlight band on the upper-left of the head, as runs of screen points. Only the parts that
 * lie on hair are returned, so a cropped cut never gets a highlight floating on bare forehead.
 */
export function sheenRuns(locks: Lock[], phi: number): SheenPoint[][] {
  const th = 8;
  const half = Math.hypot((HEAD.rx + th) * Math.cos(phi), (HEAD.rz + th) * Math.sin(phi));
  const top = HEAD.ry + th;
  const depthPx = 0.67 * Math.hypot(HEAD.rx * Math.sin(phi), HEAD.rz * Math.cos(phi));

  const runs: SheenPoint[][] = [];
  let current: SheenPoint[] = [];
  const steps = 14;
  for (let k = 0; k <= steps; k++) {
    const ang = (205 + (57 * k) / steps) * DEG;
    const sx = 0.74 * half * Math.cos(ang);
    const sy = 0.74 * top * Math.sin(ang);
    const x = sx * Math.cos(phi) + depthPx * Math.sin(phi);
    const z = -sx * Math.sin(phi) + depthPx * Math.cos(phi);
    const az = Math.atan2(x, z);
    if (isCovered(locks, az, sy)) {
      current.push({ x: HEAD.cx + sx, y: HEAD.cy + sy, az });
    } else if (current.length) {
      runs.push(current);
      current = [];
    }
  }
  if (current.length) runs.push(current);
  return runs.filter((r) => r.length > 1);
}
