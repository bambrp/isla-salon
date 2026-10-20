<script lang="ts">
  import { salon, setCurl, setStyleProduct } from './state';
  import { CURL_LABELS, type CurlLevel, type StyleProduct } from './render/look';

  const CURLS: readonly CurlLevel[] = [0, 1, 2, 3];
  const PRODUCTS: ReadonlyArray<{ product: StyleProduct; label: string; hint: string }> = [
    { product: 'none', label: 'None', hint: 'Natural hair, no product.' },
    { product: 'spiky', label: 'Spiky', hint: 'Gel stands the hair up in spikes. Best on short cuts: long hair only flicks at the ends.' },
    { product: 'flat', label: 'Flat', hint: 'Serum presses the hair sleek against her head and smooths out most of the curl.' },
  ];

  /** A little head with hair as a wavy outline, more waves for tighter curls, so each button shows what it does. */
  function curlPath(level: CurlLevel): string {
    const amp = level * 1.6;
    const waves = level === 0 ? 0 : level + 1;
    const side = (x: number, dir: number): string => {
      let d = '';
      for (let i = 0; i <= 8; i++) {
        const y = 14 + i * 2.4;
        const dx = waves ? Math.sin((i / 8) * waves * Math.PI) * amp * dir : 0;
        d += `${i === 0 ? 'M' : 'L'}${(x + dx).toFixed(1)} ${y.toFixed(1)} `;
      }
      return d;
    };
    return side(5, 1) + side(23, -1);
  }

  $: curl = $salon.hair.curl;
  $: product = $salon.hair.product;
  $: hint = PRODUCTS.find((p) => p.product === product)?.hint ?? '';
</script>

<div class="style">
  <div class="label" id="curl-label">Curl</div>
  <div class="curls" role="radiogroup" aria-labelledby="curl-label">
    {#each CURLS as level}
      <button class="opt" role="radio" aria-checked={curl === level} aria-label={CURL_LABELS[level]} on:click={() => setCurl(level)}>
        <svg viewBox="0 0 28 32" aria-hidden="true">
          <path d="M4 14 Q4 3 14 3 Q24 3 24 14 Z" class="hair" />
          <path d={curlPath(level)} class="strand" />
          <circle cx="14" cy="15" r="7" class="face" />
        </svg>
        <span>{CURL_LABELS[level]}</span>
      </button>
    {/each}
  </div>

  <div class="label" id="product-label">Product</div>
  <div class="products" role="radiogroup" aria-labelledby="product-label">
    {#each PRODUCTS as p}
      <button class="where" role="radio" aria-checked={product === p.product} on:click={() => setStyleProduct(p.product)}>
        {p.label}
      </button>
    {/each}
  </div>
  <p class="tip" aria-live="polite">{hint}</p>
</div>

<style>
  .style {
    display: grid;
    gap: 8px;
  }

  button {
    cursor: pointer;
  }

  .label {
    font-weight: 800;
    font-size: 0.9rem;
  }

  .curls {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }

  .opt {
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
    font-size: 0.72rem;
    line-height: 1.1;
  }

  .opt[aria-checked='true'],
  .where[aria-checked='true'] {
    background: var(--sun);
    box-shadow: inset 0 -4px 0 rgba(29, 16, 48, 0.22);
  }

  .opt:active {
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

  .strand {
    fill: none;
    stroke: var(--ink);
    stroke-width: 3.4;
    stroke-linecap: round;
  }

  .face {
    fill: #ffd9b8;
    stroke: var(--ink);
    stroke-width: 1.6;
  }

  .products {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }

  .where {
    min-height: 44px;
    border: 3px solid var(--ink);
    border-radius: 999px;
    background: #fff;
    font-weight: 800;
    font-size: 0.9rem;
  }

  .tip {
    margin: 0;
    font-size: 0.78rem;
    opacity: 0.8;
    min-height: 2.4em;
  }
</style>
