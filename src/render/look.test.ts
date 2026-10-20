import { describe, expect, it } from 'vitest';
import type { Length, Region } from '../state';
import { DEG, HEAD } from './geometry';
import { FRINGE_MAX_REACH, FRONT_SECTOR, buildLocks, type Lengths } from './hair';
import { NO_LOOK, lookOf, sameLook, type Look } from './look';

const LENGTHS: Length[] = ['back', 'shoulders', 'bob', 'short1', 'short2', 'short3'];
const uniform = (l: Length): Lengths => ({ front: l, left: l, right: l, back: l });

function allCombinations(): Lengths[] {
  const out: Lengths[] = [];
  for (const front of LENGTHS)
    for (const left of LENGTHS)
      for (const right of LENGTHS) for (const back of LENGTHS) out.push({ front, left, right, back });
  return out;
}

// Every look the panel can ask for, plus a few in between, since the scene builds hair part-way through a change.
const LOOKS: Look[] = [
  lookOf(3, 'none'),
  lookOf(0, 'spiky'),
  lookOf(0, 'flat'),
  lookOf(2, 'spiky'),
  lookOf(3, 'flat'),
  { curl: 1.4, spiky: 0.5, flat: 0.3 },
];

describe('looks', () => {
  it('plain hair is exactly what it was before styling existed', () => {
    expect(buildLocks(uniform('bob'), 6, NO_LOOK)).toEqual(buildLocks(uniform('bob'), 6));
  });

  it('describes curl and product as numbers', () => {
    expect(lookOf(2, 'none')).toEqual({ curl: 2, spiky: 0, flat: 0 });
    expect(lookOf(0, 'spiky')).toEqual({ curl: 0, spiky: 1, flat: 0 });
    expect(lookOf(0, 'flat')).toEqual({ curl: 0, spiky: 0, flat: 1 });
    expect(sameLook(lookOf(1, 'flat'), lookOf(1, 'flat'))).toBe(true);
    expect(sameLook(lookOf(1, 'flat'), lookOf(1, 'none'))).toBe(false);
  });

  it('is deterministic for a look', () => {
    expect(buildLocks(uniform('shoulders'), 6, lookOf(3, 'spiky'))).toEqual(buildLocks(uniform('shoulders'), 6, lookOf(3, 'spiky')));
  });

  it('keeps every sample finite, ordered and inside the design box, for all 1296 cuts and every look', () => {
    const problems: string[] = [];
    for (const look of LOOKS) {
      for (const lengths of allCombinations()) {
        for (const lock of buildLocks(lengths, 6, look)) {
          let prev = -Infinity;
          for (const s of lock.samples) {
            if (![s.y, s.rx, s.rz, s.a, s.hw].every(Number.isFinite) || s.hw <= 0) problems.push('bad sample');
            if (s.y < prev - 1e-9) problems.push('samples not ordered');
            if (HEAD.cy + s.y < 0) problems.push(`hair above the picture: ${HEAD.cy + s.y}`);
            prev = s.y;
          }
          if (HEAD.cy + lock.samples[lock.samples.length - 1].y >= 500) problems.push('tip below the design box');
        }
      }
    }
    expect(problems.slice(0, 5)).toEqual([]);
  });

  it('never lets styled hair cover the eyes, brows or cheeks, for all 1296 cuts and every look', () => {
    const problems: string[] = [];
    for (const look of LOOKS) {
      for (const lengths of allCombinations()) {
        for (const lock of buildLocks(lengths, 6, look)) {
          if (Math.abs(lock.a0) >= FRONT_SECTOR) continue;
          for (const s of lock.samples) {
            if (s.y < -18) continue;
            if (Math.abs(s.a) - s.hw < 40 * DEG) problems.push(`lock ${lock.index} covers the face at y=${s.y}`);
          }
          if (!lock.swept && lock.reach > FRINGE_MAX_REACH) problems.push(`fringe lock ${lock.index} too long`);
        }
      }
    }
    expect(problems.slice(0, 5)).toEqual([]);
  });

  /** Total sideways wobble of a lock: how much its centre line moves about its own average. */
  function wobble(look: Look, length: Length): number {
    let total = 0;
    for (const lock of buildLocks(uniform(length), 6, look)) {
      const a = lock.samples.map((s) => s.a);
      const mean = a.reduce((x, y) => x + y, 0) / a.length;
      total += a.reduce((x, y) => x + Math.abs(y - mean), 0) / a.length;
    }
    return total;
  }

  it('tighter curl wobbles more, at every length', () => {
    for (const l of LENGTHS) {
      const w = [0, 1, 2, 3].map((c) => wobble(lookOf(c as 0 | 1 | 2 | 3, 'none'), l));
      expect(w[1]).toBeGreaterThan(w[0]);
      expect(w[2]).toBeGreaterThan(w[1]);
      expect(w[3]).toBeGreaterThan(w[2]);
    }
  });

  it('curled hair hangs a little shorter than straight', () => {
    const tip = (look: Look) => Math.max(...buildLocks(uniform('back'), 6, look).map((k) => k.reach));
    expect(tip(lookOf(3, 'none'))).toBeLessThan(tip(NO_LOOK));
  });

  it('flat product presses the hair thin and takes most of the curl out', () => {
    const thick = (look: Look) => buildLocks(uniform('bob'), 6, look).reduce((x, k) => x + k.th, 0);
    expect(thick(lookOf(0, 'flat'))).toBeLessThan(0.4 * thick(NO_LOOK));
    // The curl's own share of the wobble, with the natural wave and the front sweep taken out.
    const base = wobble(lookOf(0, 'flat'), 'bob');
    const curlOnly = (look: Look) => wobble(look, 'bob') - wobble(lookOf(0, look.flat ? 'flat' : 'none'), 'bob');
    expect(base).toBeGreaterThan(0);
    expect(curlOnly(lookOf(3, 'flat'))).toBeLessThan(0.3 * curlOnly(lookOf(3, 'none')));
  });

  it('spiky hair stands taller at the crown, in tufts of different heights', () => {
    const crown = (look: Look) => buildLocks(uniform('short2'), 6, look).map((k) => k.samples[0].y);
    const plain = crown(NO_LOOK);
    const spiky = crown(lookOf(0, 'spiky'));
    expect(Math.min(...spiky)).toBeLessThan(Math.min(...plain) - 8);
    expect(new Set(spiky.map((y) => Math.round(y))).size).toBeGreaterThan(2);
  });

  it('spiky is weaker on long hair, which is too heavy to stand up', () => {
    const lift = (l: Length) => {
      const plain = Math.min(...buildLocks(uniform(l), 6, NO_LOOK).map((k) => k.samples[0].y));
      const spiky = Math.min(...buildLocks(uniform(l), 6, lookOf(0, 'spiky')).map((k) => k.samples[0].y));
      return plain - spiky;
    };
    expect(lift('short2')).toBeGreaterThan(lift('back'));
    expect(lift('back')).toBeGreaterThan(0);
  });

  it('changing smoothly between looks never jumps', () => {
    // The scene tweens the numbers, so hair built a hair's breadth apart must be a hair's breadth apart.
    const region: Region = 'back';
    expect(region).toBe('back');
    const a = buildLocks(uniform('bob'), 6, { curl: 1.5, spiky: 0.3, flat: 0 });
    const b = buildLocks(uniform('bob'), 6, { curl: 1.5, spiky: 0.31, flat: 0 });
    let worst = 0;
    for (let i = 0; i < a.length; i++)
      for (let k = 0; k < a[i].samples.length; k++) worst = Math.max(worst, Math.abs(a[i].samples[k].y - b[i].samples[k].y), Math.abs(a[i].samples[k].a - b[i].samples[k].a) * 100);
    expect(worst).toBeLessThan(1);
  });
});
