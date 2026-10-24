import { get } from 'svelte/store';
import { beforeEach, describe, expect, it } from 'vitest';
import { LENGTHS, SWIPES_TO_CUT, lengthsOf, movingRegions, planPosition, positionOf, positionsOf } from './cut';
import { buildLocks, reachAt, tableAt, SIDE_REACH } from './render/hair';
import { chooseLength, cutSwipe, hairPosition, initialState, salon, selectCutTarget, setStage } from './state';

const start = () => positionsOf(initialState().hair.length);

describe('cut positions', () => {
  it('number the lengths from longest to shortest', () => {
    expect(LENGTHS.map(positionOf)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(lengthsOf({ front: 0.4, left: 2.6, right: 5, back: 1.49 })).toEqual({ front: 'back', left: 'short1', right: 'short3', back: 'shoulders' });
  });

  it('moves an eighth of the way with each swipe', () => {
    const plan = { from: { front: 0, left: 0, right: 4, back: 2 }, to: { front: 0, left: 8 / 8 * 4, right: 0, back: 2 }, swipes: 0 };
    expect(planPosition(plan).left).toBe(0);
    expect(planPosition({ ...plan, swipes: 1 }).left).toBeCloseTo(0.5);
    expect(planPosition({ ...plan, swipes: 4 }).left).toBeCloseTo(2);
    expect(planPosition({ ...plan, swipes: SWIPES_TO_CUT }).left).toBeCloseTo(4);
    expect(planPosition({ ...plan, swipes: 4 }).right).toBeCloseTo(2);
  });

  it('says which parts are moving, and whether each is getting shorter', () => {
    const plan = { from: { front: 1, left: 3, right: 3, back: 2 }, to: { front: 1, left: 5, right: 0, back: 2 }, swipes: 2 };
    expect(movingRegions(plan)).toEqual([
      { region: 'left', shorter: true },
      { region: 'right', shorter: false },
    ]);
  });
});

describe('hair between two lengths', () => {
  it('matches the whole lengths exactly at whole positions', () => {
    for (const [i, length] of LENGTHS.entries()) expect(tableAt(SIDE_REACH, i)).toBe(SIDE_REACH[length]);
    const whole = { front: 'bob', left: 'short1', right: 'back', back: 'short3' } as const;
    const asNumbers = { front: 2, left: 3, right: 0, back: 5 };
    for (let a = -3; a <= 3; a += 0.1) expect(reachAt(a, asNumbers)).toBeCloseTo(reachAt(a, whole), 9);
  });

  it('shortens smoothly and steadily as the position rises, never jumping', () => {
    let last = Infinity;
    for (let p = 0; p <= 5; p += 0.125) {
      const reach = reachAt(Math.PI / 2, { front: 0, left: 0, right: p, back: 0 });
      expect(reach).toBeLessThanOrEqual(last + 1e-9);
      if (last !== Infinity) expect(last - reach).toBeLessThan(80);
      last = reach;
    }
  });

  it('builds sound hair at every eighth step between any two lengths', () => {
    const problems: string[] = [];
    for (let from = 0; from < 6; from++) {
      for (let to = 0; to < 6; to++) {
        for (let k = 0; k <= 8; k++) {
          const p = from + ((to - from) * k) / 8;
          const locks = buildLocks({ front: p, left: p, right: 6 - 1 - p, back: p }, 6);
          for (const lock of locks) {
            for (const s of lock.samples) {
              if (![s.y, s.rx, s.rz, s.a, s.hw].every(Number.isFinite)) problems.push(`non-finite at ${from}->${to} step ${k}`);
            }
          }
        }
      }
    }
    expect(problems).toEqual([]);
  });
});

describe('choosing a length and swiping', () => {
  beforeEach(() => salon.set(initialState()));

  it('does not change the hair when a length is chosen', () => {
    const before = hairPosition(get(salon));
    chooseLength('all', 'short2');
    expect(hairPosition(get(salon))).toEqual(before);
    expect(get(salon).hair.length).toEqual(initialState().hair.length);
    expect(get(salon).cut?.swipes).toBe(0);
  });

  it('moves the hair an eighth of the way with each swipe and finishes on the eighth', () => {
    chooseLength('all', 'short2');
    const s0 = start();
    for (let k = 1; k < SWIPES_TO_CUT; k++) {
      cutSwipe();
      const p = hairPosition(get(salon));
      expect(p.left).toBeCloseTo(s0.left + ((4 - s0.left) * k) / 8, 9);
      expect(get(salon).cut?.swipes).toBe(k);
    }
    cutSwipe();
    expect(get(salon).cut).toBeNull();
    expect(get(salon).hair.length).toEqual({ front: 'short2', left: 'short2', right: 'short2', back: 'short2' });
  });

  it('does nothing when there is nothing to cut', () => {
    const before = get(salon);
    cutSwipe();
    expect(get(salon)).toBe(before);
    chooseLength('left', 'shoulders');
    expect(get(salon).cut).toBeNull();
  });

  it('only changes the chosen part', () => {
    selectCutTarget('back');
    chooseLength('back', 'short3');
    for (let k = 0; k < SWIPES_TO_CUT; k++) cutSwipe();
    expect(get(salon).hair.length).toEqual({ ...initialState().hair.length, back: 'short3' });
  });

  it('carries on from where the hair has got to when another length is chosen part-way', () => {
    chooseLength('all', 'short3');
    for (let k = 0; k < 4; k++) cutSwipe();
    const half = hairPosition(get(salon));
    chooseLength('all', 'back');
    expect(hairPosition(get(salon))).toEqual(half);
    expect(get(salon).cut?.swipes).toBe(0);
    expect(get(salon).cut?.to).toEqual({ front: 0, left: 0, right: 0, back: 0 });
    cutSwipe();
    expect(hairPosition(get(salon)).left).toBeLessThan(half.left);
  });

  it('keeps other parts heading where they were going', () => {
    chooseLength('left', 'short3');
    cutSwipe();
    cutSwipe();
    chooseLength('right', 'back');
    const plan = get(salon).cut!;
    expect(plan.to.left).toBe(5);
    expect(plan.to.right).toBe(0);
    expect(plan.from.left).toBeGreaterThan(positionOf('shoulders'));
  });

  it('goes back to plain hair if the hair is sent back to where it is', () => {
    chooseLength('all', 'short3');
    chooseLength('all', 'shoulders');
    chooseLength('front', 'short3');
    expect(get(salon).cut).toBeNull();
    expect(get(salon).hair.length).toEqual(initialState().hair.length);
  });

  it('keeps the cut waiting when she moves to another stage', () => {
    chooseLength('all', 'bob');
    cutSwipe();
    setStage('style');
    expect(get(salon).cut?.swipes).toBe(1);
    expect(hairPosition(get(salon)).left).toBeGreaterThan(1);
  });
});

describe('lightening the hair', () => {
  it('mixes a colour towards white', async () => {
    const { lightenColour } = await import('./render/scene');
    expect(lightenColour(0x102030, 0)).toBe(0x102030);
    expect(lightenColour(0x102030, 1)).toBe(0xffffff);
    const half = lightenColour(0xffd84a, 0.5);
    for (const shift of [16, 8, 0]) expect((half >> shift) & 255).toBeGreaterThanOrEqual((0xffd84a >> shift) & 255);
  });
});
