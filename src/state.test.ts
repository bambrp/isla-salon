import { get } from 'svelte/store';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  initialState,
  nextView,
  salon,
  sceneFor,
  setColour,
  setColourMode,
  resetSalon,
  setCurl,
  setLength,
  setStyleProduct,
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
  it('starts as Isla, front view, in the character stage', () => {
    const s = initialState();
    expect(s.character.name).toBe('Isla');
    expect(s.view).toBe('front');
    expect(s.stage).toBe('character');
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

describe('styling actions', () => {
  beforeEach(() => salon.set(initialState()));

  it('starts straight with no product', () => {
    expect(get(salon).hair.curl).toBe(0);
    expect(get(salon).hair.product).toBe('none');
  });

  it('sets the curl and the product independently', () => {
    setCurl(2);
    setStyleProduct('flat');
    expect(get(salon).hair.curl).toBe(2);
    expect(get(salon).hair.product).toBe('flat');
  });

  it('leaves the state alone when nothing changes', () => {
    const before = get(salon);
    setCurl(0);
    setStyleProduct('none');
    expect(get(salon)).toBe(before);
  });
});

describe('resetting', () => {
  beforeEach(() => salon.set(initialState()));

  it('puts the hair back but keeps the stage, the view and the sound setting', () => {
    setCurl(3);
    setStyleProduct('flat');
    setColour('a', '#ff0000');
    setLength('all', 'short3');
    salon.update((s) => ({ ...s, stage: 'style', view: 'back', audio: { muted: true } }));
    resetSalon();
    const s = get(salon);
    expect(s.hair).toEqual(initialState().hair);
    expect(s.stage).toBe('style');
    expect(s.view).toBe('back');
    expect(s.audio.muted).toBe(true);
  });

  it('counts resets, so the scene can tell a reset from an ordinary change', () => {
    expect(get(salon).epoch).toBe(0);
    resetSalon();
    resetSalon();
    expect(get(salon).epoch).toBe(2);
  });
});

describe('shine', () => {
  it('is a stored status that a reset clears', async () => {
    const { setShine, resetSalon } = await import('./state');
    expect(get(salon).hair.shine).toBe(false);
    setShine(true);
    expect(get(salon).hair.shine).toBe(true);
    resetSalon();
    expect(get(salon).hair.shine).toBe(false);
  });
});

describe('leaving the sink', () => {
  it('clears the washing but keeps the shine', async () => {
    const { setShine, setStage, commitWash } = await import('./state');
    salon.set({ ...initialState(), stage: 'wash' });
    commitWash({ wet: 1, foam: 0.5, cream: 0.4, clean: 1, conditioned: 0.9 });
    setShine(true);
    setStage('cut');
    const h = get(salon).hair;
    expect([h.wetness, h.foam, h.cream, h.conditioned]).toEqual([0, 0, 0, 0]);
    expect(h.cleanliness).toBe(0.4);
    expect(h.shine).toBe(true);
    setStage('wash');
    expect(get(salon).hair.wetness).toBe(0);
  });
  it('does not touch the washing when moving between other stages', async () => {
    const { setStage } = await import('./state');
    const { commitWash } = await import('./state');
    setStage('cut');
    commitWash({ wet: 0.7, foam: 0, cream: 0, clean: 0.9, conditioned: 0 });
    setStage('style');
    expect(get(salon).hair.wetness).toBe(0.7);
  });
});

describe('photo booth background', () => {
  it('only changes the scene in the photo stage, and keeps the choice through start over', async () => {
    const { sceneFor, initialState, resetSalon, salon, setBoothBackground, setStage } = await import('./state');
    expect(sceneFor('photo', 'beach')).toBe('beach');
    expect(sceneFor('photo', 'salon')).toBe('mirror');
    expect(sceneFor('cut', 'beach')).toBe('mirror');
    expect(sceneFor('wash', 'forest')).toBe('sink');
    expect(initialState().booth).toBe('salon');
    salon.set(initialState());
    setStage('photo');
    setBoothBackground('city');
    resetSalon();
    expect(get(salon).booth).toBe('city');
  });
});
