import { writable } from 'svelte/store';
import { withColour, withMode, type ColourMode, type HairColour } from './render/colour';

export type { ColourMode, HairColour };

/**
 * Left and right in the colour chooser are as the player sees Isla from the front: Left is the screen-left
 * half of the picture. The 'left' and 'right' views are named for Isla's own sides: the 'left' view shows
 * her left side, so her face points to the screen-left in it. Cutting regions follow the colour chooser:
 * Left and Right are as seen from the front (see cut.ts).
 */
export type Stage = 'wash' | 'colour' | 'cut' | 'style';
export type View = 'front' | 'left' | 'back' | 'right';
export type Length = 'back' | 'shoulders' | 'bob' | 'short1' | 'short2' | 'short3';
export type Region = 'front' | 'left' | 'right' | 'back';
/** What the cutting stage is about to change: one region, or the whole head. */
export type CutTarget = Region | 'all';
export type Shampoo = 'mint' | 'citrus' | 'tropical';

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
    colour: HairColour;
    length: Record<Region, Length>;
    curl: 0 | 1 | 2 | 3;
    product: 'none' | 'spiky' | 'flat';
  };
  wash: { temperature: number; pressure: number; shampoo: Shampoo; conditioner: boolean };
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
      colour: { mode: 'single', a: character.hair, b: character.hair },
      // Isla's starting cut: a short fringe at the front, shoulder-length everywhere else.
      length: { front: 'short3', left: 'shoulders', right: 'shoulders', back: 'shoulders' },
      curl: 0,
      product: 'none',
    },
    wash: { temperature: 0.5, pressure: 0.5, shampoo: 'mint', conditioner: false },
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
  salon.update((s) => ({ ...s, stage }));
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

export function toggleMute(): void {
  salon.update((s) => ({ ...s, audio: { muted: !s.audio.muted } }));
}
