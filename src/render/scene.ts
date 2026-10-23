import 'pixi.js/unsafe-eval';
import { Application, Container, Graphics, RenderTexture } from 'pixi.js';
import gsap from 'gsap';
import { PHOTO_HEIGHT, PHOTO_WIDTH } from '../photo';
import { STAGES, VIEWS, commitWash, sceneFor, washLevels, type Region, type SalonState, type Stage } from '../state';
import { playBoing, playGrow, playPat, playSnip, playSpray, updateWashSound, type WashSound } from '../audio';
import { REGION_AZIMUTH, changedRegions, isShorter, regionOfAzimuth } from '../cut';
import { drawBackdrop } from './backdrop';
import { drawCharacter } from './character';
import { COLOUR_FADE_SECONDS, ColourFade } from './colourFade';
import { CALM, isCalm, moodTarget, sameMood, stepMood, type Mood } from './complexion';
import { HEAD, project, silhouetteHalfWidth } from './geometry';
import { buildLocks, reachAt, splitLocks, type Lock, type Lengths } from './hair';
import { NO_LOOK, lookOf, sameLook, type Look } from './look';
import { SPARK_LIFE, drawSparks, mistSpray, starBurst, type Spark } from './stylefx';
import { CLIPPING_LIFE, drawClippings, drawScissors, type Clipping } from './scissors';
import { INK, shade } from './style';
import { controlAt, productAt } from './sinkLayout';
import { isShampoo, isShiny, sameLevels, stepWash, temperatureBand, type Product, type WashLevels } from './wash';
import { WashFx, foamLayout, type Bubble, type FxContext } from './washfx';
import type { HairPaint } from './colour';

export interface SceneHandle {
  /** Redraw the scene for the given state. Cheap enough to call on every state change. */
  render(state: SalonState): void;
  /** The region of the head at a point on the page (client coordinates), or undefined if the point isn't on her head or hair. */
  regionAt(clientX: number, clientY: number): Region | undefined;
  /** What a press at a page point lands on in the sink scene: the temperature dial, the pressure tap, a bottle on the shelf, or nothing. */
  washHit(clientX: number, clientY: number): { kind: 'dial' | 'tap' } | { kind: 'product'; product: Product } | undefined;
  /** Show (or hide, with null) the scale of the wall control a finger is dragging. */
  setDragging(on: 'dial' | 'tap' | null): void;
  /** A photo of Isla and the salon as she is now: the picture only, no controls, always the same size and shape. */
  photo(): Promise<Blob>;
  destroy(): void;
}

/** Design space: everything is drawn in a 400 x 500 box, then scaled to fit the host. */
const DESIGN_W = 400;
const DESIGN_H = 500;

/** Seconds for the swing between two views. */
const SWING_SECONDS = 0.55;
/** Changing stage pans the new backdrop in from the side: how far it travels (design units) and how long it takes. */
const PAN_DISTANCE = 700;
const PAN_SECONDS = 0.45;

/** Which side of the picture the scissors come in from, and where they meet the hair, for each region and view. */
function regionPoint(region: Region, phi: number, reach: number): { x: number; y: number; facing: number } {
  const az = REGION_AZIMUTH[region];
  const rx = HEAD.rx + 10;
  const rz = HEAD.rz + 10;
  const p = project(rx * Math.sin(az), reach, rz * Math.cos(az), phi);
  return { x: p.sx, y: p.sy, facing: p.d };
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export async function createScene(host: HTMLElement): Promise<SceneHandle> {
  const app = new Application();
  await app.init({
    width: Math.max(1, host.clientWidth),
    height: Math.max(1, host.clientHeight),
    antialias: true,
    backgroundAlpha: 0,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
  });
  host.appendChild(app.canvas);

  // Draw a frame only when something has changed, so a quiet salon costs the phone's battery next to nothing.
  app.ticker.stop();
  let dirty = true;
  let raf = 0;
  const markDirty = (): void => {
    dirty = true;
  };
  // With ?debug the scene keeps a tally of the work it does, for checking performance.
  const stats = new URLSearchParams(window.location.search).has('debug')
    ? ((window as unknown as { salonStats: Record<string, number> }).salonStats = { renders: 0, renderMs: 0, draws: 0, drawMs: 0 })
    : undefined;
  const frame = (): void => {
    if (destroyed) return;
    if (dirty) {
      dirty = false;
      const t = performance.now();
      app.render();
      if (stats) {
        stats.renders++;
        stats.renderMs += performance.now() - t;
      }
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  // ?still turns the idle animation off, so automated checks see a steady picture.
  const idle = !new URLSearchParams(window.location.search).has('still') && !prefersReducedMotion();

  const world = new Container();
  const backdrop = new Graphics();
  // The incoming backdrop while the stages slide: it pans in over the old one, and Isla stays where she is.
  const slide = new Graphics();
  slide.visible = false;
  const character = new Graphics();
  const guide = new Graphics();
  const fx = new Graphics();
  const washG = new Graphics();
  world.addChild(backdrop, slide, character, guide, washG, fx);
  app.stage.addChild(world);

  let state: SalonState | undefined;
  let drawnScene: 'sink' | 'mirror' | undefined;
  let drawnStage: Stage | undefined;
  let panning: gsap.core.Tween | undefined;
  let destroyed = false;

  // Hair geometry only changes when the cut does, so build it once per cut rather than per frame. The cut on show
  // lags the requested one by a moment while the scissors work.
  let locks: Lock[] = [];
  let locksKey = '';
  let shown: Lengths | undefined;
  // The styling on show (curl and product), which tweens to the one asked for, and the sparks that play on a change.
  const look: Look = { ...NO_LOOK };
  let lookTarget: Look | undefined;
  let sparks: Spark[] = [];
  const sparkClock = { t: SPARK_LIFE };
  let snip: gsap.core.Timeline | undefined;
  let pendingCut: Lengths | undefined;

  // The washing: the hair's wet, lather and cream levels, the particles, and the clock that runs them.
  const washFx = new WashFx();
  let levels: WashLevels = { wet: 0, foam: 0, cream: 0, clean: 0.4, conditioned: 0 };
  let lastCommitted: WashLevels = levels;
  let bubbles: Bubble[] = [];
  let tickerOn = false;
  let sinceCommit = 0;
  let dragging: 'dial' | 'tap' | null = null;
  let wasApplying = false;
  // How the water's temperature shows on her face. It fades back over three seconds, even if she leaves the sink.
  let mood: Mood = CALM;

  // The scissors and the clipped hair. Both are drawn from a few numbers that the animation tweens.
  const scissors = { x: 0, y: 0, angle: 0, open: 0, alpha: 0 };
  let clippings: Clipping[] = [];
  const fall = { t: 0 };
  let paintNow: ReturnType<ColourFade['paint']> | undefined;

  // The view angle is continuous so the swing passes through every angle in between.
  const turn = { phi: 0 };
  let targetPhi = 0;
  let viewIndex = 0;

  // The hair colour on screen, which fades towards whatever colour the state asks for.
  let fade: ColourFade | undefined;

  // Idle life: now and then she blinks, and she breathes, a gentle lift of a couple of pixels.
  const eyes = { blink: 0 };
  const breath = { v: 0 };
  let blinkTimer: gsap.core.Tween | undefined;
  let blinkTween: gsap.core.Timeline | undefined;
  let epoch = 0;

  function scheduleBlink(): void {
    blinkTimer = gsap.delayedCall(2.4 + Math.random() * 3, () => {
      blinkTween = gsap
        .timeline({ onUpdate: draw, onComplete: scheduleBlink })
        .to(eyes, { blink: 1, duration: 0.07, ease: 'power1.in' })
        .to(eyes, { blink: 0, duration: 0.11, ease: 'power1.out' });
    });
  }

  function applyBreath(): void {
    const y = Math.round(breath.v * 5) / 5;
    if (y === character.y) return;
    character.y = guide.y = washG.y = y;
    markDirty();
  }

  if (idle) {
    scheduleBlink();
    gsap.to(breath, { v: 2.2, duration: 2.1, ease: 'sine.inOut', yoyo: true, repeat: -1, onUpdate: applyBreath });
  }

  function layout(): void {
    markDirty();
    const w = app.screen.width;
    const h = app.screen.height;
    // Fit the character box to the host, anchoring it to the bottom so the gown always sits on the edge.
    const scale = Math.min(w / DESIGN_W, h / DESIGN_H);
    world.scale.set(scale);
    world.position.set((w - DESIGN_W * scale) / 2, h - DESIGN_H * scale);
  }

  function draw(): void {
    if (destroyed || !state || !fade) return;
    markDirty();
    paintNow = fade.paint();
    // Wet hair is darker; it only shows at the sink, as she is towelled off before the other stages.
    const wet = state.stage === 'wash' ? levels.wet : 0;
    const t = performance.now();
    drawCharacter(character, state, turn.phi, locks, wet > 0.005 ? dim(paintNow, 1 - 0.24 * wet) : paintNow, eyes.blink, mood);
    if (stats) {
      stats.draws++;
      stats.drawMs += performance.now() - t;
    }
    drawGuide();
    drawWash();
    drawFx();
  }

  /** The same paint, darkened by a factor, for wet hair. */
  function dim(p: HairPaint, f: number): HairPaint {
    return {
      bands: (a0) => p.bands(a0).map((b) => ({ ...b, colour: shade(b.colour, f) })),
      root: (side) => shade(p.root(side), f),
      sheen: (az) => shade(p.sheen(az), f),
    };
  }

  function fxContext(): FxContext | undefined {
    if (!state) return undefined;
    const tips: Array<{ x: number; y: number }> = [];
    if (levels.wet > 0.3) {
      for (const p of splitLocks(locks, turn.phi).front) tips.push({ x: p.apex[0], y: p.apex[1] });
    }
    return {
      applying: state.wash.applying,
      product: state.wash.product,
      pressure: state.wash.pressure,
      temperature: state.wash.temperature,
      levels,
      phi: turn.phi,
      tips,
      bubbles,
      dragging,
    };
  }

  function drawWash(): void {
    markDirty();
    const ctx = fxContext();
    if (!ctx || !state || state.stage !== 'wash') {
      washG.clear();
      character.x = guide.x = washG.x = 0;
      return;
    }
    // Cold water makes her shiver.
    const cold = ctx.applying === 'water' && temperatureBand(ctx.temperature) === 'cold' && !prefersReducedMotion();
    const shake = cold ? Math.sin(washFx.time * 55) * 1.3 * (1 - ctx.temperature * 2) : 0;
    character.x = guide.x = washG.x = Math.max(-1.3, Math.min(1.3, shake));
    washFx.draw(washG, ctx);
  }

  function soundFor(next: SalonState): WashSound {
    if (next.stage !== 'wash') return null;
    if (next.wash.applying === 'water') return 'water';
    if (next.wash.applying === 'product') return isShampoo(next.wash.product) ? 'foam' : 'cream';
    return null;
  }

  /** The face the water on show is working towards. */
  function wantedMood(): Mood {
    if (!state || state.stage !== 'wash') return CALM;
    return moodTarget(state.wash.applying === 'water', state.wash.temperature);
  }

  function wantsTicker(): boolean {
    if (!state) return false;
    if (!isCalm(mood) || !sameMood(mood, wantedMood())) return true;
    return state.stage === 'wash' && (state.wash.applying !== null || washFx.active() || levels.wet > 0.3 || isShiny(levels));
  }

  function syncTicker(): void {
    const want = wantsTicker();
    if (want && !tickerOn) {
      gsap.ticker.add(tick);
      tickerOn = true;
    } else if (!want && tickerOn) {
      gsap.ticker.remove(tick);
      tickerOn = false;
    }
  }

  function commit(): void {
    sinceCommit = 0;
    if (sameLevels(levels, lastCommitted)) return;
    lastCommitted = levels;
    commitWash(levels);
  }

  function tick(_time: number, deltaMs: number): void {
    if (destroyed || !state) return;
    // Very long gaps (a slow frame, a stall) are capped so nothing lurches, but the cap is high enough that a slow phone still keeps pace.
    const dt = Math.min(0.25, Math.max(0, deltaMs / 1000));
    const before = levels;
    levels = stepWash(levels, dt, {
      applying: state.wash.applying,
      product: state.wash.product,
      temperature: state.wash.temperature,
      pressure: state.wash.pressure,
    });
    const ctx = fxContext();
    if (ctx) washFx.update(dt, ctx);
    updateWashSound(soundFor(state), state.wash.pressure);

    const beforeMood = mood;
    mood = prefersReducedMotion() ? wantedMood() : stepMood(mood, dt, wantedMood());
    if (!sameMood(mood, beforeMood) || Math.abs(levels.wet - before.wet) > 0.004) draw();
    else drawWash();

    sinceCommit += dt;
    if (sinceCommit > 0.3) commit();
    if (!wantsTicker()) {
      commit();
      syncTicker();
    }
  }


  /** In the cutting stage, a dot at the end of every visible lock in the chosen region, so you can see what you are about to cut. */
  function drawGuide(): void {
    guide.clear();
    if (!state || state.stage !== 'cut') return;
    const target = state.cutTarget;
    const { front } = splitLocks(locks, turn.phi);
    for (const p of front) {
      if (target !== 'all' && regionOfAzimuth(p.lock.a0) !== target) continue;
      guide.circle(p.apex[0], p.apex[1], 3.4).fill(0xffffff).stroke({ width: 1.8, color: INK });
    }
  }

  function drawFx(): void {
    markDirty();
    fx.clear();
    drawClippings(fx, clippings, fall.t);
    drawSparks(fx, sparks, sparkClock.t);
    drawScissors(fx, scissors.x, scissors.y, scissors.angle, scissors.open, scissors.alpha);
  }

  /** The colour hair has at its tips in a region, for the clippings. */
  function tipColour(region: Region): number {
    const bands = paintNow?.bands(REGION_AZIMUTH[region]);
    return bands ? bands[bands.length - 1].colour : 0xffd84a;
  }

  function showCut(lengths: Lengths, seed: number): void {
    locks = buildLocks(lengths, seed, look);
    bubbles = foamLayout(lengths, seed);
    shown = { ...lengths };
  }

  /** Rebuild the hair for the style as it is right now, part-way through a change. */
  function restyle(): void {
    if (shown && state) locks = buildLocks(shown, state.character.seed, look);
  }

  function playSparks(list: Spark[]): void {
    sparks = list;
    gsap.killTweensOf(sparkClock);
    sparkClock.t = 0;
    gsap.to(sparkClock, { t: SPARK_LIFE, duration: SPARK_LIFE, ease: 'none', onUpdate: drawFx, onComplete: () => { sparks = []; drawFx(); } });
  }

  /** Move to the curl and product the player chose: the hair eases into it, with a burst of stars or a puff of mist. */
  function applyLook(next: SalonState): void {
    const target = lookOf(next.hair.curl, next.hair.product);
    if (!lookTarget) {
      lookTarget = target;
      Object.assign(look, target);
      return;
    }
    if (sameLook(target, lookTarget)) return;
    const prev = lookTarget;
    lookTarget = target;
    const reduced = prefersReducedMotion();
    gsap.killTweensOf(look);
    if (reduced) {
      Object.assign(look, target);
      restyle();
    } else {
      gsap.to(look, { ...target, duration: 0.6, ease: 'sine.inOut', onUpdate: () => { restyle(); draw(); } });
    }
    if (target.curl !== prev.curl) {
      playBoing();
      if (!reduced) playSparks(starBurst());
    }
    if (target.spiky !== prev.spiky || target.flat !== prev.flat) {
      playSpray();
      if (target.flat > prev.flat) playPat();
      if (!reduced) playSparks(mistSpray(target.flat ? 0xbfe9ff : target.spiky ? 0xff9ed0 : 0xffffff));
    }
  }

  /** Throw the clipped hair off the region's cut line. */
  function spawnClippings(regions: Region[], from: Lengths): void {
    const out: Clipping[] = [];
    for (const region of regions) {
      const reach = reachOf(from, region);
      const pt = regionPoint(region, turn.phi, reach);
      // Regions facing away spill from the edge of the head instead, so something always falls where it can be seen.
      const hidden = pt.facing < -20;
      const half = silhouetteHalfWidth(HEAD.rx, HEAD.rz, turn.phi);
      const colour = tipColour(region);
      for (let i = 0; i < 12; i++) {
        const r = Math.random;
        out.push({
          x: hidden ? HEAD.cx + (r() * 2 - 1) * half : pt.x + (r() - 0.5) * 34,
          y: pt.y + (r() - 0.5) * 10,
          vx: (r() - 0.5) * 70,
          vy: -20 + r() * 40,
          rot: r() * Math.PI,
          spin: (r() - 0.5) * 9,
          len: 13 + r() * 12,
          colour,
        });
      }
    }
    clippings = out.slice(0, 80);
    gsap.killTweensOf(fall);
    fall.t = 0;
    gsap.to(fall, { t: CLIPPING_LIFE, duration: CLIPPING_LIFE, ease: 'none', onUpdate: drawFx, onComplete: () => { clippings = []; drawFx(); } });
  }

  function reachOf(lengths: Lengths, region: Region): number {
    return reachAt(REGION_AZIMUTH[region], lengths);
  }

  /** Put the requested cut on show now, finishing any snip still in progress. */
  function finishCut(): void {
    snip?.kill();
    snip = undefined;
    scissors.alpha = 0;
    if (pendingCut && state) showCut(pendingCut, state.character.seed);
    pendingCut = undefined;
  }

  /**
   * Bring the hair to the cut the player asked for. Shorter cuts get scissors that snip twice before the hair
   * drops away and falls; longer ones just grow in with a soft chime. With reduced motion it simply changes.
   */
  function applyCut(next: SalonState): void {
    const want = next.hair.length;
    if (!shown) {
      showCut(want, next.character.seed);
      return;
    }
    if (pendingCut && changedRegions(pendingCut, want).length === 0) return;
    if (!pendingCut && changedRegions(shown, want).length === 0) return;
    if (pendingCut) finishCut();

    const from = shown;
    const changed = changedRegions(from, want);
    const cutting = changed.filter((r) => isShorter(from[r], want[r]));
    const reduced = prefersReducedMotion();

    if (reduced) {
      showCut(want, next.character.seed);
      if (cutting.length) playSnip();
      else playGrow();
      return;
    }
    if (cutting.length === 0) {
      showCut(want, next.character.seed);
      playGrow();
      return;
    }

    pendingCut = { ...want };
    // Meet the hair at the most visible region being cut.
    const best = cutting
      .map((r) => ({ r, ...regionPoint(r, turn.phi, reachOf(from, r)) }))
      .sort((a, b) => b.facing - a.facing)[0];
    const fromLeft = best.x < HEAD.cx;
    const approach = fromLeft ? 1 : -1;
    scissors.x = best.x - approach * 46;
    scissors.y = best.y;
    scissors.angle = fromLeft ? -0.25 : Math.PI + 0.25;
    scissors.open = 0;
    scissors.alpha = 0;

    const tl = gsap.timeline({ onUpdate: draw });
    snip = tl;
    tl.to(scissors, { alpha: 1, x: best.x - approach * 14, duration: 0.14, ease: 'power2.out' })
      .to(scissors, { open: 1, duration: 0.09, ease: 'power1.out' })
      .to(scissors, { open: 0, duration: 0.07, ease: 'power1.in', onComplete: playSnip })
      .to(scissors, { open: 1, duration: 0.09, ease: 'power1.out' })
      .to(scissors, {
        open: 0,
        x: best.x - approach * 4,
        duration: 0.07,
        ease: 'power1.in',
        onComplete: () => {
          playSnip();
          const done = pendingCut;
          pendingCut = undefined;
          if (!done || !state) return;
          showCut(done, state.character.seed);
          const stillShorter = cutting.filter((r) => isShorter(from[r], done[r]));
          if (stillShorter.length) spawnClippings(stillShorter, from);
          if (changedRegions(from, done).some((r) => !isShorter(from[r], done[r]))) playGrow();
          draw();
        },
      })
      .to(scissors, { alpha: 0, x: best.x - approach * 40, duration: 0.18, ease: 'power2.in' }, '+=0.05');
  }

  /** Settle a pan at once: the new backdrop becomes the one on show. */
  function finishPan(): void {
    panning?.kill();
    panning = undefined;
    if (drawnScene && slide.visible) {
      drawBackdrop(backdrop, drawnScene);
      backdrop.x = 0;
      slide.clear();
      slide.x = 0;
      slide.visible = false;
    }
  }

  /** Slide the new stage's backdrop in from the side (right when moving forward through the tabs, left when back). */
  function panBackdrop(scene: 'sink' | 'mirror', direction: 1 | -1): void {
    finishPan();
    if (prefersReducedMotion()) {
      drawBackdrop(backdrop, scene);
      return;
    }
    drawBackdrop(slide, scene);
    slide.visible = true;
    slide.x = PAN_DISTANCE * direction;
    const shift = { t: 0 };
    panning = gsap.to(shift, {
      t: 1,
      duration: PAN_SECONDS,
      ease: 'power2.inOut',
      onUpdate: () => {
        slide.x = PAN_DISTANCE * direction * (1 - shift.t);
        backdrop.x = -PAN_DISTANCE * direction * shift.t;
        draw();
      },
      onComplete: () => {
        drawnScene = scene;
        finishPan();
        draw();
      },
    });
  }

  function render(next: SalonState): void {
    if (destroyed) return;
    state = next;

    const scene = sceneFor(next.stage);
    if (drawnStage === undefined) {
      drawBackdrop(backdrop, scene);
    } else if (next.stage !== drawnStage) {
      panBackdrop(scene, STAGES.indexOf(next.stage) > STAGES.indexOf(drawnStage) ? 1 : -1);
    }
    drawnScene = scene;
    drawnStage = next.stage;

    // A reset puts everything back at once, with no scissors and no easing.
    if (next.epoch !== epoch) {
      epoch = next.epoch;
      finishCut();
      gsap.killTweensOf(look);
      lookTarget = undefined;
      shown = undefined;
      mood = CALM;
    }

    applyLook(next);

    // A different character gets a fresh head of hair at once; a change of cut goes through the scissors.
    const seedKey = String(next.character.seed);
    if (seedKey !== locksKey) {
      finishCut();
      showCut(next.hair.length, next.character.seed);
      locksKey = seedKey;
    } else {
      applyCut(next);
    }

    // The washing levels come from the store whenever something other than this scene changed them.
    const stored = washLevels(next);
    if (!sameLevels(stored, lastCommitted)) {
      levels = stored;
      lastCommitted = stored;
    }
    if (wasApplying && !next.wash.applying) commit();
    wasApplying = next.wash.applying !== null;
    if (next.stage !== 'wash') washFx.clear();
    updateWashSound(soundFor(next), next.wash.pressure);
    syncTicker();

    // The first colour just appears; every change after that fades in. A new change part-way through a fade
    // starts from the colour showing at that moment, so nothing jumps.
    if (!fade) {
      fade = new ColourFade(next.hair.colour);
    } else if (fade.retarget(next.hair.colour)) {
      gsap.killTweensOf(fade);
      if (prefersReducedMotion()) fade.finish();
      else gsap.to(fade, { progress: 1, duration: COLOUR_FADE_SECONDS, ease: 'sine.inOut', onUpdate: draw });
    }

    // Always turn forwards (front, left, back, right, front...) so the swing never unwinds backwards.
    const index = VIEWS.indexOf(next.view);
    if (index !== viewIndex) {
      const steps = (index - viewIndex + VIEWS.length) % VIEWS.length;
      viewIndex = index;
      targetPhi -= (steps * Math.PI) / 2;
      gsap.killTweensOf(turn);
      if (prefersReducedMotion()) {
        turn.phi = targetPhi;
      } else {
        gsap.to(turn, { phi: targetPhi, duration: SWING_SECONDS, ease: 'back.out(1.25)', onUpdate: draw });
      }
    }
    draw();
  }

  app.renderer.on('resize', layout);
  layout();

  // Follow the host element's size, not just the window's: the panel below can change height between stages.
  const observer = new ResizeObserver(() => {
    if (destroyed) return;
    app.renderer.resize(Math.max(1, host.clientWidth), Math.max(1, host.clientHeight));
  });
  observer.observe(host);

  /** A point on the page as design-space coordinates, or undefined before the first layout. */
  function toDesign(clientX: number, clientY: number): { x: number; y: number } | undefined {
    const rect = app.canvas.getBoundingClientRect();
    const scale = world.scale.x;
    if (!scale) return undefined;
    return { x: (clientX - rect.left - world.x) / scale, y: (clientY - rect.top - world.y) / scale };
  }

  function washHit(clientX: number, clientY: number): { kind: 'dial' | 'tap' } | { kind: 'product'; product: Product } | undefined {
    const p = toDesign(clientX, clientY);
    if (!p || !state || state.stage !== 'wash') return undefined;
    const control = controlAt(p.x, p.y);
    if (control) return { kind: control };
    const product = productAt(p.x, p.y);
    return product ? { kind: 'product', product } : undefined;
  }

  function regionAt(clientX: number, clientY: number): Region | undefined {
    const pt = toDesign(clientX, clientY);
    if (!pt || !state) return undefined;
    const { x, y } = pt;

    // The head and hair: the width of the head at this angle, from just above the crown down to where the hair ends.
    const phi = turn.phi;
    const half = silhouetteHalfWidth(HEAD.rx + 12, HEAD.rz + 12, phi);
    let lowest = HEAD.cy + HEAD.ry;
    for (const lock of locks) lowest = Math.max(lowest, HEAD.cy + lock.reach);
    if (Math.abs(x - HEAD.cx) > half || y < HEAD.cy - HEAD.ry - 14 || y > lowest + 6) return undefined;

    // Find the azimuth on the visible half of the head whose screen x matches the tap.
    let best = phi;
    let bestGap = Infinity;
    for (let k = -90; k <= 90; k += 2) {
      const az = phi + (k * Math.PI) / 180;
      const sx = HEAD.cx + HEAD.rx * Math.sin(az) * Math.cos(phi) - HEAD.rz * Math.cos(az) * Math.sin(phi);
      const gap = Math.abs(sx - x);
      if (gap < bestGap) {
        bestGap = gap;
        best = az;
      }
    }
    return regionOfAzimuth(best);
  }

  /** Render the design box (head, shoulders and salon) at the fixed photo size, leaving the controls and effects out. */
  async function photo(): Promise<Blob> {
    if (destroyed) throw new Error('The salon is closed');
    finishPan();
    const target = RenderTexture.create({ width: PHOTO_WIDTH, height: PHOTO_HEIGHT, resolution: 1, antialias: true });
    const was = { scale: world.scale.x, x: world.x, y: world.y, blink: eyes.blink, guide: guide.visible, fx: fx.visible, cy: character.y };
    try {
      // Show her as she'd pose: eyes open, no breath, no markers, no scissors or sparks.
      eyes.blink = 0;
      character.y = guide.y = washG.y = 0;
      guide.visible = false;
      fx.visible = false;
      draw();
      world.scale.set(PHOTO_WIDTH / DESIGN_W);
      world.position.set(0, 0);
      app.renderer.render({ container: world, target, clear: true, clearColor: [1, 1, 1, 1] });
      const canvas = app.renderer.extract.canvas({ target, resolution: 1 }) as HTMLCanvasElement;
      return await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('The photo could not be made'))), 'image/png'),
      );
    } finally {
      world.scale.set(was.scale);
      world.position.set(was.x, was.y);
      eyes.blink = was.blink;
      guide.visible = was.guide;
      fx.visible = was.fx;
      character.y = guide.y = washG.y = was.cy;
      target.destroy(true);
      draw();
    }
  }

  return {
    render,
    regionAt,
    photo,
    washHit,
    setDragging(on: 'dial' | 'tap' | null) {
      dragging = on;
      drawWash();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      panning?.kill();
      if (tickerOn) gsap.ticker.remove(tick);
      tickerOn = false;
      updateWashSound(null, 0);
      cancelAnimationFrame(raf);
      blinkTimer?.kill();
      blinkTween?.kill();
      gsap.killTweensOf(breath);
      snip?.kill();
      gsap.killTweensOf(look);
      gsap.killTweensOf(sparkClock);
      gsap.killTweensOf(fall);
      gsap.killTweensOf(scissors);
      gsap.killTweensOf(turn);
      if (fade) gsap.killTweensOf(fade);
      observer.disconnect();
      app.renderer.off('resize', layout);
      app.destroy({ removeView: true }, { children: true });
    },
  };
}
