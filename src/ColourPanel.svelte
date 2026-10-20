<script lang="ts">
  import { tick } from 'svelte';
  import { salon, setColour, setColourMode, type ColourMode } from './state';
  import { HAIR_SWATCHES, hexToHsl, hslToHex, sameColour } from './render/colour';

  type Slot = 'a' | 'b';
  type Icon = 'left' | 'right' | 'roots' | 'tips';
  interface SlotInfo {
    slot: Slot;
    label: string;
    icon: Icon;
  }

  const MODES: ReadonlyArray<{ mode: ColourMode; label: string }> = [
    { mode: 'single', label: 'One colour' },
    { mode: 'split', label: 'Left & right' },
    { mode: 'ombre', label: 'Ombre' },
  ];

  // The half of a little round head that each colour slot paints, drawn as you see Isla from the front, so
  // the icon shows which part of her hair will change: Left is the screen-left half, Right the screen-right.
  const HALF: Record<Icon, string> = {
    left: 'M14 2 A12 12 0 0 0 14 26 Z',
    right: 'M14 2 A12 12 0 0 1 14 26 Z',
    roots: 'M2 14 A12 12 0 0 1 26 14 Z',
    tips: 'M2 14 A12 12 0 0 0 26 14 Z',
  };

  function slotsFor(mode: ColourMode): SlotInfo[] {
    if (mode === 'split') {
      // Left and Right are as you see Isla from the front.
      return [
        { slot: 'a', label: 'Left', icon: 'left' },
        { slot: 'b', label: 'Right', icon: 'right' },
      ];
    }
    if (mode === 'ombre') {
      return [
        { slot: 'a', label: 'Roots', icon: 'roots' },
        { slot: 'b', label: 'Tips', icon: 'tips' },
      ];
    }
    return [];
  }

  let slot: Slot = 'a';
  let mixing = false;
  let mixButton: HTMLButtonElement | undefined;
  let hueSlider: HTMLInputElement | undefined;

  $: colour = $salon.hair.colour;
  $: slots = slotsFor(colour.mode);
  // One colour has only one slot, so make sure the next mode starts from the first.
  $: if (colour.mode === 'single') slot = 'a';
  $: current = colour[slot];

  // The mixer's sliders keep their own hue, saturation and lightness so dragging one never nudges the others
  // through rounding (and a grey's hue doesn't snap back to red). They resync only when the colour is changed
  // from somewhere else: a swatch, another slot, the system picker.
  let h = 0;
  let s = 100;
  let l = 50;
  $: syncFromColour(current);

  function syncFromColour(hex: string): void {
    if (hslToHex(h, s, l) === hex) return;
    ({ h, s, l } = hexToHsl(hex));
  }

  function pick(hex: string): void {
    setColour(slot, hex);
  }

  function onSlider(kind: 'h' | 's' | 'l', event: Event): void {
    const value = Number((event.currentTarget as HTMLInputElement).value);
    if (kind === 'h') h = value;
    else if (kind === 's') s = value;
    else l = value;
    setColour(slot, hslToHex(h, s, l));
  }

  async function openMix(): Promise<void> {
    mixing = true;
    await tick();
    hueSlider?.focus();
  }

  async function closeMix(): Promise<void> {
    mixing = false;
    await tick();
    mixButton?.focus();
  }
</script>

<div class="colour">
  <!-- While mixing a colour the mode chips step aside, so the three sliders and their buttons fit without scrolling. -->
  {#if !mixing}
    <div class="modes" role="radiogroup" aria-label="Colouring style">
      {#each MODES as m}
        <button
          class="mode"
          role="radio"
          aria-checked={colour.mode === m.mode}
          on:click={() => setColourMode(m.mode)}
        >
          {m.label}
        </button>
      {/each}
    </div>
  {/if}

  {#if slots.length}
    <div class="slots" role="group" aria-label="Which colour to change">
      {#each slots as info}
        <button
          class="slot"
          class:active={slot === info.slot}
          aria-pressed={slot === info.slot}
          on:click={() => (slot = info.slot)}
        >
          <svg class="head" viewBox="0 0 28 28" aria-hidden="true">
            <circle cx="14" cy="14" r="12" fill="#fff" />
            <path d={HALF[info.icon]} fill={colour[info.slot]} />
            <circle cx="14" cy="14" r="12" fill="none" stroke="#1d1030" stroke-width="2.5" />
          </svg>
          <span>{info.label}</span>
        </button>
      {/each}
    </div>
  {/if}

  {#if mixing}
    <div class="mix">
      <label class="row">
        <span>Hue</span>
        <input
          class="slider"
          type="range"
          min="0"
          max="360"
          step="1"
          value={h}
          bind:this={hueSlider}
          on:input={(e) => onSlider('h', e)}
          style="--track: linear-gradient(to right, hsl(0 100% 50%), hsl(60 100% 50%), hsl(120 100% 50%), hsl(180 100% 50%), hsl(240 100% 50%), hsl(300 100% 50%), hsl(360 100% 50%))"
        />
      </label>
      <label class="row">
        <span>Vividness</span>
        <input
          class="slider"
          type="range"
          min="0"
          max="100"
          step="1"
          value={s}
          on:input={(e) => onSlider('s', e)}
          style="--track: linear-gradient(to right, hsl({h} 0% {l}%), hsl({h} 100% {l}%))"
        />
      </label>
      <label class="row">
        <span>Lightness</span>
        <input
          class="slider"
          type="range"
          min="8"
          max="95"
          step="1"
          value={l}
          on:input={(e) => onSlider('l', e)}
          style="--track: linear-gradient(to right, hsl({h} {s}% 8%), hsl({h} {s}% 50%), hsl({h} {s}% 95%))"
        />
      </label>
      <div class="actions">
        <button class="chip" on:click={closeMix}>Back to swatches</button>
        <label class="chip picker">
          <span>Colour picker</span>
          <input
            type="color"
            value={current}
            aria-label="Open the colour picker"
            on:input={(e) => pick(e.currentTarget.value)}
          />
        </label>
      </div>
    </div>
  {:else}
    <div class="swatches" role="group" aria-label="Hair colours">
      {#each HAIR_SWATCHES as sw}
        <button
          class="swatch"
          class:on={sameColour(current, sw.hex)}
          style="background: {sw.hex}"
          aria-label={sw.name}
          aria-pressed={sameColour(current, sw.hex)}
          on:click={() => pick(sw.hex)}
        ></button>
      {/each}
      <button class="swatch mixer" aria-label="Mix your own colour" bind:this={mixButton} on:click={openMix}>
        <span aria-hidden="true">🎨</span>
      </button>
    </div>
  {/if}
</div>

<style>
  .colour {
    display: grid;
    gap: 10px;
  }

  button {
    cursor: pointer;
  }

  .modes {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }

  .mode {
    min-height: 44px;
    padding: 0 4px;
    border: 3px solid var(--ink);
    border-radius: 14px;
    background: #fff;
    font-weight: 800;
    font-size: 0.85rem;
  }

  .mode[aria-checked='true'] {
    background: var(--sun);
    box-shadow: inset 0 -4px 0 rgba(29, 16, 48, 0.22);
  }

  .slots {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .slot {
    min-height: 44px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 10px 4px 8px;
    border: 3px solid var(--ink);
    border-radius: 999px;
    background: #fff;
    font-weight: 700;
    font-size: 0.82rem;
    text-align: left;
  }

  .slot.active {
    background: var(--sun);
    box-shadow: inset 0 -4px 0 rgba(29, 16, 48, 0.22);
  }

  .head {
    flex: none;
    width: 28px;
    height: 28px;
  }

  .swatches {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(44px, 1fr));
    gap: 8px;
  }

  .swatch {
    position: relative;
    aspect-ratio: 1;
    min-width: 44px;
    min-height: 44px;
    padding: 0;
    border: 3px solid var(--ink);
    border-radius: 50%;
    box-shadow: 0 3px 0 var(--ink);
  }

  .swatch:active {
    transform: translateY(2px);
    box-shadow: 0 1px 0 var(--ink);
  }

  /* The chosen swatch gets a ring and a tick, so it doesn't rely on colour alone. */
  .swatch.on {
    outline: 3px solid var(--ink);
    outline-offset: 3px;
  }

  .swatch.on::after {
    content: '✓';
    position: absolute;
    right: -5px;
    bottom: -5px;
    width: 20px;
    height: 20px;
    display: grid;
    place-items: center;
    border: 2px solid var(--ink);
    border-radius: 50%;
    background: #fff;
    font-size: 12px;
    font-weight: 900;
    line-height: 1;
  }

  .mixer {
    background: #fff;
    font-size: 1.3rem;
  }

  .mix {
    display: grid;
    gap: 6px;
  }

  .row {
    display: grid;
    grid-template-columns: 5.5rem 1fr;
    align-items: center;
    min-height: 44px;
    font-weight: 800;
    font-size: 0.85rem;
  }

  .slider {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 44px;
    margin: 0;
    background: transparent;
    touch-action: pan-y;
  }

  .slider::-webkit-slider-runnable-track {
    height: 24px;
    border: 3px solid var(--ink);
    border-radius: 999px;
    background: var(--track);
  }

  .slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 34px;
    height: 34px;
    margin-top: -8px;
    border: 3px solid var(--ink);
    border-radius: 50%;
    background: var(--cream);
    box-shadow: 0 2px 0 var(--ink);
  }

  .slider::-moz-range-track {
    height: 18px;
    border: 3px solid var(--ink);
    border-radius: 999px;
    background: var(--track);
  }

  .slider::-moz-range-thumb {
    width: 28px;
    height: 28px;
    border: 3px solid var(--ink);
    border-radius: 50%;
    background: var(--cream);
    box-shadow: 0 2px 0 var(--ink);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .chip {
    position: relative;
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    padding: 0 14px;
    border: 3px solid var(--ink);
    border-radius: 999px;
    background: #fff;
    font-weight: 800;
    font-size: 0.85rem;
  }

  /* The system colour input sits invisibly over the whole chip, border included, so tapping anywhere on it opens the picker. */
  .picker input {
    position: absolute;
    top: -3px;
    left: -3px;
    width: calc(100% + 6px);
    height: calc(100% + 6px);
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }
</style>
