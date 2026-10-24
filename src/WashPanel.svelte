<script lang="ts">
  import { onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import {
    salon,
    selectProduct,
    setApplying,
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
  $: tapOff = wash.pressure === 0;

  /**
   * Hold to apply. Pressing starts the water or the product and letting go stops it, however the press ends:
   * the pointer is captured so sliding off the button doesn't drop it, and a cancelled touch, a long-press menu,
   * a lost focus or a hidden page all let go too. Space and Enter work the same way for keyboards.
   */
  function hold(node: HTMLElement, mode: 'water') {
    let pointer: number | null = null;
    let keyDown = false;

    const start = () => setApplying(mode);
    const stop = () => {
      // Only let go of what this button started, so a second finger on the other button isn't cut off.
      if (get(salon).wash.applying === mode) setApplying(null);
    };

    const down = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      pointer = e.pointerId;
      try {
        node.setPointerCapture(e.pointerId);
      } catch {
        /* capture is a nicety */
      }
      start();
    };
    const up = (e: PointerEvent) => {
      if (pointer !== null && e.pointerId !== pointer) return;
      pointer = null;
      stop();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      e.preventDefault();
      if (e.type === 'keydown' && !e.repeat && !keyDown) {
        keyDown = true;
        start();
      } else if (e.type === 'keyup') {
        keyDown = false;
        stop();
      }
    };
    const menu = (e: Event) => e.preventDefault();
    const away = () => {
      pointer = null;
      keyDown = false;
      stop();
    };
    const hidden = () => {
      if (document.hidden) away();
    };

    node.addEventListener('pointerdown', down);
    node.addEventListener('pointerup', up);
    node.addEventListener('pointercancel', up);
    node.addEventListener('lostpointercapture', up);
    node.addEventListener('contextmenu', menu);
    node.addEventListener('keydown', key);
    node.addEventListener('keyup', key);
    node.addEventListener('blur', away);
    document.addEventListener('visibilitychange', hidden);
    return {
      destroy() {
        node.removeEventListener('pointerdown', down);
        node.removeEventListener('pointerup', up);
        node.removeEventListener('pointercancel', up);
        node.removeEventListener('lostpointercapture', up);
        node.removeEventListener('contextmenu', menu);
        node.removeEventListener('keydown', key);
        node.removeEventListener('keyup', key);
        node.removeEventListener('blur', away);
        document.removeEventListener('visibilitychange', hidden);
        away();
      },
    };
  }

  onDestroy(() => setApplying(null));
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

  <div class="holds">
    <button
      class="hold water"
      class:pressed={wash.applying === 'water'}
      class:off={tapOff}
      use:hold={'water'}
      aria-pressed={wash.applying === 'water'}
      aria-disabled={tapOff}
    >
      <span aria-hidden="true">💧</span> {tapOff ? 'Tap is off' : 'Hold for water'}
    </button>
    <button class="hold apply" on:click={squirtProduct}>
      <span aria-hidden="true">{wash.product === 'conditioner' ? '💜' : '🫧'}</span> Squirt {productName.toLowerCase()}
    </button>
  </div>
  <p class="hint">Squirt some product on, then rub it in: swipe back and forth across her hair.</p>
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

  .holds {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .hold {
    min-height: 56px;
    padding: 4px 8px;
    border: 3px solid var(--ink);
    border-radius: 18px;
    font-weight: 800;
    font-size: 0.9rem;
    line-height: 1.15;
    box-shadow: 0 4px 0 var(--ink);
    /* A press is a hold, so no scrolling, zooming, text selection or long-press menu may take it over. */
    touch-action: none;
    -webkit-touch-callout: none;
    user-select: none;
    -webkit-user-select: none;
  }

  .water {
    background: var(--sky);
  }

  .water.off {
    background: #dfe6ea;
    box-shadow: 0 4px 0 #8d9aa3;
    border-color: #4a5560;
    color: #2b3640;
  }

  .apply {
    background: var(--mint);
  }

  .hold.pressed {
    transform: translateY(3px);
    box-shadow: 0 1px 0 var(--ink);
    filter: brightness(1.08);
  }
</style>
