<script lang="ts">
  import { salon, setBoothBackground } from './state';
  import { BOOTH_BACKGROUNDS, BOOTH_LABELS, type BoothBackground } from './render/booth';

  export let busy = false;
  export let ready = true;
  export let onPhoto: () => void;

  /** A small picture for each background button, drawn in CSS gradients so it needs no image files. */
  const THUMBS: Record<BoothBackground, string> = {
    salon: 'linear-gradient(#ffd6e8 0 70%, #c98fb5 70%)',
    beach: 'linear-gradient(#7fd6ff 0 50%, #3fc1ec 50% 65%, #f8de92 65%)',
    city: 'linear-gradient(#9cd9ff 0 40%, #ff9eb5 40% 55%, #b69cff 55% 80%, #6b7385 80%)',
    forest: 'linear-gradient(#d0f09a 0 35%, #3fae57 35% 75%, #6fc24b 75%)',
    clouds: 'linear-gradient(#5ab2fa 0 45%, #9fd5fd 45% 75%, #fff 75%)',
  };
</script>

<div class="photo">
  <div class="backs" role="radiogroup" aria-label="Background">
    {#each BOOTH_BACKGROUNDS as bg (bg)}
      <button
        type="button"
        role="radio"
        aria-checked={$salon.booth === bg}
        class="back"
        class:on={$salon.booth === bg}
        on:click={() => setBoothBackground(bg)}
      >
        <span class="thumb" style="background: {THUMBS[bg]}" aria-hidden="true"></span>
        <span class="name">{BOOTH_LABELS[bg]}</span>
      </button>
    {/each}
  </div>
  <p class="hint">Pick a background, turn them to the view you like, then take a photo.</p>
  <button class="take" on:click={onPhoto} disabled={!ready || busy}>
    <span aria-hidden="true">📷</span> Take photo
  </button>
</div>

<style>
  .photo {
    display: grid;
    gap: 10px;
    justify-items: center;
    padding-top: 6px;
  }

  .backs {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 6px;
    width: 100%;
    max-width: 30rem;
  }

  .back {
    display: grid;
    gap: 3px;
    justify-items: center;
    padding: 4px 2px;
    font: inherit;
    font-weight: 800;
    font-size: 0.75rem;
    background: #fff;
    border: 3px solid var(--ink);
    border-radius: 12px;
    cursor: pointer;
  }

  .back.on {
    background: var(--sun);
    box-shadow: 0 3px 0 var(--ink);
  }

  .thumb {
    width: 100%;
    aspect-ratio: 1;
    max-width: 3.2rem;
    border: 2px solid var(--ink);
    border-radius: 8px;
  }

  .hint {
    margin: 0;
    font-weight: 700;
    font-size: 0.9rem;
    text-align: center;
  }

  .take {
    min-height: var(--tap);
    padding: 10px 24px;
    font-weight: 800;
    font-size: 1.05rem;
    background: var(--sun);
    border: var(--outline);
    border-radius: var(--radius);
    box-shadow: 0 4px 0 var(--ink);
    cursor: pointer;
  }

  .take:active:not(:disabled) {
    transform: translateY(3px);
    box-shadow: 0 1px 0 var(--ink);
  }

  .take:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
