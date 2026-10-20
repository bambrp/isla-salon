import { describe, expect, it } from 'vitest';
import { initialState, nextView, sceneFor, VIEWS } from './state';

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
