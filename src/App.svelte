<script lang="ts">
  import { onMount } from 'svelte';
  import {
    salon,
    setStage,
    rotateView,
    toggleMute,
    resetSalon,
    selectCutTarget,
    selectProduct,
    setPressure,
    setTemperature,
    STAGES,
    type Stage,
  } from './state';
  import { createScene, type SceneHandle } from './render/scene';
  import StagePanel from './StagePanel.svelte';
  import { playShutter } from './audio';
  import { photoName, savePhoto } from './photo';

  const LABELS: Record<Stage, { text: string; icon: string }> = {
    wash: { text: 'Wash', icon: '🚿' },
    colour: { text: 'Colour', icon: '🎨' },
    cut: { text: 'Cut', icon: '✂️' },
    style: { text: 'Style', icon: '💇' },
  };

  let host: HTMLDivElement;
  let scene: SceneHandle | undefined;
  let cannotDraw = false;

  onMount(() => {
    let disposed = false;
    createScene(host)
      .then((handle) => {
        if (disposed) {
          handle.destroy();
          return;
        }
        scene = handle;
        handle.render($salon);
      })
      .catch(() => {
        // Usually a browser or device with graphics acceleration switched off.
        cannotDraw = true;
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
    // A drag across her hair is a swipe, not a tap on her head.
    if (dragged) {
      dragged = false;
      return;
    }
    const region = scene?.regionAt(e.clientX, e.clientY);
    if (region) selectCutTarget(region);
  }

  // In the washing stage, tap a bottle on the shelf to choose it, or press the wall dial and drag up for hotter, down for colder.
  let rubbing: number | undefined;
  // In the cutting stage: swiping back and forth across her hair makes the cut. Whether the finger has moved far
  // enough to be a drag rather than a tap, so the tap that chooses a part ignores it.
  let swiping: { id: number; x: number; y: number } | undefined;
  let dragged = false;
  let dial: { id: number; kind: 'dial' | 'tap'; startY: number; start: number } | undefined;

  function pressHost(e: PointerEvent): void {
    if ($salon.stage === 'cut') {
      dragged = false;
      if (scene?.onHair(e.clientX, e.clientY)) {
        try {
          host.setPointerCapture(e.pointerId);
        } catch {
          /* capture is a nicety */
        }
        swiping = { id: e.pointerId, x: e.clientX, y: e.clientY };
        scene.swipe(e.clientX, e.clientY);
      }
      return;
    }
    if ($salon.stage !== 'wash') return;
    const hit = scene?.washHit(e.clientX, e.clientY);
    if (!hit) {
      // Swiping back and forth across her hair rubs product in (and, once water is on, moves nothing else).
      if (scene?.onHair(e.clientX, e.clientY)) {
        try {
          host.setPointerCapture(e.pointerId);
        } catch {
          /* capture is a nicety */
        }
        rubbing = e.pointerId;
        scene.rub(e.clientX, e.clientY);
      }
      return;
    }
    if (hit.kind === 'product') {
      selectProduct(hit.product);
      return;
    }
    e.preventDefault();
    try {
      host.setPointerCapture(e.pointerId);
    } catch {
      /* capture is a nicety */
    }
    dial = {
      id: e.pointerId,
      kind: hit.kind,
      startY: e.clientY,
      start: hit.kind === 'tap' ? $salon.wash.pressure : $salon.wash.temperature,
    };
    scene?.setDragging(hit.kind);
  }

  function dragHost(e: PointerEvent): void {
    if (swiping && swiping.id === e.pointerId) {
      if (Math.hypot(e.clientX - swiping.x, e.clientY - swiping.y) > 10) dragged = true;
      scene?.swipe(e.clientX, e.clientY);
    }
    if (rubbing === e.pointerId) scene?.rub(e.clientX, e.clientY);
    if (!dial || e.pointerId !== dial.id) return;
    // Dragging up by about half the picture's height goes from cold to hot, or from off to full pressure.
    const moved = (dial.startY - e.clientY) / Math.max(120, host.clientHeight * 0.5);
    if (dial.kind === 'tap') {
      // Near the bottom the tap snaps shut, like a real one.
      const p = dial.start + moved;
      setPressure(p < 0.06 ? 0 : p);
    } else {
      setTemperature(dial.start + moved);
    }
  }

  function releaseHost(e: PointerEvent): void {
    if (swiping && swiping.id === e.pointerId) {
      swiping = undefined;
      scene?.endSwipe();
    }
    if (rubbing === e.pointerId) {
      rubbing = undefined;
      scene?.endRub();
    }
    if (!dial || e.pointerId !== dial.id) return;
    dial = undefined;
    scene?.setDragging(null);
  }

  // A short message at the bottom of the picture, read out to screen readers too.
  let message = '';
  let messageTimer: ReturnType<typeof setTimeout> | undefined;
  function say(text: string, seconds = 3): void {
    message = text;
    clearTimeout(messageTimer);
    messageTimer = setTimeout(() => (message = ''), seconds * 1000);
  }

  function reducedMotion(): boolean {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  }

  // The camera: a flash and a shutter, then the picture alone (no controls) is downloaded, or shared on iPhones.
  let busy = false;
  let flash = false;
  async function takePhoto(): Promise<void> {
    if (busy || !scene) return;
    busy = true;
    playShutter();
    if (!reducedMotion()) {
      flash = true;
      setTimeout(() => (flash = false), 260);
    }
    try {
      const blob = await scene.photo();
      const result = await savePhoto(blob, photoName($salon.view));
      if (result === 'downloaded') say('Photo saved to your downloads.');
      else if (result === 'shared') say('Photo ready to save.');
    } catch {
      say("Sorry, the photo didn't work. Please try again.", 4);
    } finally {
      busy = false;
    }
  }

  // Starting over wipes the hair, so it takes two taps: the first asks, the second does it.
  let confirmReset = false;
  let confirmTimer: ReturnType<typeof setTimeout> | undefined;
  function startOver(): void {
    if (!confirmReset) {
      confirmReset = true;
      say('Tap start over again to put Isla back as she was.', 4);
      clearTimeout(confirmTimer);
      confirmTimer = setTimeout(() => (confirmReset = false), 4000);
      return;
    }
    clearTimeout(confirmTimer);
    confirmReset = false;
    resetSalon();
    say('Isla is back as she was.');
  }

  const viewLabel: Record<string, string> = {
    front: 'front',
    left: 'left side',
    back: 'back',
    right: 'right side',
  };
</script>

<main class="app">
  <h1 class="sr-only">Isla's Salon</h1>
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
      on:pointerdown={pressHost}
      on:pointermove={dragHost}
      on:pointerup={releaseHost}
      on:pointercancel={releaseHost}
      role="img"
      aria-label="Isla, seen from the {viewLabel[$salon.view]}"
    ></div>

    {#if cannotDraw}
      <p class="problem" role="alert">
        Sorry, this browser can't draw the salon. It needs WebGL: try turning on hardware acceleration, or use a recent
        version of Chrome, Edge, Firefox or Safari.
      </p>
    {/if}

    <div class="tools">
      <button class="round" on:click={rotateView} aria-label="Rotate view. Currently showing the {viewLabel[$salon.view]}">
        <span aria-hidden="true">🔄</span>
      </button>
      <button class="round" on:click={takePhoto} disabled={!scene || busy} aria-label="Take a photo">
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
      <button
        class="round"
        class:confirm={confirmReset}
        on:click={startOver}
        aria-label={confirmReset ? 'Confirm start over' : 'Start over'}
      >
        <span aria-hidden="true">{confirmReset ? '❓' : '♻️'}</span>
      </button>
    </div>

    <div class="flash" class:on={flash} aria-hidden="true"></div>
    <p class="toast" class:show={message !== ''} role="status" aria-live="polite">{message}</p>
  </section>

  <StagePanel />
</main>

<style>
  /* Read by screen readers, invisible on screen. */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
  }

  .app {
    height: 100vh; /* older browsers */
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
    /* Dragging the wall dial must not scroll or zoom the page. */
    touch-action: none;
  }

  .tools {
    position: absolute;
    top: 10px;
    right: 10px;
    display: flex;
    flex-direction: column;
    /* On a short picture the buttons start a second column rather than running off the bottom. */
    flex-wrap: wrap;
    align-content: flex-end;
    max-height: calc(100% - 20px);
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

  .round.confirm {
    background: var(--sun);
  }

  .problem {
    position: absolute;
    inset: 20px;
    margin: auto;
    height: fit-content;
    padding: 16px;
    background: var(--cream);
    border: var(--outline);
    border-radius: var(--radius);
    font-weight: 700;
    text-align: center;
  }

  .flash {
    position: absolute;
    inset: 0;
    background: #fff;
    opacity: 0;
    pointer-events: none;
  }

  .flash.on {
    animation: flash 0.26s ease-out;
  }

  @keyframes flash {
    from {
      opacity: 0.85;
    }
    to {
      opacity: 0;
    }
  }

  .toast {
    position: absolute;
    left: 50%;
    bottom: 12px;
    transform: translateX(-50%);
    max-width: calc(100% - 24px);
    margin: 0;
    padding: 8px 14px;
    background: var(--cream);
    border: var(--outline);
    border-radius: 999px;
    box-shadow: 0 3px 0 var(--ink);
    font-weight: 800;
    font-size: 0.85rem;
    text-align: center;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.2s;
  }

  .toast.show {
    opacity: 1;
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
