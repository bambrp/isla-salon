import { BROW_HEIGHTS, DEFAULT_FEATURES, EYE_COLOURS, FACE_SHAPES, SKIN_TONES, cleanFeatures, type Brows, type FaceFeatures } from './features';
import { HAIR_SWATCHES } from './render/colour';
import type { Length, Region } from './state';

/** Who is in the chair: a name, colouring, face features (nose, brows, face shape, Adam's apple) and the seed that varies their hair. */
export interface CharacterDef extends FaceFeatures {
  id: string;
  name: string;
  skin: number;
  eyes: number;
  /** Their natural hair colour (the brows follow it; the dye is separate). */
  hair: string;
  seed: number;
}

/** A character from the parts that differ from Isla's; everything left out takes her value. */
export function makeCharacter(
  c: Pick<CharacterDef, 'id' | 'name'> & Partial<Omit<CharacterDef, 'id' | 'name' | 'brows'>> & { brows?: Partial<Brows> },
): CharacterDef {
  const f = cleanFeatures({
    nose: c.nose ?? DEFAULT_FEATURES.nose,
    adamsApple: c.adamsApple ?? DEFAULT_FEATURES.adamsApple,
    brows: { ...DEFAULT_FEATURES.brows, ...c.brows },
    face: c.face ?? DEFAULT_FEATURES.face,
  });
  return { ...f, id: c.id, name: c.name, skin: c.skin ?? 0xffd9b8, eyes: c.eyes ?? 0x3a86ff, hair: c.hair ?? '#ffd84a', seed: c.seed ?? 6 };
}

/** The hair work a character starts with, and returns to on Start over: the cut, the curl and the styling product. */
export interface HairStart {
  length: Record<Region, Length>;
  curl: 0 | 1 | 2 | 3;
  product: 'none' | 'flat';
}

export interface CastMember {
  character: CharacterDef;
  /** Shown beside the name; the drawing is the same for every age, and age shows through the features. */
  age: number;
  start: HairStart;
}

const skin = (id: string): number => SKIN_TONES.find((t) => t.id === id)!.hex;
const eyes = (id: string): number => EYE_COLOURS.find((e) => e.id === id)!.hex;
const all = (l: Length, front: Length = l): Record<Region, Length> => ({ front, left: l, right: l, back: l });

/** Isla first (exactly as she has always been), then eight more of different ages, genders and backgrounds. */
export const CAST: readonly CastMember[] = [
  {
    character: makeCharacter({ id: 'isla', name: 'Isla', skin: skin('pale'), eyes: eyes('blue'), hair: '#ffd84a', seed: 6 }),
    age: 6,
    start: { length: all('shoulders', 'short3'), curl: 0, product: 'none' },
  },
  {
    character: makeCharacter({
      id: 'amara', name: 'Amara', skin: skin('dark-brown'), eyes: eyes('brown'), hair: '#3b3050', seed: 11,
      face: 'round', nose: 0.35, brows: { thickness: 0.6, arch: 0.35, height: 'mid', spacing: 0.5 },
    }),
    age: 9,
    start: { length: all('shoulders'), curl: 3, product: 'none' },
  },
  {
    character: makeCharacter({
      id: 'kenji', name: 'Kenji', skin: skin('pale'), eyes: eyes('brown'), hair: '#3b3050', seed: 17,
      face: 'round', nose: 0.3, brows: { thickness: 0.55, arch: 0.2, height: 'low', spacing: 0.55 },
    }),
    age: 8,
    start: { length: all('short2', 'short3'), curl: 0, product: 'none' },
  },
  {
    character: makeCharacter({
      id: 'mateo', name: 'Mateo', skin: skin('light-brown'), eyes: eyes('brown'), hair: '#4b2e1c', seed: 23,
      face: 'square', nose: 0.6, adamsApple: true, brows: { thickness: 0.65, arch: 0.3, height: 'mid', spacing: 0.4 },
    }),
    age: 14,
    start: { length: all('short1', 'short2'), curl: 1, product: 'none' },
  },
  {
    character: makeCharacter({
      id: 'priya', name: 'Priya', skin: skin('mid-brown'), eyes: eyes('brown'), hair: '#3b3050', seed: 29,
      face: 'oval', nose: 0.4, brows: { thickness: 0.6, arch: 0.7, height: 'high', spacing: 0.5 },
    }),
    age: 16,
    start: { length: all('back'), curl: 0, product: 'none' },
  },
  {
    character: makeCharacter({
      id: 'leo', name: 'Leo', skin: skin('fully-tanned'), eyes: eyes('green'), hair: '#7a4a2a', seed: 31,
      face: 'triangular', nose: 0.6, adamsApple: true, brows: { thickness: 0.55, arch: 0.45, height: 'mid', spacing: 0.6 },
    }),
    age: 27,
    start: { length: all('short2', 'short3'), curl: 2, product: 'none' },
  },
  {
    character: makeCharacter({
      id: 'noor', name: 'Noor', skin: skin('light-brown'), eyes: eyes('hazel'), hair: '#4b2e1c', seed: 37,
      face: 'triangular', nose: 0.45, brows: { thickness: 0.7, arch: 0.8, height: 'mid', spacing: 0.45 },
    }),
    age: 35,
    start: { length: all('shoulders'), curl: 1, product: 'none' },
  },
  {
    character: makeCharacter({
      id: 'tom', name: 'Tom', skin: skin('rosy'), eyes: eyes('green'), hair: '#ff8a2b', seed: 41,
      face: 'square', nose: 0.7, adamsApple: true, brows: { thickness: 0.7, arch: 0.25, height: 'low', spacing: 0.35 },
    }),
    age: 42,
    start: { length: all('short3'), curl: 0, product: 'none' },
  },
  {
    character: makeCharacter({
      id: 'grace', name: 'Grace', skin: skin('pink'), eyes: eyes('blue'), hair: '#9aa0aa', seed: 43,
      face: 'round', nose: 0.5, brows: { thickness: 0.3, arch: 0.5, height: 'mid', spacing: 0.55 },
    }),
    age: 68,
    start: { length: all('bob', 'short1'), curl: 0, product: 'none' },
  },
];

export const ISLA: CharacterDef = CAST[0].character;

export function castMember(id: string): CastMember | undefined {
  return CAST.find((m) => m.character.id === id);
}

/** Where a character's hair work starts: their own preset, or Isla's for anyone not in the cast. */
export function startingHair(id: string): HairStart {
  const s = (castMember(id) ?? CAST[0]).start;
  return { length: { ...s.length }, curl: s.curl, product: s.product };
}

/** The parts of a character that the Character stage can change (everything but the name, id and hair seed). */
export type Look = Pick<CharacterDef, 'skin' | 'eyes' | 'hair' | 'nose' | 'adamsApple' | 'face'> & { brows: Brows };

/** A character's look as their preset has it, which Reset character returns to. */
export function presetLook(id: string): Look {
  const c = (castMember(id) ?? CAST[0]).character;
  return { skin: c.skin, eyes: c.eyes, hair: c.hair, nose: c.nose, adamsApple: c.adamsApple, face: c.face, brows: { ...c.brows } };
}

/**
 * A random look for Randomise: nose size, eye colour, Adam's apple, brow thickness, arch, height and spacing, skin tone,
 * face shape and natural hair colour. `rand` gives numbers from 0 up to (not including) 1.
 */
export function randomLook(rand: () => number): Look {
  const pick = <T,>(list: readonly T[]): T => list[Math.min(list.length - 1, Math.floor(rand() * list.length))];
  return {
    skin: pick(SKIN_TONES).hex,
    eyes: pick(EYE_COLOURS).hex,
    hair: pick(HAIR_SWATCHES).hex,
    nose: rand(),
    adamsApple: rand() < 0.4,
    face: pick(FACE_SHAPES),
    brows: { thickness: rand(), arch: rand(), height: pick(BROW_HEIGHTS), spacing: rand() },
  };
}
