<script lang="ts">
  export let busy = false;
  export let ready = true;
  export let onPhoto: () => void;
</script>

<div class="photo">
  <p class="hint">Turn them to the view you like, then take a photo.</p>
  <button class="take" on:click={onPhoto} disabled={!ready || busy}>
    <span aria-hidden="true">📷</span> Take photo
  </button>
</div>

<style>
  .photo {
    display: grid;
    gap: 10px;
    justify-items: center;
    padding-top: 6px;
  }

  .hint {
    margin: 0;
    font-weight: 700;
    font-size: 0.9rem;
    text-align: center;
  }

  .take {
    min-height: var(--tap);
    padding: 10px 24px;
    font-weight: 800;
    font-size: 1.05rem;
    background: var(--sun);
    border: var(--outline);
    border-radius: var(--radius);
    box-shadow: 0 4px 0 var(--ink);
    cursor: pointer;
  }

  .take:active:not(:disabled) {
    transform: translateY(3px);
    box-shadow: 0 1px 0 var(--ink);
  }

  .take:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
