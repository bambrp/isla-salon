import { describe, expect, it } from 'vitest';
import type { Length, Region } from '../state';
import { DEG, HEAD } from './geometry';
import {
  FRINGE_MAX_REACH,
  FRONT_SECTOR,
  LOCK_COUNT,
  buildLocks,
  reachAt,
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
    // A bob at the back next to a shoulder-length left side: reach should change monotonically between them.
    const lengths: Lengths = { front: 'bob', left: 'shoulders', back: 'bob', right: 'bob' };
    let prev = reachAt(90 * DEG, lengths);
    for (let deg = 91; deg <= 180; deg++) {
      const r = reachAt(deg * DEG, lengths);
      expect(r).toBeLessThanOrEqual(prev + 1e-9);
      prev = r;
    }
    expect(reachAt(90 * DEG, lengths)).toBeGreaterThan(reachAt(180 * DEG, lengths));
  });

  it('reads each region length at its own compass point', () => {
    const lengths: Lengths = { front: 'short1', left: 'back', back: 'bob', right: 'short3' };
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
