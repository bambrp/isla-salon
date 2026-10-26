import { describe, expect, it } from 'vitest';
import { DEG } from './render/geometry';
import { reachAt } from './render/hair';
import {
  changedRegions,
  isHiddenIn,
  isShorter,
  LENGTHS,
  REGION_AZIMUTH,
  REGIONS,
  regionOfAzimuth,
} from './cut';
import { initialState, selectCutTarget, setLength, salon } from './state';
import { get } from 'svelte/store';
import { beforeEach } from 'vitest';

describe('regions', () => {
  it('maps every region centre back to itself', () => {
    for (const r of REGIONS) expect(regionOfAzimuth(REGION_AZIMUTH[r])).toBe(r);
  });

  it('puts the screen-left of the front view in the Left region', () => {
    // The front view shows negative azimuths on the screen-left.
    expect(regionOfAzimuth(-80 * DEG)).toBe('left');
    expect(regionOfAzimuth(80 * DEG)).toBe('right');
  });

  it('splits at 45 and 135 degrees and wraps round the back', () => {
    expect(regionOfAzimuth(44 * DEG)).toBe('front');
    expect(regionOfAzimuth(46 * DEG)).toBe('right');
    expect(regionOfAzimuth(134 * DEG)).toBe('right');
    expect(regionOfAzimuth(136 * DEG)).toBe('back');
    expect(regionOfAzimuth(-136 * DEG)).toBe('back');
    expect(regionOfAzimuth(460 * DEG)).toBe('right');
  });

  it('agrees with the hair: a long Left region hangs at the screen-left (negative azimuth)', () => {
    const base = { front: 'short3', left: 'back', right: 'short3', back: 'short3' } as const;
    expect(reachAt(-90 * DEG, base)).toBeGreaterThan(reachAt(90 * DEG, base) + 100);
  });

  it('knows which region is out of sight', () => {
    expect(isHiddenIn('back', 'front')).toBe(true);
    expect(isHiddenIn('front', 'back')).toBe(true);
    expect(isHiddenIn('front', 'front')).toBe(false);
    // Sides are edge-on in the front view, still visible.
    expect(isHiddenIn('left', 'front')).toBe(false);
    expect(isHiddenIn('right', 'front')).toBe(false);
    // The left view shows the Left region face on, and hides the Right one.
    expect(isHiddenIn('left', 'left')).toBe(false);
    expect(isHiddenIn('right', 'left')).toBe(true);
    expect(isHiddenIn('right', 'right')).toBe(false);
    expect(isHiddenIn('left', 'right')).toBe(true);
  });
});

describe('comparing cuts', () => {
  it('orders lengths from longest to shortest', () => {
    expect(isShorter('back', 'bob')).toBe(true);
    expect(isShorter('short3', 'bob')).toBe(false);
    expect(isShorter('bob', 'bob')).toBe(false);
    expect(LENGTHS).toHaveLength(8);
  });

  it('lists only the regions that changed', () => {
    const a = initialState().hair.length;
    expect(changedRegions(a, a)).toEqual([]);
    expect(changedRegions(a, { ...a, back: 'bob' })).toEqual(['back']);
  });
});

describe('cut actions', () => {
  beforeEach(() => salon.set(initialState()));

  it('starts with the whole head selected', () => {
    expect(get(salon).cutTarget).toBe('all');
  });

  it('changes one region only', () => {
    setLength('back', 'bob');
    expect(get(salon).hair.length).toEqual({ front: 'short3', left: 'shoulders', right: 'shoulders', back: 'bob' });
  });

  it('changes every region for the whole head', () => {
    setLength('all', 'short2');
    expect(Object.values(get(salon).hair.length)).toEqual(['short2', 'short2', 'short2', 'short2']);
  });

  it('leaves the state object alone when nothing changes', () => {
    const before = get(salon);
    setLength('back', 'shoulders');
    expect(get(salon)).toBe(before);
    selectCutTarget('all');
    expect(get(salon)).toBe(before);
  });

  it('remembers the chosen region', () => {
    selectCutTarget('left');
    expect(get(salon).cutTarget).toBe('left');
  });
});
