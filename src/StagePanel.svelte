<script lang="ts">
  import { salon, type Stage } from './state';
  import CharacterPanel from './CharacterPanel.svelte';
  import ColourPanel from './ColourPanel.svelte';
  import CutPanel from './CutPanel.svelte';
  import WashPanel from './WashPanel.svelte';
  import StylePanel from './StylePanel.svelte';
  import PhotoPanel from './PhotoPanel.svelte';

  export let busy = false;
  export let ready = true;
  export let onPhoto: () => void;

  const LABELS: Record<Stage, string> = {
    character: 'Character',
    wash: 'Washing',
    colour: 'Colouring',
    cut: 'Cutting',
    style: 'Styling',
    photo: 'Photo booth',
  };

  $: stage = $salon.stage;
</script>

<section class="panel" aria-label="{LABELS[stage]} controls">
  {#if stage === 'character'}
    <CharacterPanel />
  {:else if stage === 'wash'}
    <WashPanel />
  {:else if stage === 'cut'}
    <CutPanel />
  {:else if stage === 'style'}
    <StylePanel />
  {:else if stage === 'photo'}
    <PhotoPanel {busy} {ready} {onPhoto} />
  {:else}
    <ColourPanel />
  {/if}
</section>

<style>
  .panel {
    height: 100%;
    padding: 12px 14px;
    overflow-y: auto;
    background: var(--panel);
    border: var(--outline);
    border-radius: var(--radius);
    box-shadow: 0 4px 0 var(--ink);
  }
</style>
