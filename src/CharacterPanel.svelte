<script lang="ts">
  import CastPicker from './CastPicker.svelte';
</script>

<div class="character">
  <p class="hint">Who's in the chair? Everyone keeps their own haircut.</p>
  <CastPicker />
</div>

<style>
  .character {
    display: grid;
    gap: 8px;
  }

  .hint {
    margin: 0;
    font-weight: 700;
    font-size: 0.85rem;
  }
</style>
