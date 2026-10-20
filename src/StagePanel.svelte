<script lang="ts">
  import { salon, type Stage } from './state';

  // Stage 0: the panels are non-functional shells. Each later stage replaces its shell with real controls.
  const SHELLS: Record<Stage, { title: string; blurb: string; controls: string[] }> = {
    wash: {
      title: 'Washing',
      blurb: 'Water, shampoo and conditioner controls arrive in Stage 4.',
      controls: ['Temperature', 'Pressure', 'Mint', 'Citrus', 'Tropical', 'Conditioner'],
    },
    colour: {
      title: 'Colouring',
      blurb: 'Colour chooser with one colour, split or ombre arrives in Stage 2.',
      controls: ['One colour', 'Left / right', 'Ombre'],
    },
    cut: {
      title: 'Cutting',
      blurb: 'Front, sides and back lengths arrive in Stage 3.',
      controls: ['Front', 'Left', 'Right', 'Back'],
    },
    style: {
      title: 'Styling',
      blurb: 'Curling, spiky and flat styling arrive in Stage 5.',
      controls: ['Curl', 'Spiky', 'Flat'],
    },
  };

  $: shell = SHELLS[$salon.stage];
</script>

<section class="panel" aria-live="polite">
  <h2>{shell.title}</h2>
  <p>{shell.blurb}</p>
  <div class="chips">
    {#each shell.controls as label}
      <button class="chip" disabled>{label}</button>
    {/each}
  </div>
</section>

<style>
  .panel {
    margin: 10px;
    /* Reserve room for the tallest shell so the stage area doesn't jump when switching stages. */
    min-height: 11.5rem;
    padding: 12px 14px;
    background: var(--panel);
    border: var(--outline);
    border-radius: var(--radius);
    box-shadow: 0 4px 0 var(--ink);
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
