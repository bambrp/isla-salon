<script lang="ts">
  import { salon, type Stage } from './state';
  import ColourPanel from './ColourPanel.svelte';
  import CutPanel from './CutPanel.svelte';
  import WashPanel from './WashPanel.svelte';
  import StylePanel from './StylePanel.svelte';

  const LABELS: Record<Stage, string> = { wash: 'Washing', colour: 'Colouring', cut: 'Cutting', style: 'Styling' };

  $: stage = $salon.stage;
</script>

<section class="panel" aria-label="{LABELS[stage]} controls">
  {#if stage === 'wash'}
    <WashPanel />
  {:else if stage === 'cut'}
    <CutPanel />
  {:else if stage === 'style'}
    <StylePanel />
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
</style>
