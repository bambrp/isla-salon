<script lang="ts">
  import { salon, type Stage } from './state';
  import ColourPanel from './ColourPanel.svelte';
  import CutPanel from './CutPanel.svelte';
  import WashPanel from './WashPanel.svelte';

  // Styling is still a non-functional shell; Stage 5 replaces it with real controls.
  const SHELLS: Record<Exclude<Stage, 'colour' | 'cut' | 'wash'>, { title: string; blurb: string; controls: string[] }> = {
    style: {
      title: 'Styling',
      blurb: 'Curling, spiky and flat styling arrive in Stage 5.',
      controls: ['Curl', 'Spiky', 'Flat'],
    },
  };

  const LABELS: Record<Stage, string> = { wash: 'Washing', colour: 'Colouring', cut: 'Cutting', style: 'Styling' };

  $: stage = $salon.stage;
  $: shell = stage === 'colour' || stage === 'cut' || stage === 'wash' ? undefined : SHELLS[stage];
</script>

<section class="panel" aria-label="{LABELS[stage]} controls">
  {#if shell}
    <div aria-live="polite">
      <h2>{shell.title}</h2>
      <p>{shell.blurb}</p>
      <div class="chips">
        {#each shell.controls as label}
          <button class="chip" disabled>{label}</button>
        {/each}
      </div>
    </div>
  {:else if stage === 'wash'}
    <WashPanel />
  {:else if stage === 'cut'}
    <CutPanel />
  {:else}
    <ColourPanel />
  {/if}
</section>

<style>
  .panel {
    margin: 10px;
    padding: 12px 14px;
    /* The same height for every stage, so the picture doesn't change size when you switch; it scrolls if a stage needs more. */
    height: min(var(--panel-height, 18rem), 46dvh);
    overflow-y: auto;
    background: var(--panel);
    border: var(--outline);
    border-radius: var(--radius);
    box-shadow: 0 4px 0 var(--ink);
  }

  /* Landscape phones put the panel beside the picture, where it can use the full height. */
  @media (orientation: landscape) and (max-height: 520px) {
    .panel {
      height: auto;
      min-height: 0;
      margin: 0 10px 10px 0;
    }
  }

  h2 {
    margin: 0 0 2px;
    font-size: 1.1rem;
  }

  p {
    margin: 0 0 10px;
    font-size: 0.85rem;
    opacity: 0.8;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .chip {
    min-height: 44px;
    padding: 0 14px;
    border: 2px solid var(--ink);
    border-radius: 999px;
    background: #fff;
    font-weight: 700;
  }

  .chip:disabled {
    opacity: 0.55;
  }
</style>
