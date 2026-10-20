import { get } from 'svelte/store';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  initialState,
  nextView,
  salon,
  sceneFor,
  setColour,
  setColourMode,
  VIEWS,
} from './state';

describe('view rotation', () => {
  it('cycles front, left, back, right and wraps', () => {
    expect(nextView('front')).toBe('left');
    expect(nextView('left')).toBe('back');
    expect(nextView('back')).toBe('right');
    expect(nextView('right')).toBe('front');
  });

  it('returns to the start after one full turn', () => {
    let v = VIEWS[0];
    for (let i = 0; i < VIEWS.length; i++) v = nextView(v);
    expect(v).toBe(VIEWS[0]);
  });
});

describe('backdrop scene', () => {
  it('uses the sink for washing and the mirror otherwise', () => {
    expect(sceneFor('wash')).toBe('sink');
    expect(sceneFor('colour')).toBe('mirror');
    expect(sceneFor('cut')).toBe('mirror');
    expect(sceneFor('style')).toBe('mirror');
  });
});

describe('initial state', () => {
  it('starts as Isla, front view, washing stage', () => {
    const s = initialState();
    expect(s.character.name).toBe('Isla');
    expect(s.view).toBe('front');
    expect(s.stage).toBe('wash');
    expect(s.hair.colour.mode).toBe('single');
  });
});

describe('colour changes', () => {
  beforeEach(() => salon.set(initialState()));

  it('starts as a single golden blonde', () => {
    expect(get(salon).hair.colour).toEqual({ mode: 'single', a: '#ffd84a', b: '#ffd84a' });
  });

  it('switching to split or ombre shows an effect straight away', () => {
    setColourMode('split');
    const c = get(salon).hair.colour;
    expect(c.mode).toBe('split');
    expect(c.b).not.toBe(c.a);
  });

  it('sets colours by slot and normalises them', () => {
    setColour('a', '#F00');
    setColourMode('ombre');
    setColour('b', '3A86FF');
    expect(get(salon).hair.colour).toEqual({ mode: 'ombre', a: '#ff0000', b: '#3a86ff' });
  });

  it('ignores a colour that is not a colour', () => {
    const before = get(salon).hair.colour;
    setColour('a', 'banana');
    expect(get(salon).hair.colour).toEqual(before);
  });

  it('leaves everything else alone', () => {
    const before = get(salon);
    setColourMode('split');
    setColour('b', '#00ff00');
    const after = get(salon);
    expect(after.hair.length).toEqual(before.hair.length);
    expect(after.view).toBe(before.view);
    expect(after.stage).toBe(before.stage);
    expect(after.character).toBe(before.character);
  });
});
