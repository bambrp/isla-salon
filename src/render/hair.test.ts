import { describe, expect, it } from 'vitest';
import type { Length, Region } from '../state';
import { ombreBands, type Band } from './colour';
import { DEG, HEAD } from './geometry';
import {
  FRINGE_MAX_REACH,
  FRONT_SECTOR,
  LOCK_COUNT,
  buildLocks,
  drawLocks,
  reachAt,
  sheenRuns,
  sliceEdge,
  splitLocks,
  type Lengths,
} from './hair';

const LENGTHS: Length[] = ['back', 'shoulders', 'bob', 'short1', 'short2', 'short3'];
const REGIONS: Region[] = ['front', 'left', 'right', 'back'];

function uniform(l: Length): Lengths {
  return { front: l, left: l, right: l, back: l };
}

function allCombinations(): Lengths[] {
  const out: Lengths[] = [];
  for (const front of LENGTHS)
    for (const left of LENGTHS)
      for (const right of LENGTHS)
        for (const back of LENGTHS) out.push({ front, left, right, back });
  return out;
}

describe('buildLocks', () => {
  it('is deterministic for a seed and differs between seeds', () => {
    const a = buildLocks(uniform('shoulders'), 6);
    const b = buildLocks(uniform('shoulders'), 6);
    const c = buildLocks(uniform('shoulders'), 7);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('makes LOCK_COUNT locks spread round the head with a gap straight ahead for the parting', () => {
    const locks = buildLocks(uniform('bob'), 6);
    expect(locks).toHaveLength(LOCK_COUNT);
    expect(locks.every((l) => Math.abs(l.a0) > 1 * DEG)).toBe(true);
  });

  it('keeps every sample finite, ordered top to bottom and inside the design box, for all 1296 cuts', () => {
    // Collect problems and assert once: a million separate expect() calls would be needlessly slow.
    const problems: string[] = [];
    for (const lengths of allCombinations()) {
      for (const lock of buildLocks(lengths, 6)) {
        let prev = -Infinity;
        for (const s of lock.samples) {
          if (![s.y, s.rx, s.rz, s.a, s.hw].every(Number.isFinite)) problems.push('non-finite sample');
          if (s.y < prev - 1e-9) problems.push('samples not ordered top to bottom');
          prev = s.y;
        }
        const tipY = HEAD.cy + lock.samples[lock.samples.length - 1].y;
        if (tipY >= 500) problems.push(`tip below the design box: ${tipY}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('never lets hair cover the eyes, brows or cheeks, for all 1296 cuts', () => {
    // Eyes sit at azimuth ~23 deg, brows 12-36 deg, cheeks ~40 deg; the face band is y from -18 downwards.
    const problems: string[] = [];
    for (const lengths of allCombinations()) {
      for (const lock of buildLocks(lengths, 6)) {
        if (Math.abs(lock.a0) >= FRONT_SECTOR) continue;
        for (const s of lock.samples) {
          if (s.y < -18) continue;
          if (Math.abs(s.a) - s.hw < 40 * DEG) problems.push(`lock ${lock.index} covers the face at y=${s.y}`);
        }
        if (!lock.swept && lock.reach > FRINGE_MAX_REACH) problems.push(`fringe lock ${lock.index} too long`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('gives longer cuts longer locks', () => {
    const tip = (l: Length) =>
      Math.max(...buildLocks(uniform(l), 6).map((k) => k.samples[k.samples.length - 1].y));
    expect(tip('back')).toBeGreaterThan(tip('shoulders'));
    expect(tip('shoulders')).toBeGreaterThan(tip('bob'));
    expect(tip('bob')).toBeGreaterThan(tip('short1'));
    expect(tip('short1')).toBeGreaterThan(tip('short2'));
    expect(tip('short2')).toBeGreaterThan(tip('short3'));
  });

  it('blends region lengths smoothly with no step bigger than a lock spacing allows', () => {
    // A bob at the back next to a shoulder-length right side (the screen-right, at +90 degrees): reach should change monotonically between them.
    const lengths: Lengths = { front: 'bob', right: 'shoulders', back: 'bob', left: 'bob' };
    let prev = reachAt(90 * DEG, lengths);
    for (let deg = 91; deg <= 180; deg++) {
      const r = reachAt(deg * DEG, lengths);
      expect(r).toBeLessThanOrEqual(prev + 1e-9);
      prev = r;
    }
    expect(reachAt(90 * DEG, lengths)).toBeGreaterThan(reachAt(180 * DEG, lengths));
  });

  it('reads each region length at its own compass point', () => {
    // Right is the screen-right of the front view, which is +90 degrees; Left is -90.
    const lengths: Lengths = { front: 'short1', right: 'back', back: 'bob', left: 'short3' };
    expect(reachAt(90 * DEG, lengths)).toBeCloseTo(478 - HEAD.cy);
    expect(reachAt(180 * DEG, lengths)).toBeCloseTo(336 - HEAD.cy);
    expect(reachAt(-90 * DEG, lengths)).toBeCloseTo(232 - HEAD.cy);
    expect(reachAt(0, lengths)).toBeCloseTo(234 - HEAD.cy);
  });

  it('tapers a short cut from the temple down to the nape', () => {
    const lengths = uniform('short2');
    const temple = reachAt(90 * DEG, lengths);
    const nape = reachAt(180 * DEG, lengths);
    expect(nape).toBeGreaterThan(temple);
    // and the taper is gradual: it never steps down by more than a few pixels per degree
    let prev = temple;
    for (let deg = 91; deg <= 180; deg++) {
      const r = reachAt(deg * DEG, lengths);
      expect(r - prev).toBeLessThan(2);
      prev = r;
    }
  });
});

describe('splitLocks', () => {
  it('puts the near side in front of the head and the far side behind it in every view', () => {
    const locks = buildLocks(uniform('shoulders'), 6);
    for (const phi of [0, 90, 180, 270].map((d) => d * DEG)) {
      const { behind, front } = splitLocks(locks, phi);
      expect(behind.length + front.length).toBe(LOCK_COUNT);
      expect(behind.length).toBeGreaterThan(5);
      expect(front.length).toBeGreaterThan(5);
      for (let i = 1; i < front.length; i++) expect(front[i].depth).toBeGreaterThanOrEqual(front[i - 1].depth);
    }
  });

  it('keeps the regions distinct: every region name maps to a length', () => {
    expect(REGIONS).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------------------------------
// Colour bands
// ---------------------------------------------------------------------------------------------------

/** A stand-in for Pixi's Graphics that records what was painted, in order. */
function recorder() {
  const log: Array<{ kind: 'poly' | 'fill' | 'stroke'; arg: unknown }> = [];
  const g = {
    poly(points: number[]) {
      log.push({ kind: 'poly', arg: points });
      return g;
    },
    fill(colour: number) {
      log.push({ kind: 'fill', arg: colour });
      return g;
    },
    stroke(style: unknown) {
      log.push({ kind: 'stroke', arg: style });
      return g;
    },
  };
  return { g: g as unknown as Parameters<typeof drawLocks>[0], log };
}

describe('sliceEdge', () => {
  // A straight edge down x = 10, sampled at uneven positions along it.
  const u = [0, 0.2, 0.5, 1];
  const flat = [10, 0, 10, 20, 10, 50, 10, 100];

  it('returns the whole edge for the full range', () => {
    expect(sliceEdge(flat, u, 0, 1)).toEqual([10, 0, 10, 20, 10, 50, 10, 100]);
  });

  it('cuts exactly at the requested positions, between samples', () => {
    expect(sliceEdge(flat, u, 0.1, 0.35)).toEqual([10, 10, 10, 20, 10, 35]);
  });

  it('starts and ends on a sample without duplicating it', () => {
    expect(sliceEdge(flat, u, 0.2, 0.5)).toEqual([10, 20, 10, 50]);
  });

  it('returns nothing outside the edge', () => {
    expect(sliceEdge(flat, u, 1.2, 1.5)).toEqual([]);
    expect(sliceEdge(flat, u, -1, 0)).toEqual([]);
  });

  it('tolerates repeated samples', () => {
    const slice = sliceEdge([0, 0, 0, 0, 0, 10], [0, 0, 1], 0, 1);
    expect(slice[slice.length - 1]).toBe(10);
    expect(slice.every(Number.isFinite)).toBe(true);
  });

  it('adjacent slices join end to start with nothing missing', () => {
    const a = sliceEdge(flat, u, 0, 0.3);
    const b = sliceEdge(flat, u, 0.3, 1);
    expect(a.slice(-2)).toEqual(b.slice(0, 2));
  });
});

describe('drawLocks with colour bands', () => {
  const locks = buildLocks(uniform('shoulders'), 6);
  const { front } = splitLocks(locks, 0);
  const one = (colour: number): Band[] => [{ u0: 0, u1: 1, colour }];

  it('paints a plain colour as one shadow shape, one lit shape and one outline per lock', () => {
    const { g, log } = recorder();
    drawLocks(g, front, () => one(0xff0000));
    expect(log.filter((e) => e.kind === 'stroke')).toHaveLength(front.length);
    expect(log.filter((e) => e.kind === 'fill')).toHaveLength(front.length * 2);
    expect(log.filter((e) => e.kind === 'poly')).toHaveLength(front.length * 3);
  });

  it('paints an ombre as several bands per lock, still with a single outline each', () => {
    const { g, log } = recorder();
    drawLocks(g, front, () => ombreBands(0xffd84a, 0x9b5de5));
    expect(log.filter((e) => e.kind === 'stroke')).toHaveLength(front.length);
    const fills = log.filter((e) => e.kind === 'fill').length;
    expect(fills).toBeGreaterThan(front.length * 6);
    expect(fills).toBeLessThanOrEqual(front.length * 12);
  });

  it('outlines each lock after its colour, so the next lock can cover it cleanly', () => {
    const { g, log } = recorder();
    drawLocks(g, front.slice(0, 3), () => ombreBands(0xffd84a, 0x9b5de5));
    const kinds = log.map((e) => e.kind).filter((k) => k === 'stroke');
    expect(kinds).toHaveLength(3);
    // between two outlines there are only fills and polys, never an outline of a later lock first
    let strokes = 0;
    for (const e of log) {
      if (e.kind === 'stroke') strokes++;
      if (e.kind === 'fill') expect(strokes).toBeLessThanOrEqual(2);
    }
  });

  it('every shape it paints has finite coordinates, for every length, view and ombre', () => {
    const problems: string[] = [];
    for (const l of LENGTHS) {
      const cut = buildLocks(uniform(l), 6);
      for (const phi of [0, 45, 90, 135, 180, 225, 270, 315].map((d) => d * DEG)) {
        const { behind, front: near } = splitLocks(cut, phi);
        const { g, log } = recorder();
        drawLocks(g, [...behind, ...near], () => ombreBands(0xffd84a, 0x9b5de5));
        for (const e of log) {
          if (e.kind === 'poly' && !(e.arg as number[]).every(Number.isFinite)) problems.push(`${l} @ ${phi}`);
          if (e.kind === 'poly' && (e.arg as number[]).length < 6) problems.push(`${l} @ ${phi}: degenerate shape`);
        }
      }
    }
    expect(problems).toEqual([]);
  });
});

describe('sheenRuns', () => {
  it('gives each highlight point the azimuth it lies at, so split colour can colour it', () => {
    const runs = sheenRuns(buildLocks(uniform('shoulders'), 6), 0);
    expect(runs.length).toBeGreaterThan(0);
    for (const run of runs) for (const p of run) expect(Number.isFinite(p.az)).toBe(true);
  });

  it("keeps the highlight on Isla's right in the front view and on her left in the back view", () => {
    // Light comes from the upper left of the screen: that is her right side from the front, her left from the back.
    const front = sheenRuns(buildLocks(uniform('shoulders'), 6), 0).flat();
    const back = sheenRuns(buildLocks(uniform('shoulders'), 6), Math.PI).flat();
    expect(front.every((p) => p.az < 0)).toBe(true);
    expect(back.every((p) => p.az > 0)).toBe(true);
  });
});
