import { get } from 'svelte/store';
import { beforeEach, describe, expect, it } from 'vitest';
import { CAST, ISLA, startingHair } from './cast';
import { browLift, browTop } from './features';
import { HAIR_SWATCHES } from './render/colour';
import { DEG } from './render/geometry';
import { buildLocks } from './render/hair';
import { positionsOf } from './cut';
import { chooseLength, cutSwipe, initialState, resetSalon, salon, setColour, setCurl, setShine, setStage, STAGES, switchCharacter } from './state';

describe('the cast', () => {
  it('has nine people, Isla first and unchanged, each different', () => {
    expect(CAST).toHaveLength(9);
    expect(CAST[0].character).toBe(ISLA);
    expect(CAST[0].start.length).toEqual({ front: 'short3', left: 'shoulders', right: 'shoulders', back: 'shoulders' });
    expect(new Set(CAST.map((m) => m.character.id)).size).toBe(9);
    expect(new Set(CAST.map((m) => m.character.seed)).size).toBe(9);
    expect(new Set(CAST.map((m) => m.character.name)).size).toBe(9);
  });
  it('mixes ages, face shapes, tones and eye colours, with a few Adam\'s apples on older boys and men', () => {
    expect(Math.min(...CAST.map((m) => m.age))).toBeLessThan(10);
    expect(Math.max(...CAST.map((m) => m.age))).toBeGreaterThan(60);
    expect(new Set(CAST.map((m) => m.character.face)).size).toBe(4);
    expect(new Set(CAST.map((m) => m.character.skin)).size).toBeGreaterThanOrEqual(7);
    expect(new Set(CAST.map((m) => m.character.eyes)).size).toBe(4);
    const apples = CAST.filter((m) => m.character.adamsApple);
    expect(apples.length).toBeGreaterThanOrEqual(3);
    for (const a of apples) expect(a.age).toBeGreaterThanOrEqual(14);
  });
  it('gives everyone a natural colour from the colour chooser', () => {
    for (const m of CAST) expect(HAIR_SWATCHES.some((s) => s.hex === m.character.hair)).toBe(true);
  });
  it('starts everyone with hair that clears their own brows', () => {
    for (const m of CAST) {
      const p = positionsOf(m.start.length);
      const top = browTop(m.character.brows);
      for (const lock of buildLocks(p, m.character.seed, undefined, browLift(m.character.brows))) {
        if (Math.abs(lock.a0) >= 0.9) continue;
        for (const s of lock.samples) if (s.y >= top - 1) expect(Math.abs(s.a) - s.hw, `${m.character.name} lock ${lock.index}`).toBeGreaterThanOrEqual(40 * DEG);
      }
    }
  });
});

describe('switching characters', () => {
  beforeEach(() => salon.set(initialState()));

  it('opens in the character stage with the six stages in order', () => {
    expect(STAGES).toEqual(['character', 'wash', 'colour', 'cut', 'style', 'photo']);
    expect(get(salon).stage).toBe('character');
  });
  it('brings someone in with their own cut, curl and natural colour', () => {
    switchCharacter('amara');
    const s = get(salon);
    expect(s.character.name).toBe('Amara');
    expect(s.hair.curl).toBe(3);
    expect(s.hair.colour.a).toBe(s.character.hair);
    expect(s.hair.length).toEqual(startingHair('amara').length);
  });
  it('keeps each person\'s dye, curl, shine and waiting cut while others have their turn', () => {
    setColour('a', '#9b5de5');
    setCurl(2);
    setShine(true);
    chooseLength('all', 'shaved');
    cutSwipe();
    const before = get(salon);
    switchCharacter('tom');
    setColour('a', '#2ed3a5');
    switchCharacter('isla');
    const back = get(salon);
    expect(back.hair.colour.a).toBe('#9b5de5');
    expect(back.hair.curl).toBe(2);
    expect(back.hair.shine).toBe(true);
    expect(back.cut).toEqual(before.cut);
    switchCharacter('tom');
    expect(get(salon).hair.colour.a).toBe('#2ed3a5');
  });
  it('dries them and turns the tap off when they change places', () => {
    setStage('wash');
    salon.update((s) => ({ ...s, hair: { ...s.hair, wetness: 1, foam: 0.5 }, wash: { ...s.wash, pressure: 0.5 } }));
    switchCharacter('kenji');
    expect(get(salon).wash.pressure).toBe(0);
    switchCharacter('isla');
    expect(get(salon).hair.wetness).toBe(0);
    expect(get(salon).hair.foam).toBe(0);
  });
  it('does nothing for the person already in the chair or someone unknown, and scene resets on a change', () => {
    const e = get(salon).epoch;
    switchCharacter('isla');
    switchCharacter('nobody');
    expect(get(salon).epoch).toBe(e);
    switchCharacter('grace');
    expect(get(salon).epoch).toBe(e + 1);
  });
  it('starts over for the current person only, back to their own starting look', () => {
    switchCharacter('mateo');
    setColour('a', '#ff3b4e');
    switchCharacter('priya');
    setColour('a', '#2ed3a5');
    setCurl(3);
    resetSalon();
    const s = get(salon);
    expect(s.character.name).toBe('Priya');
    expect(s.hair.curl).toBe(0);
    expect(s.hair.colour.a).toBe(s.character.hair);
    switchCharacter('mateo');
    expect(get(salon).hair.colour.a).toBe('#ff3b4e');
  });
});

describe('changing a look', () => {
  beforeEach(() => salon.set(initialState()));
  const seeded = (n: number) => { let x = n; return () => ((x = (x * 16807) % 2147483647) - 1) / 2147483646; };

  it('randomises every feature, in range, and keeps the name, seed and hair work', async () => {
    const { randomiseLook } = await import('./state');
    const { SKIN_TONES, EYE_COLOURS, FACE_SHAPES, BROW_HEIGHTS } = await import('./features');
    const seen = { skin: new Set<number>(), eyes: new Set<number>(), face: new Set<string>(), height: new Set<string>(), apple: new Set<boolean>(), hair: new Set<string>() };
    const rand = seeded(5);
    for (let i = 0; i < 300; i++) {
      randomiseLook(rand);
      const c = get(salon).character;
      expect(c.name).toBe('Isla');
      expect(c.seed).toBe(6);
      expect(SKIN_TONES.map((t) => t.hex)).toContain(c.skin);
      expect(EYE_COLOURS.map((e) => e.hex)).toContain(c.eyes);
      expect(FACE_SHAPES).toContain(c.face);
      expect(BROW_HEIGHTS).toContain(c.brows.height);
      expect(HAIR_SWATCHES.map((s) => s.hex)).toContain(c.hair);
      for (const v of [c.nose, c.brows.thickness, c.brows.arch, c.brows.spacing]) expect(v >= 0 && v <= 1).toBe(true);
      seen.skin.add(c.skin); seen.eyes.add(c.eyes); seen.face.add(c.face); seen.height.add(c.brows.height); seen.apple.add(c.adamsApple); seen.hair.add(c.hair);
    }
    expect(seen.skin.size).toBe(9);
    expect(seen.eyes.size).toBe(4);
    expect(seen.face.size).toBe(4);
    expect(seen.height.size).toBe(3);
    expect(seen.apple.size).toBe(2);
    expect(seen.hair.size).toBe(HAIR_SWATCHES.length);
    expect(get(salon).hair.length).toEqual(startingHair('isla').length);
  });
  it('lets undyed hair follow the natural colour, but leaves a deliberate dye alone', async () => {
    const { setCharacterLook } = await import('./state');
    setCharacterLook({ hair: '#ff3b4e' });
    expect(get(salon).hair.colour.a).toBe('#ff3b4e');
    setColour('a', '#9b5de5');
    setCharacterLook({ hair: '#2ed3a5' });
    expect(get(salon).character.hair).toBe('#2ed3a5');
    expect(get(salon).hair.colour.a).toBe('#9b5de5');
  });
  it('keeps the brows following the natural colour', async () => {
    const { browColour } = await import('./render/character');
    const { setCharacterLook } = await import('./state');
    setCharacterLook({ hair: '#ffffff' });
    expect(browColour(get(salon).character.hair)).toBe(0x808080);
  });
  it('resets a character to their preset look, for everyone in the cast', async () => {
    const { randomiseLook, resetLook } = await import('./state');
    for (const m of CAST) {
      switchCharacter(m.character.id);
      randomiseLook(seeded(m.age));
      resetLook();
      expect(get(salon).character).toEqual(m.character);
    }
  });
  it('keeps edits when someone else has a turn', async () => {
    const { setCharacterLook } = await import('./state');
    setCharacterLook({ nose: 1, face: 'square' });
    switchCharacter('leo');
    switchCharacter('isla');
    expect(get(salon).character.nose).toBe(1);
    expect(get(salon).character.face).toBe('square');
  });
});
