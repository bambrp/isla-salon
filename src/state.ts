import { writable } from 'svelte/store';
import { withColour, withMode, type ColourMode, type HairColour } from './render/colour';
import { sameLevels, type Applying, type Product, type Shampoo, type WashLevels } from './render/wash';

export type { Applying, ColourMode, HairColour, Product, Shampoo, WashLevels };

/**
 * Left and right in the colour chooser are as the player sees Isla from the front: Left is the screen-left
 * half of the picture. Every left and right in the game is the player's: cutting regions and the 'left' and
 * 'right' views follow the same rule, so the 'left' view shows the Left region face on (see cut.ts and geometry.ts).
 */
export type Stage = 'wash' | 'colour' | 'cut' | 'style';
export type View = 'front' | 'left' | 'back' | 'right';
export type Length = 'back' | 'shoulders' | 'bob' | 'short1' | 'short2' | 'short3';
export type Region = 'front' | 'left' | 'right' | 'back';
/** What the cutting stage is about to change: one region, or the whole head. */
export type CutTarget = Region | 'all';

export const STAGES: readonly Stage[] = ['wash', 'colour', 'cut', 'style'];
export const VIEWS: readonly View[] = ['front', 'left', 'back', 'right'];

export interface CharacterDef {
  id: string;
  name: string;
  skin: number;
  eyes: number;
  hair: string;
  seed: number;
}

export interface SalonState {
  character: CharacterDef;
  stage: Stage;
  view: View;
  /** The region the length buttons change in the cutting stage. */
  cutTarget: CutTarget;
  hair: {
    wetness: number;
    cleanliness: number;
    conditioned: number;
    /** Shampoo lather and conditioner cream on the hair right now (0 to 1). */
    foam: number;
    cream: number;
    colour: HairColour;
    length: Record<Region, Length>;
    curl: 0 | 1 | 2 | 3;
    product: 'none' | 'spiky' | 'flat';
  };
  /** The washing controls: water settings, the product on the shelf that is selected, and what the hold buttons are doing. */
  wash: { temperature: number; pressure: number; product: Product; applying: Applying };
  audio: { muted: boolean };
}

export const ISLA: CharacterDef = {
  id: 'isla',
  name: 'Isla',
  skin: 0xffd9b8,
  eyes: 0x3a86ff,
  hair: '#ffd84a',
  seed: 6,
};

export function initialState(character: CharacterDef = ISLA): SalonState {
  return {
    character,
    stage: 'wash',
    view: 'front',
    cutTarget: 'all',
    hair: {
      wetness: 0,
      cleanliness: 0.4,
      conditioned: 0,
      foam: 0,
      cream: 0,
      colour: { mode: 'single', a: character.hair, b: character.hair },
      // Isla's starting cut: a short fringe at the front, shoulder-length everywhere else.
      length: { front: 'short3', left: 'shoulders', right: 'shoulders', back: 'shoulders' },
      curl: 0,
      product: 'none',
    },
    wash: { temperature: 0.5, pressure: 0.5, product: 'mint', applying: null },
    audio: { muted: false },
  };
}

/** Next view in the rotation order front -> left -> back -> right -> front. */
export function nextView(view: View): View {
  return VIEWS[(VIEWS.indexOf(view) + 1) % VIEWS.length];
}

/** Which backdrop scene a stage uses: the sink for washing, the mirror for everything else. */
export function sceneFor(stage: Stage): 'sink' | 'mirror' {
  return stage === 'wash' ? 'sink' : 'mirror';
}

export const salon = writable<SalonState>(initialState());

export function setStage(stage: Stage): void {
  // Leaving the sink lets go of the water, so nothing keeps running unseen.
  salon.update((s) => ({
    ...s,
    stage,
    wash: stage === 'wash' || s.wash.applying === null ? s.wash : { ...s.wash, applying: null },
  }));
}

export function rotateView(): void {
  salon.update((s) => ({ ...s, view: nextView(s.view) }));
}

function updateColour(change: (c: HairColour) => HairColour): void {
  salon.update((s) => {
    const colour = change(s.hair.colour);
    return colour === s.hair.colour ? s : { ...s, hair: { ...s.hair, colour } };
  });
}

/** Switch between one colour, split (left and right) and ombre (roots and tips). */
export function setColourMode(mode: ColourMode): void {
  updateColour((c) => withMode(c, mode));
}

/** Set one colour slot: a is the single colour, the Left half (as seen from the front), or the roots; b is the Right half, or the tips. */
export function setColour(slot: 'a' | 'b', hex: string): void {
  updateColour((c) => withColour(c, slot, hex));
}

/** Choose which part of the head the length buttons change. */
export function selectCutTarget(cutTarget: CutTarget): void {
  salon.update((s) => (s.cutTarget === cutTarget ? s : { ...s, cutTarget }));
}

/** Cut (or let grow) the chosen region, or the whole head, to a length. Does nothing if nothing would change. */
export function setLength(target: CutTarget, length: Length): void {
  salon.update((s) => {
    const regions: Region[] = target === 'all' ? ['front', 'left', 'right', 'back'] : [target];
    if (regions.every((r) => s.hair.length[r] === length)) return s;
    const next = { ...s.hair.length };
    for (const r of regions) next[r] = length;
    return { ...s, hair: { ...s.hair, length: next } };
  });
}

export function setTemperature(temperature: number): void {
  const t = Math.min(1, Math.max(0, temperature));
  salon.update((s) => (s.wash.temperature === t ? s : { ...s, wash: { ...s.wash, temperature: t } }));
}

export function setPressure(pressure: number): void {
  const p = Math.min(1, Math.max(0, pressure));
  salon.update((s) => (s.wash.pressure === p ? s : { ...s, wash: { ...s.wash, pressure: p } }));
}

/** Pick the product the apply button uses: one of the three shampoos, or the conditioner. */
export function selectProduct(product: Product): void {
  salon.update((s) => (s.wash.product === product ? s : { ...s, wash: { ...s.wash, product } }));
}

/** What the hold buttons are doing: running the water, applying the product, or nothing. */
export function setApplying(applying: Applying): void {
  salon.update((s) => (s.wash.applying === applying ? s : { ...s, wash: { ...s.wash, applying } }));
}

/** The hair as the washing simulation left it. */
export function washLevels(s: SalonState): WashLevels {
  return {
    wet: s.hair.wetness,
    foam: s.hair.foam,
    cream: s.hair.cream,
    clean: s.hair.cleanliness,
    conditioned: s.hair.conditioned,
  };
}

/** Store the hair's washing state, so the cut, colour and style stages see a hair that has been washed. */
export function commitWash(levels: WashLevels): void {
  salon.update((s) =>
    sameLevels(washLevels(s), levels)
      ? s
      : {
          ...s,
          hair: {
            ...s.hair,
            wetness: levels.wet,
            foam: levels.foam,
            cream: levels.cream,
            cleanliness: levels.clean,
            conditioned: levels.conditioned,
          },
        },
  );
}

/** How tightly the hair is curled: 0 is straight, 3 is tight curls. */
export function setCurl(curl: 0 | 1 | 2 | 3): void {
  salon.update((s) => (s.hair.curl === curl ? s : { ...s, hair: { ...s.hair, curl } }));
}

/** The styling product on the hair: none, spiky gel or a flattening serum. Only one at a time. */
export function setStyleProduct(product: 'none' | 'spiky' | 'flat'): void {
  salon.update((s) => (s.hair.product === product ? s : { ...s, hair: { ...s.hair, product } }));
}

export function toggleMute(): void {
  salon.update((s) => ({ ...s, audio: { muted: !s.audio.muted } }));
}
