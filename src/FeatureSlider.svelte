<script lang="ts">
  /** A 0 to 1 slider with its name on the left, for the character's smooth features. */
  export let label: string;
  export let value: number;
  export let low = '';
  export let high = '';
  export let onInput: (v: number) => void;
</script>

<label class="row">
  <span class="name">{label}</span>
  <input
    type="range"
    min="0"
    max="100"
    value={Math.round(value * 100)}
    aria-label={label}
    aria-valuetext={value < 0.34 ? low : value > 0.66 ? high : 'Middle'}
    on:input={(e) => onInput(e.currentTarget.valueAsNumber / 100)}
  />
</label>

<style>
  .row {
    display: grid;
    grid-template-columns: 5.2rem 1fr;
    align-items: center;
    gap: 8px;
  }

  .name {
    font-weight: 800;
    font-size: 0.82rem;
  }

  input[type='range'] {
    width: 100%;
    height: 40px;
    margin: 0;
    background: transparent;
    -webkit-appearance: none;
    appearance: none;
    touch-action: pan-y;
  }
  input[type='range']::-webkit-slider-runnable-track {
    height: 16px;
    border: 3px solid var(--ink);
    border-radius: 999px;
    background: linear-gradient(90deg, #fff6e8, #ffd0e8);
  }
  input[type='range']::-moz-range-track {
    height: 10px;
    border: 3px solid var(--ink);
    border-radius: 999px;
    background: linear-gradient(90deg, #fff6e8, #ffd0e8);
  }
  input[type='range']::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 32px;
    height: 32px;
    margin-top: -10px;
    border: 3px solid var(--ink);
    border-radius: 50%;
    background: var(--sun);
    box-shadow: 0 3px 0 var(--ink);
  }
  input[type='range']::-moz-range-thumb {
    width: 26px;
    height: 26px;
    border: 3px solid var(--ink);
    border-radius: 50%;
    background: var(--sun);
    box-shadow: 0 3px 0 var(--ink);
  }
</style>
