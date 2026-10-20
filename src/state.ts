import { writable } from 'svelte/store';

export type Stage = 'wash' | 'colour' | 'cut' | 'style';
export type View = 'front' | 'left' | 'back' | 'right';
export type Length = 'back' | 'shoulders' | 'bob' | 'short1' | 'short2' | 'short3';
export type Region = 'front' | 'left' | 'right' | 'back';
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
  hair: {
    wetness: number;
    cleanliness: number;
    conditioned: number;
    colour: { mode: 'single' | 'split' | 'ombre'; a: string; b: string };
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
    hair: {
      wetness: 0,
      cleanliness: 0.4,
      conditioned: 0,
      colour: { mode: 'single', a: character.hair, b: character.hair },
      length: { front: 'shoulders', left: 'shoulders', right: 'shoulders', back: 'shoulders' },
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

export function toggleMute(): void {
  salon.update((s) => ({ ...s, audio: { muted: !s.audio.muted } }));
}
