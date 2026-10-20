<script lang="ts">
  import { onMount } from 'svelte';
  import { salon, setStage, rotateView, toggleMute, selectCutTarget, STAGES, type Stage } from './state';
  import { createScene, type SceneHandle } from './render/scene';
  import StagePanel from './StagePanel.svelte';

  const LABELS: Record<Stage, { text: string; icon: string }> = {
    wash: { text: 'Wash', icon: '🚿' },
    colour: { text: 'Colour', icon: '🎨' },
    cut: { text: 'Cut', icon: '✂️' },
    style: { text: 'Style', icon: '💇' },
  };

  let host: HTMLDivElement;
  let scene: SceneHandle | undefined;

  onMount(() => {
    let disposed = false;
    createScene(host).then((handle) => {
      if (disposed) {
        handle.destroy();
        return;
      }
      scene = handle;
      handle.render($salon);
    });
    return () => {
      disposed = true;
      scene?.destroy();
    };
  });

  $: scene?.render($salon);

  // In the cutting stage, tapping her head or hair picks the region to cut.
  function tapHead(e: MouseEvent): void {
    if ($salon.stage !== 'cut') return;
    const region = scene?.regionAt(e.clientX, e.clientY);
    if (region) selectCutTarget(region);
  }

  const viewLabel: Record<string, string> = {
    front: 'front',
    left: 'left side',
    back: 'back',
    right: 'right side',
  };
</script>

<main class="app">
  <nav class="stages" aria-label="Salon stages">
    {#each STAGES as stage}
      <button
        class="stage-tab"
        class:active={$salon.stage === stage}
        aria-pressed={$salon.stage === stage}
        on:click={() => setStage(stage)}
      >
        <span class="icon" aria-hidden="true">{LABELS[stage].icon}</span>
        <span>{LABELS[stage].text}</span>
      </button>
    {/each}
  </nav>

  <section class="stage-area">
    <!-- Tapping the picture is a shortcut for the region buttons, which are the accessible way to choose. -->
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
    <div
      class="canvas-host"
      bind:this={host}
      on:click={tapHead}
      role="img"
      aria-label="Isla, seen from the {viewLabel[$salon.view]}"
    ></div>

    <div class="tools">
      <button class="round" on:click={rotateView} aria-label="Rotate view. Currently showing the {viewLabel[$salon.view]}">
        <span aria-hidden="true">🔄</span>
      </button>
      <button class="round" aria-label="Take a photo (coming soon)" disabled>
        <span aria-hidden="true">📷</span>
      </button>
      <button
        class="round"
        on:click={toggleMute}
        aria-pressed={$salon.audio.muted}
        aria-label={$salon.audio.muted ? 'Unmute sound effects' : 'Mute sound effects'}
      >
        <span aria-hidden="true">{$salon.audio.muted ? '🔇' : '🔊'}</span>
      </button>
    </div>
  </section>

  <StagePanel />
</main>

<style>
  .app {
    height: 100dvh;
    display: grid;
    grid-template-rows: auto 1fr auto;
    padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom)
      env(safe-area-inset-left);
  }

  .stages {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    padding: 10px;
  }

  .stage-tab {
    min-height: var(--tap);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    padding: 6px 4px;
    background: var(--cream);
    border: var(--outline);
    border-radius: var(--radius);
    font-weight: 800;
    font-size: 0.85rem;
    box-shadow: 0 4px 0 var(--ink);
    cursor: pointer;
  }

  .stage-tab .icon {
    font-size: 1.3rem;
    line-height: 1;
  }

  .stage-tab.active {
    background: var(--sun);
    transform: translateY(3px);
    box-shadow: 0 1px 0 var(--ink);
  }

  .stage-area {
    position: relative;
    min-height: 0;
    margin: 0 10px;
    border: var(--outline);
    border-radius: var(--radius);
    overflow: hidden;
    background: var(--sky);
  }

  .canvas-host {
    position: absolute;
    inset: 0;
  }

  .tools {
    position: absolute;
    top: 10px;
    right: 10px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .round {
    width: var(--tap);
    height: var(--tap);
    display: grid;
    place-items: center;
    font-size: 1.4rem;
    background: var(--cream);
    border: var(--outline);
    border-radius: 50%;
    box-shadow: 0 3px 0 var(--ink);
    cursor: pointer;
    padding: 0;
  }

  .round:active:not(:disabled) {
    transform: translateY(2px);
    box-shadow: 0 1px 0 var(--ink);
  }

  .round:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (orientation: landscape) and (max-height: 520px) {
    .app {
      grid-template-columns: 1fr minmax(220px, 34%);
      grid-template-rows: auto 1fr;
    }
    .stages {
      grid-column: 1 / -1;
    }
    .stage-area {
      grid-column: 1;
      margin-bottom: 10px;
    }
  }
</style>
