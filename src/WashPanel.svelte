<script lang="ts">
  import {
    salon,
    selectProduct,
    squirtProduct,
    setPressure,
    setTemperature,
    type Product,
  } from './state';
  import { PRODUCTS, TEMPERATURE_LABEL, temperatureBand } from './render/wash';
  import { SHELF_PRODUCTS } from './render/sinkLayout';

  const NAMES: Record<Product, string> = { mint: 'Mint', citrus: 'Citrus', tropical: 'Tropical', conditioner: 'Conditioner' };
  const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

  $: wash = $salon.wash;
  $: band = temperatureBand(wash.temperature);
  $: productName = NAMES[wash.product];
  $: pressureName = wash.pressure === 0 ? 'Off' : wash.pressure < 0.34 ? 'Gentle' : wash.pressure < 0.67 ? 'Medium' : 'Strong';
</script>

<div class="wash">
  <div class="sliders">
    <label class="slider">
      <span class="name">Temperature <b class="value">{TEMPERATURE_LABEL[band]}</b></span>
      <input
        class="temp"
        type="range"
        min="0"
        max="100"
        value={Math.round(wash.temperature * 100)}
        aria-valuetext={TEMPERATURE_LABEL[band]}
        on:input={(e) => setTemperature(e.currentTarget.valueAsNumber / 100)}
      />
    </label>
    <label class="slider">
      <span class="name">Water tap <b class="value">{pressureName}</b></span>
      <input
        class="press"
        type="range"
        min="0"
        max="100"
        value={Math.round(wash.pressure * 100)}
        aria-valuetext={pressureName}
        on:input={(e) => setPressure(e.currentTarget.valueAsNumber / 100)}
      />
    </label>
  </div>

  <div class="products" role="radiogroup" aria-label="Product">
    {#each PRODUCTS as product}
      <button
        class="product"
        role="radio"
        aria-checked={wash.product === product}
        on:click={() => selectProduct(product)}
      >
        <span class="dot" style="background:{hex(SHELF_PRODUCTS[product].colour)}" aria-hidden="true"></span>
        {NAMES[product]}
      </button>
    {/each}
  </div>

  <button class="squirt" on:click={squirtProduct}>
    <span aria-hidden="true">{wash.product === 'conditioner' ? '💜' : '🫧'}</span> Squirt {productName.toLowerCase()}
  </button>
  <p class="hint">Turn the tap on for water, and it keeps running until you turn it off. Squirt some product on, then rub it in: swipe back and forth across her hair.</p>
</div>

<style>
  .wash {
    display: grid;
    gap: 10px;
  }

  button {
    cursor: pointer;
  }

  .sliders {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .slider {
    display: grid;
    gap: 2px;
  }

  .name {
    font-weight: 800;
    font-size: 0.8rem;
    display: flex;
    justify-content: space-between;
    gap: 4px;
  }

  .value {
    font-weight: 700;
    color: var(--pink-deep);
  }

  input[type='range'] {
    width: 100%;
    height: 44px;
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
  }
  input[type='range']::-moz-range-track {
    height: 10px;
    border: 3px solid var(--ink);
    border-radius: 999px;
  }
  .temp::-webkit-slider-runnable-track {
    background: linear-gradient(90deg, #4cb8ff, #f3f3f3 50%, #ff4d4d);
  }
  .temp::-moz-range-track {
    background: linear-gradient(90deg, #4cb8ff, #f3f3f3 50%, #ff4d4d);
  }
  .press::-webkit-slider-runnable-track {
    background: linear-gradient(90deg, #d8f3ff, #5ec8ff);
  }
  .press::-moz-range-track {
    background: linear-gradient(90deg, #d8f3ff, #5ec8ff);
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

  .products {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }

  .product {
    min-height: 44px;
    padding: 0 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    border: 3px solid var(--ink);
    border-radius: 999px;
    background: #fff;
    font-weight: 800;
    font-size: 0.72rem;
  }

  .product[aria-checked='true'] {
    background: var(--sun);
    box-shadow: inset 0 -4px 0 rgba(29, 16, 48, 0.22);
  }

  .dot {
    flex: none;
    width: 12px;
    height: 12px;
    border: 2px solid var(--ink);
    border-radius: 50%;
  }

  .hint {
    margin: 0;
    font-size: 0.78rem;
    font-weight: 700;
    line-height: 1.25;
    text-align: center;
  }

  .squirt {
    min-height: 56px;
    padding: 4px 8px;
    border: 3px solid var(--ink);
    border-radius: 18px;
    background: var(--mint);
    font-weight: 800;
    font-size: 0.95rem;
    line-height: 1.15;
    box-shadow: 0 4px 0 var(--ink);
    touch-action: manipulation;
    -webkit-touch-callout: none;
    user-select: none;
    -webkit-user-select: none;
  }

  .squirt:active {
    transform: translateY(3px);
    box-shadow: 0 1px 0 var(--ink);
    filter: brightness(1.08);
  }
</style>
