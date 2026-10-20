<script lang="ts">
  import { salon, selectCutTarget, setLength, type CutTarget, type Length } from './state';
  import { LENGTHS, LENGTH_LABELS, isHiddenIn } from './cut';
  import { SIDE_REACH } from './render/hair';

  // Left and right are as you see Isla from the front, the same as the colour chooser.
  const TARGETS: ReadonlyArray<{ target: CutTarget; label: string }> = [
    { target: 'all', label: 'All' },
    { target: 'front', label: 'Front' },
    { target: 'left', label: 'Left' },
    { target: 'right', label: 'Right' },
    { target: 'back', label: 'Back' },
  ];

  /** A little head with hair down to the length, so each button shows what it does. */
  function hairPath(length: Length): string {
    const y = 8 + ((SIDE_REACH[length] - 232) / (478 - 232)) * 20;
    return `M4 14 Q4 3 14 3 Q24 3 24 14 L24 ${y} L19 ${y} L19 14 L9 14 L9 ${y} L4 ${y} Z`;
  }

  $: target = $salon.cutTarget;
  $: lengths = $salon.hair.length;
  // The length that every chosen region shares, if they agree; the buttons show nothing chosen if they don't.
  $: chosen = (() => {
    const regions = target === 'all' ? (['front', 'left', 'right', 'back'] as const) : ([target] as const);
    const first = lengths[regions[0]];
    return regions.every((r) => lengths[r] === first) ? first : undefined;
  })();
  $: hidden = target !== 'all' && isHiddenIn(target, $salon.view);
  $: status = chosen
    ? `${target === 'all' ? 'All of it' : TARGETS.find((t) => t.target === target)?.label}: ${LENGTH_LABELS[chosen]}`
    : 'The lengths differ. Pick one to match them all.';
</script>

<div class="cut">
  <div class="group" role="radiogroup" aria-label="Where to cut">
    {#each TARGETS as t}
      <button
        class="where"
        role="radio"
        aria-checked={target === t.target}
        on:click={() => selectCutTarget(t.target)}
      >
        {t.label}
      </button>
    {/each}
  </div>

  <div class="lengths" role="radiogroup" aria-label="Hair length">
    {#each LENGTHS as length}
      <button
        class="length"
        role="radio"
        aria-checked={chosen === length}
        aria-label={LENGTH_LABELS[length]}
        on:click={() => setLength(target, length)}
      >
        <svg viewBox="0 0 28 32" aria-hidden="true">
          <path d={hairPath(length)} class="hair" />
          <circle cx="14" cy="14" r="8" class="face" />
        </svg>
        <span>{LENGTH_LABELS[length]}</span>
      </button>
    {/each}
  </div>

  <p class="status" aria-live="polite">
    {status}
    {#if hidden}<span class="hint"> Turn Isla round to see it.</span>{/if}
  </p>
  <p class="tip">Tap her head to choose a part. Tap a length to snip.</p>
</div>

<style>
  .cut {
    display: grid;
    gap: 10px;
  }

  button {
    cursor: pointer;
  }

  .group {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 6px;
  }

  .where {
    min-height: 44px;
    padding: 0 2px;
    border: 3px solid var(--ink);
    border-radius: 999px;
    background: #fff;
    font-weight: 800;
    font-size: 0.85rem;
  }

  .where[aria-checked='true'] {
    background: var(--sun);
    box-shadow: inset 0 -4px 0 rgba(29, 16, 48, 0.22);
  }

  .lengths {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 6px;
  }

  .length {
    min-height: 64px;
    padding: 4px 0 2px;
    display: grid;
    justify-items: center;
    align-content: center;
    gap: 2px;
    border: 3px solid var(--ink);
    border-radius: 14px;
    background: #fff;
    font-weight: 700;
    font-size: 0.68rem;
    line-height: 1.1;
  }

  .length[aria-checked='true'] {
    background: var(--sun);
    box-shadow: inset 0 -4px 0 rgba(29, 16, 48, 0.22);
  }

  .length:active {
    transform: translateY(2px);
  }

  svg {
    width: 28px;
    height: 32px;
  }

  .hair {
    fill: #f2b632;
    stroke: var(--ink);
    stroke-width: 1.6;
    stroke-linejoin: round;
  }

  .face {
    fill: #ffd9b8;
    stroke: var(--ink);
    stroke-width: 1.6;
  }

  .status {
    margin: 0;
    font-weight: 800;
    font-size: 0.9rem;
  }

  .hint {
    font-weight: 700;
    color: var(--pink-deep);
  }

  .tip {
    margin: 0;
    font-size: 0.78rem;
    opacity: 0.75;
  }
</style>
