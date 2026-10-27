<script lang="ts">
  import { salon, switchCharacter, freshHair, type SalonState } from './state';
  import { CAST } from './cast';

  const hex = (n: number): string => '#' + n.toString(16).padStart(6, '0');

  /** What each portrait shows: the dye and the length they have now, whether they are in the chair, waiting, or not yet seen. */
  function hairOf(s: SalonState, id: string): SalonState['hair'] {
    if (s.character.id === id) return s.hair;
    const waiting = s.saved[id];
    if (waiting) return waiting.hair;
    return freshHair(CAST.find((m) => m.character.id === id)!.character);
  }

  function charOf(s: SalonState, id: string) {
    if (s.character.id === id) return s.character;
    return s.saved[id]?.character ?? CAST.find((m) => m.character.id === id)!.character;
  }

  // Hair drawn behind the head and, for long cuts, falling past the cheeks.
  const LONG = new Set(['back', 'shoulders', 'bob']);
</script>

<div class="cast" role="group" aria-label="Choose who is in the chair">
  {#each CAST as member (member.character.id)}
    {@const id = member.character.id}
    {@const c = charOf($salon, id)}
    {@const h = hairOf($salon, id)}
    {@const colour = h.colour.a}
    {@const long = LONG.has(h.length.back)}
    {@const bald = h.length.front === 'shaved' && h.length.back === 'shaved'}
    <button
      class="who"
      class:on={$salon.character.id === id}
      aria-pressed={$salon.character.id === id}
      aria-label="{c.name}, age {member.age}"
      on:click={() => switchCharacter(id)}
    >
      <svg viewBox="0 0 64 64" width="40" height="40" aria-hidden="true">
        {#if !bald && long}<rect x="9" y="12" width="46" height="44" rx="16" fill={colour} stroke="#1d1030" stroke-width="3" />{/if}
        <rect x="14" y="48" width="36" height="16" rx="8" fill="#1d1030" />
        <ellipse cx="32" cy="32" rx="17" ry="19" fill={hex(c.skin)} stroke="#1d1030" stroke-width="3" />
        {#if !bald}<path d="M14.5 30 C14 14 24 9 32 9 C41 9 50 14 49.5 30 C44 25 38 21 32 21 C26 21 20 25 14.5 30 Z" fill={colour} stroke="#1d1030" stroke-width="3" stroke-linejoin="round" />{/if}
        <circle cx="25" cy="35" r="2.6" fill={hex(c.eyes)} stroke="#1d1030" stroke-width="1.2" />
        <circle cx="39" cy="35" r="2.6" fill={hex(c.eyes)} stroke="#1d1030" stroke-width="1.2" />
        <path d="M26 44 Q32 48 38 44" fill="none" stroke="#1d1030" stroke-width="2.5" stroke-linecap="round" />
      </svg>
      <span class="name">{c.name}</span>
    </button>
  {/each}
</div>

<style>
  .cast {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 6px;
  }

  .who {
    min-height: var(--tap);
    display: grid;
    grid-template-columns: auto;
    justify-items: center;
    gap: 0;
    padding: 3px 1px 4px;
    background: var(--cream);
    border: var(--outline);
    border-radius: var(--radius);
    box-shadow: 0 3px 0 var(--ink);
    cursor: pointer;
    line-height: 1.1;
  }

  .who.on {
    background: var(--sun);
    transform: translateY(2px);
    box-shadow: 0 1px 0 var(--ink);
  }

  .name {
    font-weight: 800;
    font-size: 0.72rem;
  }

</style>
