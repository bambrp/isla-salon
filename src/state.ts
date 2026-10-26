import { writable } from 'svelte/store';
import { withColour, withMode, type ColourMode, type HairColour } from './render/colour';
import { SWIPES_TO_CUT, lengthsOf, planPosition, positionOf, positionsOf, type CutPlan, type Positions } from './cut';
import { sameLevels, type Applying, type Product, type Shampoo, type WashLevels } from './render/wash';

export type { Applying, ColourMode, HairColour, Product, Shampoo, WashLevels };

/**
 * Left and right in the colour chooser are as the player sees Isla from the front: Left is the screen-left
 * half of the picture. Every left and right in the game is the player's: cutting regions and the 'left' and
 * 'right' views follow the same rule, so the 'left' view shows the Left region face on (see cut.ts and geometry.ts).
 */
export type Stage = 'wash' | 'colour' | 'cut' | 'style';
export type View = 'front' | 'left' | 'back' | 'right';
export type Length = 'back' | 'shoulders' | 'bob' | 'short1' | 'short2' | 'short3' | 'trimmed' | 'shaved';
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
  /** A cut in progress: the length chosen, waiting for swipes across her hair to carry it out. Null when nothing is pending. */
  cut: CutPlan | null;
  hair: {
    wetness: number;
    cleanliness: number;
    conditioned: number;
    /** True while her hair is shiny (conditioned, then rinsed). It stays through every stage until water next wets her hair. */
    shine: boolean;
    /** Shampoo lather and conditioner cream on the hair right now (0 to 1). */
    foam: number;
    cream: number;
    colour: HairColour;
    length: Record<Region, Length>;
    curl: 0 | 1 | 2 | 3;
    product: 'none' | 'flat';
  };
  /** The washing controls: water settings, the product on the shelf that is selected, what the water button is doing, and how many times product has been squirted on. */
  wash: { temperature: number; pressure: number; product: Product; squirts: number };
  audio: { muted: boolean };
  /** Goes up by one each time the salon is reset, so the scene knows to change at once instead of animating. */
  epoch: number;
}

export const ISLA: CharacterDef = {
  id: 'isla',
  name: 'Isla',
  skin: 0xffd9b8,
  eyes: 0x3a86ff,
  hair: '#ffd84a',
  seed: 6,
};

/** How clean her hair is to begin with, and again whenever she comes back to the sink. */
const CLEAN_START = 0.4;

export function initialState(character: CharacterDef = ISLA): SalonState {
  return {
    character,
    stage: 'wash',
    view: 'front',
    cutTarget: 'all',
    cut: null,
    hair: {
      wetness: 0,
      cleanliness: CLEAN_START,
      conditioned: 0,
      shine: false,
      foam: 0,
      cream: 0,
      colour: { mode: 'single', a: character.hair, b: character.hair },
      // Isla's starting cut: a short fringe at the front, shoulder-length everywhere else.
      length: { front: 'short3', left: 'shoulders', right: 'shoulders', back: 'shoulders' },
      curl: 0,
      product: 'none',
    },
    wash: { temperature: 0.5, pressure: 0, product: 'mint', squirts: 0 },
    audio: { muted: false },
    epoch: 0,
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

const MUTE_KEY = 'islas-salon-muted';

/** Whether sound was switched off last time: kept in the browser, and fine without it (private windows, blocked storage). */
function storedMute(): boolean {
  try {
    return window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

function initialStore(): SalonState {
  const s = initialState();
  return storedMute() ? { ...s, audio: { muted: true } } : s;
}

export const salon = writable<SalonState>(initialStore());

export function setStage(stage: Stage): void {
  // Leaving the sink turns the tap off, so nothing keeps running unseen.
  salon.update((s) => {
    const leaving = s.stage === 'wash' && stage !== 'wash';
    return {
      ...s,
      stage,
      wash: stage === 'wash' || s.wash.pressure === 0 ? s.wash : { ...s.wash, pressure: 0 },
      // Leaving the sink clears the washing: she is dry again, with no lather, conditioner or silkiness, whenever she
      // comes back. Only the shine stays (until water next wets her hair).
      hair: leaving
        ? { ...s.hair, wetness: 0, foam: 0, cream: 0, cleanliness: CLEAN_START, conditioned: 0 }
        : s.hair,
    };
  });
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

/** Cut (or let grow) the chosen region, or the whole head, to a length at once. Used by tests and the debug hook; the game itself goes through chooseLength and swipes. */
export function setLength(target: CutTarget, length: Length): void {
  salon.update((s) => {
    const regions: Region[] = target === 'all' ? ['front', 'left', 'right', 'back'] : [target];
    if (!s.cut && regions.every((r) => s.hair.length[r] === length)) return s;
    const next = { ...lengthsOf(hairPosition(s)) };
    for (const r of regions) next[r] = length;
    return { ...s, cut: null, hair: { ...s.hair, length: next } };
  });
}

/** Where every part of the hair is right now, between lengths if a cut is part-way. */
export function hairPosition(s: SalonState): Positions {
  return s.cut ? planPosition(s.cut) : positionsOf(s.hair.length);
}

/**
 * Choose a length for the chosen region (or the whole head). The hair does not change yet: the player swipes
 * across it, and it moves an eighth of the way each time. Choosing again part-way carries on from where the hair
 * has got to, and parts already heading somewhere keep going there.
 */
export function chooseLength(target: CutTarget, length: Length): void {
  salon.update((s) => {
    const regions: Region[] = target === 'all' ? ['front', 'left', 'right', 'back'] : [target];
    const here = hairPosition(s);
    const to: Positions = { ...(s.cut ? s.cut.to : here) };
    for (const r of regions) to[r] = positionOf(length);
    const moving = (['front', 'left', 'right', 'back'] as Region[]).some((r) => Math.abs(to[r] - here[r]) > 1e-6);
    if (!moving) {
      // Back where she started (or nothing to do): settle on the hair as it is.
      return s.cut ? { ...s, cut: null, hair: { ...s.hair, length: lengthsOf(here) } } : s;
    }
    if (s.cut && (['front', 'left', 'right', 'back'] as Region[]).every((r) => s.cut!.to[r] === to[r])) return s;
    return { ...s, cut: { from: here, to, swipes: 0 } };
  });
}

/** One swipe across her hair (or one press of the Snip button): the hair moves an eighth of the way. The eighth finishes the cut. */
export function cutSwipe(): void {
  salon.update((s) => {
    if (!s.cut) return s;
    const swipes = s.cut.swipes + 1;
    if (swipes >= SWIPES_TO_CUT) return { ...s, cut: null, hair: { ...s.hair, length: lengthsOf(s.cut.to) } };
    return { ...s, cut: { ...s.cut, swipes } };
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

/** Squirt the chosen product onto her head. The scene shows the blob; it is rubbed in by swiping across her hair. */
export function squirtProduct(): void {
  salon.update((s) => ({ ...s, wash: { ...s.wash, squirts: s.wash.squirts + 1 } }));
}

/**
 * True while the water is running: the tap is on (its lowest setting is off) and she is at the sink. It stays on
 * until the tap is turned back to off, or she leaves the sink.
 */
export function waterRunning(s: SalonState): boolean {
  return s.stage === 'wash' && s.wash.pressure > 0;
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

/** Set whether her hair is shiny. */
export function setShine(shine: boolean): void {
  salon.update((s) => (s.hair.shine === shine ? s : { ...s, hair: { ...s.hair, shine } }));
}

/** How tightly the hair is curled: 0 is straight, 3 is tight curls. */
export function setCurl(curl: 0 | 1 | 2 | 3): void {
  salon.update((s) => (s.hair.curl === curl ? s : { ...s, hair: { ...s.hair, curl } }));
}

/** The styling product on the hair: none or a flattening serum. */
export function setStyleProduct(product: 'none' | 'flat'): void {
  salon.update((s) => (s.hair.product === product ? s : { ...s, hair: { ...s.hair, product } }));
}

/**
 * Start over with Isla as she was at the start: her hair, colour, cut, style and the washing all go back. The stage
 * you are on, the view and the sound setting stay as they are.
 */
export function resetSalon(): void {
  salon.update((s) => ({ ...initialState(s.character), stage: s.stage, view: s.view, audio: s.audio, epoch: s.epoch + 1 }));
}

export function toggleMute(): void {
  salon.update((s) => {
    const muted = !s.audio.muted;
    try {
      window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    } catch {
      /* remembering is a nicety */
    }
    return { ...s, audio: { muted } };
  });
}
