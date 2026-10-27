<script lang="ts">
  import CastPicker from './CastPicker.svelte';
  import FeatureSlider from './FeatureSlider.svelte';
  import { salon, setCharacterLook, randomiseLook, resetLook } from './state';
  import { BROW_HEIGHTS, EYE_COLOURS, FACE_SHAPES, SKIN_TONES, facePoints, type BrowHeight, type FaceShape } from './features';
  import { HAIR_SWATCHES, sameColour } from './render/colour';

  type Tab = 'people' | 'face' | 'colours' | 'brows' | 'hair';
  const TABS: ReadonlyArray<{ id: Tab; label: string }> = [
    { id: 'people', label: 'People' },
    { id: 'face', label: 'Face' },
    { id: 'colours', label: 'Colours' },
    { id: 'brows', label: 'Brows' },
    { id: 'hair', label: 'Hair' },
  ];
  let tab: Tab = 'people';

  const SHAPE_NAMES: Record<FaceShape, string> = { oval: 'Oval', round: 'Round', square: 'Square', triangular: 'Triangle' };
  const HEIGHT_NAMES: Record<BrowHeight, string> = { high: 'High', mid: 'Middle', low: 'Low' };
  const hex = (n: number): string => '#' + n.toString(16).padStart(6, '0');

  /** A little face outline for each shape button, drawn from the same points the game draws the face with. */
  function outline(shape: FaceShape): string {
    const p = facePoints(shape, 15, 19, 32);
    let d = '';
    for (let i = 0; i < p.length; i += 2) d += `${i ? 'L' : 'M'}${(20 + p[i]).toFixed(1)} ${(21 + p[i + 1]).toFixed(1)} `;
    return d + 'Z';
  }

  $: c = $salon.character;
  $: hairNow = c.hair;

  function pickHairColour(e: Event): void {
    const v = (e.currentTarget as HTMLInputElement).value;
    if (/^#[0-9a-f]{6}$/i.test(v)) setCharacterLook({ hair: v.toLowerCase() });
  }
</script>

<div class="character">
  <div class="tabs" role="tablist" aria-label="Character controls">
    {#each TABS as t}
      <button role="tab" class="tab" aria-selected={tab === t.id} on:click={() => (tab = t.id)}>{t.label}</button>
    {/each}
  </div>

  <div class="body" role="tabpanel">
    {#if tab === 'people'}
      <CastPicker />
    {:else if tab === 'face'}
      <div class="shapes" role="radiogroup" aria-label="Face shape">
        {#each FACE_SHAPES as shape}
          <button class="shape" role="radio" aria-checked={c.face === shape} on:click={() => setCharacterLook({ face: shape })}>
            <svg viewBox="0 0 40 42" aria-hidden="true"><path d={outline(shape)} /></svg>
            <span>{SHAPE_NAMES[shape]}</span>
          </button>
        {/each}
      </div>
      <FeatureSlider label="Nose size" value={c.nose} low="Small" high="Large" onInput={(v) => setCharacterLook({ nose: v })} />
      <button class="toggle" aria-pressed={c.adamsApple} on:click={() => setCharacterLook({ adamsApple: !c.adamsApple })}>
        Adam's apple: <b>{c.adamsApple ? 'Yes' : 'No'}</b>
      </button>
    {:else if tab === 'colours'}
      <div class="label" id="skin-label">Skin</div>
      <div class="swatches skin" role="radiogroup" aria-labelledby="skin-label">
        {#each SKIN_TONES as tone}
          <button
            class="swatch"
            role="radio"
            aria-checked={c.skin === tone.hex}
            aria-label={tone.name}
            style="background:{hex(tone.hex)}"
            on:click={() => setCharacterLook({ skin: tone.hex })}
          ></button>
        {/each}
      </div>
      <div class="label" id="eyes-label">Eyes</div>
      <div class="swatches eyes" role="radiogroup" aria-labelledby="eyes-label">
        {#each EYE_COLOURS as eye}
          <button
            class="swatch"
            role="radio"
            aria-checked={c.eyes === eye.hex}
            aria-label={eye.name}
            style="background:{hex(eye.hex)}"
            on:click={() => setCharacterLook({ eyes: eye.hex })}
          ></button>
        {/each}
      </div>
    {:else if tab === 'brows'}
      <FeatureSlider label="Thickness" value={c.brows.thickness} low="Thin" high="Thick" onInput={(v) => setCharacterLook({ brows: { thickness: v } })} />
      <FeatureSlider label="Arch" value={c.brows.arch} low="Flat" high="Arched" onInput={(v) => setCharacterLook({ brows: { arch: v } })} />
      <FeatureSlider label="Apart" value={c.brows.spacing} low="Close together" high="Far apart" onInput={(v) => setCharacterLook({ brows: { spacing: v } })} />
      <div class="heights" role="radiogroup" aria-label="Brow height">
        {#each BROW_HEIGHTS as h}
          <button class="opt" role="radio" aria-checked={c.brows.height === h} on:click={() => setCharacterLook({ brows: { height: h } })}>
            {HEIGHT_NAMES[h]}
          </button>
        {/each}
      </div>
    {:else}
      <div class="swatches hair" role="group" aria-label="Natural hair colour">
        {#each HAIR_SWATCHES as sw}
          <button
            class="swatch"
            class:on={sameColour(hairNow, sw.hex)}
            style="background:{sw.hex}"
            aria-label={sw.name}
            aria-pressed={sameColour(hairNow, sw.hex)}
            on:click={() => setCharacterLook({ hair: sw.hex })}
          ></button>
        {/each}
        <label class="swatch mixer">
          <span aria-hidden="true">🎨</span>
          <input type="color" value={hairNow} aria-label="Pick any natural hair colour" on:input={pickHairColour} />
        </label>
      </div>
    {/if}
  </div>

  <div class="actions">
    <button class="act" on:click={() => randomiseLook()}><span aria-hidden="true">🎲</span> Randomise</button>
    <button class="act" on:click={resetLook}><span aria-hidden="true">↩️</span> Reset {c.name}</button>
  </div>
</div>

<style>
  .character {
    display: grid;
    gap: 8px;
  }

  button {
    cursor: pointer;
  }

  .tabs {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 4px;
  }

  .tab {
    min-height: 44px;
    padding: 0 2px;
    border: 3px solid var(--ink);
    border-radius: 999px;
    background: #fff;
    font-weight: 800;
    font-size: 0.74rem;
  }

  .tab[aria-selected='true'] {
    background: var(--sun);
    box-shadow: inset 0 -4px 0 rgba(29, 16, 48, 0.22);
  }

  .body {
    display: grid;
    gap: 6px;
    align-content: start;
  }

  .label {
    font-weight: 800;
    font-size: 0.8rem;
  }

  .shapes {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }

  .shape,
  .opt,
  .toggle {
    min-height: 44px;
    border: 3px solid var(--ink);
    border-radius: 14px;
    background: #fff;
    font-weight: 800;
    font-size: 0.74rem;
  }

  .shape {
    display: grid;
    justify-items: center;
    padding: 2px;
    line-height: 1;
  }

  .shape svg {
    width: 34px;
    height: 36px;
    fill: #ffd9b8;
    stroke: var(--ink);
    stroke-width: 2.5;
    stroke-linejoin: round;
  }

  .shape[aria-checked='true'],
  .opt[aria-checked='true'],
  .toggle[aria-pressed='true'] {
    background: var(--sun);
    box-shadow: inset 0 -4px 0 rgba(29, 16, 48, 0.22);
  }

  .heights {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }

  .swatches {
    display: grid;
    gap: 6px;
  }

  .swatches.skin {
    grid-template-columns: repeat(5, 1fr);
  }

  .swatches.eyes {
    grid-template-columns: repeat(4, 1fr);
  }

  .swatches.hair {
    grid-template-columns: repeat(6, 1fr);
  }

  .swatch {
    position: relative;
    min-height: 44px;
    border: 3px solid var(--ink);
    border-radius: 14px;
    padding: 0;
    box-shadow: 0 2px 0 var(--ink);
  }

  .swatch[aria-checked='true'],
  .swatch.on {
    outline: 4px solid var(--sky);
    outline-offset: 1px;
  }

  .swatch[aria-checked='true']::after,
  .swatch.on::after {
    content: '✓';
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    font-weight: 900;
    color: #fff;
    text-shadow: 0 0 3px var(--ink), 0 0 3px var(--ink);
  }

  .mixer {
    display: grid;
    place-items: center;
    background: #fff;
    overflow: hidden;
  }

  .mixer input {
    position: absolute;
    inset: 0;
    opacity: 0;
    width: 100%;
    height: 100%;
    cursor: pointer;
  }

  .actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .act {
    min-height: 44px;
    padding: 0 6px;
    border: 3px solid var(--ink);
    border-radius: 14px;
    background: var(--mint);
    box-shadow: 0 3px 0 var(--ink);
    font-weight: 800;
    font-size: 0.82rem;
  }

  .act:active {
    transform: translateY(2px);
    box-shadow: 0 1px 0 var(--ink);
  }
</style>
