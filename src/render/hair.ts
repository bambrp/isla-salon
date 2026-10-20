import type { Graphics } from 'pixi.js';
import type { Length, Region } from '../state';
import { DEG, HEAD, lerp, mulberry32, project, smoothstep } from './geometry';
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
  samples: LockSample[];
}

export type Lengths = Record<Region, Length>;

/** Wrap an angle into [0, 2pi). */
function wrap(a: number): number {
  const t = a % (2 * Math.PI);
  return t < 0 ? t + 2 * Math.PI : t;
}

/**
 * Where hair ends at a given azimuth, relative to the head centre. Region lengths sit at the compass points
 * (front 0, left +90, back 180, right -90) and blend smoothly between them, so a bob next to a shoulder-length
 * cut grades gently instead of stepping.
 */
export function reachAt(az: number, lengths: Lengths): number {
  const centres = [
    FRONT_REACH[lengths.front],
    SIDE_REACH[lengths.left],
    BACK_REACH[lengths.back],
    SIDE_REACH[lengths.right],
  ];
  const t = wrap(az) / (Math.PI / 2);
  const q = Math.min(3, Math.floor(t));
  const f = smoothstep(0, 1, t - q);
  return lerp(centres[q], centres[(q + 1) % 4], f) - HEAD.cy;
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
): LockSample[] {
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
  const waveAmp = reach > 0 ? 0.03 : 0.012;
  const span = reach - ys[0];

  return ys.map((y) => {
    const scale = y <= 0 ? Math.sqrt(Math.max(0, 1 - (y / top) ** 2)) : 1;
    const flare = 1 + 0.1 * smoothstep(110, 230, y);
    const sweep = swept ? (aT - a0) * smoothstep(-58, -18, y) : 0;
    const wave = waveAmp * Math.sin(y * 0.045 + phase) * smoothstep(-60, 40, y);
    const u = span > 0 ? (y - ys[0]) / span : 1;
    return {
      y,
      rx: (HEAD.rx + th) * scale * flare,
      rz: (HEAD.rz + th) * scale * flare,
      a: a0 + sweep + wave,
      hw: LOCK_HALF_ANGLE * (swept ? SWEPT_NARROWING : 1) * (1 - 0.55 * smoothstep(0.62, 1, u)),
    };
  });
}

/** Build every lock for the given cut. Deterministic for a given seed. */
export function buildLocks(lengths: Lengths, seed: number): Lock[] {
  const rand = mulberry32(seed * 7919 + 13);
  const locks: Lock[] = [];

  for (let i = 0; i < LOCK_COUNT; i++) {
    const a0 = -Math.PI + ((i + 0.5) * 2 * Math.PI) / LOCK_COUNT;
    let reach = reachAt(a0, lengths);
    reach += (rand() - 0.5) * 2 * (reach > 0 ? 7 : 3);

    const inFront = Math.abs(a0) < FRONT_SECTOR;
    const swept = inFront && reach >= SWEEP_MIN_REACH;
    if (inFront && !swept) reach = Math.min(reach, FRINGE_MAX_REACH);

    // Longer hair is fuller; every other lock sits slightly proud for a layered look.
    const th = 3 + 7 * smoothstep(-30, 180, reach) + (i % 2) * 2;
    const phase = rand() * Math.PI * 2;
    locks.push({ index: i, a0, th, reach, swept, samples: buildSamples(a0, th, reach, swept, phase) });
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
  /** Which edge the lit band hugs: the left one when the lock faces the viewer. */
  apex: [number, number];
}

function projectLock(lock: Lock, phi: number): ProjectedLock {
  const samples = lock.samples;
  const mid = samples[Math.floor(samples.length / 2)];
  const facing = Math.cos(mid.a - phi) > 0;

  const left: number[] = [];
  const right: number[] = [];
  const boundary: number[] = [];
  let depth = 0;

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
    depth += project(s.rx * Math.sin(s.a), s.y, s.rz * Math.cos(s.a), phi).d;
  }

  const last = samples[samples.length - 1];
  const tip = project(last.rx * Math.sin(last.a), last.y + 5, last.rz * Math.cos(last.a), phi);
  return { lock, depth: depth / samples.length, left, right, boundary, apex: [tip.sx, tip.sy] };
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

export function drawLocks(g: Graphics, projected: ProjectedLock[], colour: (lock: Lock) => number): void {
  for (const p of projected) {
    const base = colour(p.lock);
    // Alternate locks are a touch darker so neighbours read as separate layers.
    const lit = p.lock.index % 2 ? shade(base, 0.95) : base;
    const shadow = shade(lit, SHADOW_FACTOR);

    const outer = [...p.left, p.apex[0], p.apex[1], ...reversePairs(p.right)];
    const litPoly = [...p.left, ...reversePairs(p.boundary)];

    g.poly(outer).fill(shadow);
    g.poly(litPoly).fill(lit);
    g.poly(outer).stroke({ width: OUTLINE_THIN, color: INK, join: 'round', cap: 'round' });
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

/**
 * The glossy highlight band on the upper-left of the head, as runs of screen points. Only the parts that
 * lie on hair are returned, so a cropped cut never gets a highlight floating on bare forehead.
 */
export function sheenRuns(locks: Lock[], phi: number): Array<Array<{ x: number; y: number }>> {
  const th = 8;
  const half = Math.hypot((HEAD.rx + th) * Math.cos(phi), (HEAD.rz + th) * Math.sin(phi));
  const top = HEAD.ry + th;
  const depthPx = 0.67 * Math.hypot(HEAD.rx * Math.sin(phi), HEAD.rz * Math.cos(phi));

  const runs: Array<Array<{ x: number; y: number }>> = [];
  let current: Array<{ x: number; y: number }> = [];
  const steps = 14;
  for (let k = 0; k <= steps; k++) {
    const ang = (205 + (57 * k) / steps) * DEG;
    const sx = 0.74 * half * Math.cos(ang);
    const sy = 0.74 * top * Math.sin(ang);
    const x = sx * Math.cos(phi) + depthPx * Math.sin(phi);
    const z = -sx * Math.sin(phi) + depthPx * Math.cos(phi);
    if (isCovered(locks, Math.atan2(x, z), sy)) {
      current.push({ x: HEAD.cx + sx, y: HEAD.cy + sy });
    } else if (current.length) {
      runs.push(current);
      current = [];
    }
  }
  if (current.length) runs.push(current);
  return runs.filter((r) => r.length > 1);
}
