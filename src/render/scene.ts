import 'pixi.js/unsafe-eval';
import { Application, Container, Graphics, RenderTexture } from 'pixi.js';
import gsap from 'gsap';
import { PHOTO_HEIGHT, PHOTO_WIDTH } from '../photo';
import { STAGES, VIEWS, commitWash, cutSwipe, hairPosition, sceneFor, washLevels, waterRunning, type Region, type SalonState, type Stage } from '../state';
import { playBoing, playPat, playSnip, playSparkle, playSqueak, playSpray, playSquirt, updateWashSound, type WashSound } from '../audio';
import { REGION_AZIMUTH, SWIPES_TO_CUT, movingRegions, positionsOf, regionOfAzimuth, toolFor, type CutPlan } from '../cut';
import { drawBackdrop } from './backdrop';
import { drawCharacter } from './character';
import { COLOUR_FADE_SECONDS, ColourFade } from './colourFade';
import { CALM, isCalm, moodTarget, sameMood, stepMood, type Mood } from './complexion';
import { HEAD, project, silhouetteHalfWidth } from './geometry';
import { buildLocks, reachAt, splitLocks, type CutLengths, type Lock, type Positions } from './hair';
import { NO_LOOK, lookOf, sameLook, type Look } from './look';
import { SPARK_LIFE, drawSparks, mistSpray, starBurst, wandSparks, type Spark } from './stylefx';
import { CLIPPING_LIFE, drawClippings, drawScissors, drawWand, type Clipping } from './scissors';
import { shade } from './style';
import { SHELF_PRODUCTS, controlAt, productAt } from './sinkLayout';
import { LOAD_PER_SQUIRT, conditionSwipe, isShampoo, isShiny, sameLevels, stepWashLoad, temperatureBand, type Applying, type Product, type WashLevels } from './wash';
import { followTarget } from './sprayer';
import { WashFx, foamLayout, type Bubble, type FxContext } from './washfx';
import type { HairPaint } from './colour';

export interface SceneHandle {
  /** Redraw the scene for the given state. Cheap enough to call on every state change. */
  render(state: SalonState): void;
  /** The region of the head at a point on the page (client coordinates), or undefined if the point isn't on her head or hair. */
  regionAt(clientX: number, clientY: number): Region | undefined;
  /** What a press at a page point lands on in the sink scene: the temperature dial, the pressure tap, a bottle on the shelf, or nothing. */
  washHit(clientX: number, clientY: number): { kind: 'dial' | 'tap' } | { kind: 'product'; product: Product } | undefined;
  /** True if a page point is on her head or hair, which is where swiping rubs product in or cuts. */
  onHair(clientX: number, clientY: number): boolean;
  /** A finger (or the mouse, button down) is at this page point: moving across her hair rubs product in. */
  rub(clientX: number, clientY: number): void;
  /** The finger lifted or left: no more rubbing. */
  endRub(): void;
  /** In the cutting stage, a finger (or the mouse, button down) is at this page point: a pass of about a finger's width counts as a swipe. */
  swipe(clientX: number, clientY: number): void;
  /** The finger lifted or left: the next touch starts a fresh swipe. */
  endSwipe(): void;
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
/** The squirt blob sinks into her hair over this long. */
const BLOB_SECONDS = 1;
/** How far towards white the lightest hair goes, after the full eight swipes of conditioner. */
const LIGHTEST = 0.88;
/** A swipe is a pass of about a finger's width (design units) in one direction; smaller movements than the jitter are ignored. */
export const SWIPE_LENGTH = 36;
const SWIPE_JITTER = 0.8;
/** Rubbing at this speed (design units a second) or faster is a brisk scrub. */
const RUB_FULL_SPEED = 260;
/** She keeps her eyes shut this long after the rubbing stops, and this long after a squirt if no rubbing follows. */
const EYES_SHUT_AFTER_RUB = 0.5;
const EYES_SHUT_AFTER_SQUIRT = 1.5;

/** Which side of the picture the scissors come in from, and where they meet the hair, for each region and view. */
function regionPoint(region: Region, phi: number, reach: number): { x: number; y: number; facing: number } {
  const az = REGION_AZIMUTH[region];
  const rx = HEAD.rx + 10;
  const rz = HEAD.rz + 10;
  const p = project(rx * Math.sin(az), reach, rz * Math.cos(az), phi);
  return { x: p.sx, y: p.sy, facing: p.d };
}

/** A colour mixed towards white by a fraction k (0 leaves it, 1 is white). */
export function lightenColour(colour: number, k: number): number {
  const t = Math.min(1, Math.max(0, k));
  const ch = (shift: number) => Math.round(((colour >> shift) & 255) * (1 - t) + 255 * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
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
  const fx = new Graphics();
  const washG = new Graphics();
  world.addChild(backdrop, slide, character, washG, fx);
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
  // The hair on show, as positions between the six lengths: it glides to each new position as the cut moves on.
  let shown: Positions | undefined;
  // The cut plan the last render saw, so a swipe can be told from some other change.
  let prevCut: CutPlan | null = null;
  // The styling on show (curl and product), which tweens to the one asked for, and the sparks that play on a change.
  const look: Look = { ...NO_LOOK };
  let lookTarget: Look | undefined;
  let sparks: Spark[] = [];
  const sparkClock = { t: SPARK_LIFE };
  let snip: gsap.core.Timeline | undefined;

  // The washing: the hair's wet, lather and cream levels, the particles, and the clock that runs them.
  const washFx = new WashFx();
  let levels: WashLevels = { wet: 0, foam: 0, cream: 0, clean: 0.4, conditioned: 0 };
  let lastCommitted: WashLevels = levels;
  let bubbles: Bubble[] = [];
  let tickerOn = false;
  let sinceCommit = 0;
  let dragging: 'dial' | 'tap' | null = null;
  let wasApplying = false;
  // Product squirted on and waiting to be rubbed in, the blob that is sinking into her hair, and the rubbing itself:
  // how hard she is being rubbed (smoothed), how far the finger moved since the last frame, and where it was.
  let load: { product: Product; amount: number } = { product: 'mint', amount: 0 };
  let blobAge = -1;
  let blobColour = 0xffffff;
  let seenSquirts = 0;
  let rub = 0;
  let rubMoved = 0;
  // How light the hair looks from conditioner: it eases to the cream level, so each swipe is a smooth step lighter.
  let lightShown = 0;
  // Swipe tracking for the cutting stage: where the finger was, which way this stroke runs, and how far it has gone.
  let swipeLast: { x: number; y: number } | undefined;
  let swipeDir = 0;
  let swipeTravel = 0;
  let swipeCounted = false;
  /**
   * Feed the finger's position in; true when this movement completes a swipe: a pass of about a finger's width in
   * one direction. Turning back (or round a corner) starts the next swipe, and wobbles are ignored.
   */
  function strokeStep(p: { x: number; y: number }): boolean {
    if (!swipeLast) {
      swipeLast = p;
      return false;
    }
    const dx = p.x - swipeLast.x;
    const dy = p.y - swipeLast.y;
    swipeLast = p;
    if (Math.hypot(dx, dy) < SWIPE_JITTER) return false;
    const dir = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 1 : -1) : dy > 0 ? 2 : -2;
    if (dir !== swipeDir) {
      swipeDir = dir;
      swipeTravel = 0;
      swipeCounted = false;
    }
    swipeTravel += Math.hypot(dx, dy);
    if (!swipeCounted && swipeTravel >= SWIPE_LENGTH) {
      swipeCounted = true;
      return true;
    }
    return false;
  }

  /** A swipe at the sink with conditioner on her hair: one step lighter. (Water running rinses instead.) */
  function conditionStep(): void {
    if (!state || state.stage !== 'wash' || waterRunning(state)) return;
    if (load.product !== 'conditioner' || load.amount <= 0) return;
    const r = conditionSwipe(levels, load.amount);
    if (r.used <= 0) return;
    levels = r.levels;
    load = { ...load, amount: Math.max(0, load.amount - r.used) };
    playSqueak();
    syncTicker();
    draw();
  }

  function swipeReset(): void {
    swipeLast = undefined;
    swipeDir = 0;
    swipeTravel = 0;
    swipeCounted = false;
  }
  // Where a swiping finger is on her head: the shower head follows it, and eases back when the swipe ends.
  let aimGoal: { x: number; y: number } | null = null;
  // True while the photo is being taken, so she poses with her eyes open.
  let posing = false;
  let rubLast: { x: number; y: number } | undefined;
  // She shuts her eyes from the squirt until half a second after the rubbing stops.
  let eyeTimer = 0;
  // How the water's temperature shows on her face. It fades back over three seconds, even if she leaves the sink.
  let mood: Mood = CALM;

  // The scissors and the clipped hair. Both are drawn from a few numbers that the animation tweens.
  const scissors = { x: 0, y: 0, angle: 0, open: 0, alpha: 0 };
  const wand = { x: 0, y: 0, angle: 0, glow: 0, alpha: 0 };
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
    character.y = washG.y = y;
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
    drawCharacter(character, state, turn.phi, locks, paintFor(wet), Math.max(eyes.blink, !posing && (eyeTimer > 0 || waterRunning(state)) ? 1 : 0), mood);
    if (stats) {
      stats.draws++;
      stats.drawMs += performance.now() - t;
    }
    drawWash();
    drawFx();
  }

  /** The hair's paint as it looks at the sink: darker when wet, lighter with conditioner on it. */
  function paintFor(wet: number): HairPaint {
    let out: HairPaint = paintNow!;
    const light = state?.stage === 'wash' ? lightShown : 0;
    if (light > 0.005) out = lighten(out, light);
    return wet > 0.005 ? dim(out, 1 - 0.24 * wet) : out;
  }

  /** The same paint, mixed towards white (by at most LIGHTEST), for hair with conditioner on it. */
  function lighten(p: HairPaint, k: number): HairPaint {
    const toward = (c: number) => lightenColour(c, k * LIGHTEST);
    return {
      bands: (a0) => p.bands(a0).map((b) => ({ ...b, colour: toward(b.colour) })),
      root: (side) => toward(p.root(side)),
      sheen: (az) => toward(p.sheen(az)),
    };
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
      applying: applyingNow(),
      aimGoal: followingFinger(),
      product: load.amount > 0 ? load.product : state.wash.product,
      selected: state.wash.product,
      rub,
      blob: blobAge >= 0 ? { t: blobAge / BLOB_SECONDS, colour: blobColour } : null,
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
      character.x = washG.x = 0;
      return;
    }
    // Cold water makes her shiver.
    const cold = ctx.applying === 'water' && temperatureBand(ctx.temperature) === 'cold' && !prefersReducedMotion();
    const shake = cold ? Math.sin(washFx.time * 55) * 1.3 * (1 - ctx.temperature * 2) : 0;
    character.x = washG.x = Math.max(-1.3, Math.min(1.3, shake));
    washFx.draw(washG, ctx);
  }

  /** What is happening to the hair now: the water, or product being rubbed in (swiping, with product on her), or nothing. */
  function applyingNow(): Applying {
    if (!state || state.stage !== 'wash') return null;
    if (waterRunning(state)) return 'water';
    // Only shampoo lathers while rubbed. Conditioner lightens the hair a step per swipe instead.
    return rub > 0.06 && load.amount > 0 && isShampoo(load.product) ? 'product' : null;
  }

  /** Where the shower head should follow a swiping finger to: only while the water is running, otherwise it stays put. */
  function followingFinger(): { x: number; y: number } | null {
    return followTarget(!!state && waterRunning(state), aimGoal);
  }

  function soundFor(next: SalonState): WashSound {
    if (next.stage !== 'wash') return null;
    const now = applyingNow();
    if (now === 'water') return 'water';
    if (now === 'product') return 'foam';
    return null;
  }

  /** The face the water on show is working towards. */
  function wantedMood(): Mood {
    if (!state || state.stage !== 'wash') return CALM;
    return moodTarget(waterRunning(state), state.wash.temperature);
  }

  function wantsTicker(): boolean {
    if (!state) return false;
    if (!isCalm(mood) || !sameMood(mood, wantedMood())) return true;
    return (
      state.stage === 'wash' &&
      (state.wash.pressure > 0 ||
        washFx.active() ||
        washFx.aimMoving() ||
        lightShown !== levels.cream ||
        followingFinger() !== null ||
        levels.wet > 0.3 ||
        isShiny(levels) ||
        rub > 0 ||
        rubMoved > 0 ||
        blobAge >= 0 ||
        eyeTimer > 0)
    );
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

    // How hard she is being rubbed follows how fast the finger moved since the last frame.
    const target = Math.min(1, rubMoved / Math.max(dt, 1 / 120) / RUB_FULL_SPEED);
    rubMoved = 0;
    rub += (target - rub) * Math.min(1, dt * 9);
    if (target === 0 && rub < 0.02) rub = 0;
    const shutBefore = eyeTimer > 0;
    if (rub > 0.05) eyeTimer = Math.max(eyeTimer, EYES_SHUT_AFTER_RUB);
    else eyeTimer = Math.max(0, eyeTimer - dt);
    if (blobAge >= 0) {
      blobAge += dt;
      if (blobAge >= BLOB_SECONDS) blobAge = -1;
    }

    // The hair eases lighter (or back as the conditioner rinses off) rather than jumping a step per swipe.
    const lightBefore = lightShown;
    lightShown += (levels.cream - lightShown) * Math.min(1, dt * 8);
    if (Math.abs(levels.cream - lightShown) < 0.002) lightShown = levels.cream;

    const stepped = stepWashLoad(levels, dt, {
      applying: applyingNow(),
      product: load.product,
      temperature: state.wash.temperature,
      pressure: state.wash.pressure,
      rub,
      load: load.amount,
    });
    levels = stepped.levels;
    load = { ...load, amount: Math.max(0, load.amount - stepped.used) };
    const ctx = fxContext();
    if (ctx) washFx.update(dt, ctx);
    updateWashSound(soundFor(state), state.wash.pressure, rub);

    const beforeMood = mood;
    mood = prefersReducedMotion() ? wantedMood() : stepMood(mood, dt, wantedMood());
    if (!sameMood(mood, beforeMood) || (state.stage === 'wash' && lightShown !== lightBefore) || shutBefore !== eyeTimer > 0 || Math.abs(levels.wet - before.wet) > 0.004) draw();
    else drawWash();

    sinceCommit += dt;
    if (sinceCommit > 0.3) commit();
    if (!wantsTicker()) {
      commit();
      syncTicker();
    }
  }


  function drawFx(): void {
    markDirty();
    fx.clear();
    drawClippings(fx, clippings, fall.t);
    drawSparks(fx, sparks, sparkClock.t);
    drawScissors(fx, scissors.x, scissors.y, scissors.angle, scissors.open, scissors.alpha);
    drawWand(fx, wand.x, wand.y, wand.angle, wand.glow, wand.alpha);
  }

  /** The colour hair has at its tips in a region, for the clippings. */
  function tipColour(region: Region): number {
    const bands = paintNow?.bands(REGION_AZIMUTH[region]);
    return bands ? bands[bands.length - 1].colour : 0xffd84a;
  }

  function showCut(positions: CutLengths, seed: number): void {
    if (shown) gsap.killTweensOf(shown);
    const at = positions as Positions;
    shown = { front: at.front, left: at.left, right: at.right, back: at.back };
    locks = buildLocks(shown, seed, look);
    bubbles = foamLayout(shown, seed);
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
  function spawnClippings(regions: Region[], from: CutLengths): void {
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

  function reachOf(lengths: CutLengths, region: Region): number {
    return reachAt(REGION_AZIMUTH[region], lengths);
  }

  /** Put the hair where it is meant to be now, and put the scissors away. */
  function finishCut(): void {
    snip?.kill();
    snip = undefined;
    scissors.alpha = 0;
    wand.alpha = 0;
    if (shown) gsap.killTweensOf(shown);
    if (shown && state) showCut(hairPosition(state), state.character.seed);
  }

  const samePositions = (a: Positions, b: Positions): boolean =>
    Math.abs(a.front - b.front) < 1e-6 && Math.abs(a.left - b.left) < 1e-6 && Math.abs(a.right - b.right) < 1e-6 && Math.abs(a.back - b.back) < 1e-6;

  /** The plan a swipe has just moved on, if the change since the last render was a swipe (the last swipe finishes the cut). */
  function swipeIn(prev: CutPlan | null, next: SalonState): CutPlan | null {
    if (!prev) return null;
    if (next.cut && next.cut.from === prev.from && next.cut.swipes > prev.swipes) return next.cut;
    if (!next.cut && prev.swipes === SWIPES_TO_CUT - 1 && samePositions(positionsOf(next.hair.length), prev.to)) return prev;
    return null;
  }

  /**
   * Bring the hair to where the cut has got to. Choosing a length changes nothing by itself; each swipe moves the
   * hair an eighth of the way, gliding there rather than jumping. A swipe that shortens snips with the scissors and
   * drops clippings; one that only lengthens grows with a soft chime. With reduced motion the hair simply moves.
   */
  function applyCut(next: SalonState): void {
    const want = hairPosition(next);
    const swipe = swipeIn(prevCut, next);
    prevCut = next.cut;
    if (!shown) {
      showCut(want, next.character.seed);
      return;
    }
    const from = { ...shown };
    const reduced = prefersReducedMotion();
    if (!samePositions(shown, want)) {
      gsap.killTweensOf(shown);
      if (reduced) {
        showCut(want, next.character.seed);
      } else {
        const target = shown;
        gsap.to(target, {
          ...want,
          duration: 0.3,
          ease: 'sine.inOut',
          onUpdate: () => {
            if (!state) return;
            locks = buildLocks(target, state.character.seed, look);
            bubbles = foamLayout(target, state.character.seed);
            draw();
          },
        });
      }
    }
    if (swipe) snipFor(swipe, from, reduced);
  }

  /**
   * What one swipe looks and sounds like. Shortening snips with the scissors and drops clippings; hair that only
   * grows gets a magic wand, a fountain of stars and a sparkly sound instead.
   */
  function snipFor(plan: CutPlan, from: Positions, reduced: boolean): void {
    const tool = toolFor(plan);
    if (!tool) return;
    snip?.kill();
    scissors.alpha = 0;
    wand.alpha = 0;
    const moving = movingRegions(plan);
    if (tool === 'wand') {
      playSparkle();
      if (!reduced) waveWand(moving.map((m) => m.region), from);
      return;
    }
    const cutting = moving.filter((m) => m.shorter).map((m) => m.region);
    if (reduced) {
      playSnip();
      return;
    }
    // Meet the hair at the most visible region being cut.
    const best = cutting
      .map((r) => ({ r, ...regionPoint(r, turn.phi, reachOf(from, r)) }))
      .sort((a, b) => b.facing - a.facing)[0];
    const fromLeft = best.x < HEAD.cx;
    const approach = fromLeft ? 1 : -1;
    snip?.kill();
    scissors.x = best.x - approach * 46;
    scissors.y = best.y;
    scissors.angle = fromLeft ? -0.25 : Math.PI + 0.25;
    scissors.open = 0;
    scissors.alpha = 0;
    spawnClippings(cutting, from);

    const tl = gsap.timeline({ onUpdate: draw });
    snip = tl;
    tl.to(scissors, { alpha: 1, x: best.x - approach * 14, duration: 0.1, ease: 'power2.out' })
      .to(scissors, { open: 1, duration: 0.06, ease: 'power1.out' })
      .to(scissors, { open: 0, x: best.x - approach * 4, duration: 0.06, ease: 'power1.in', onComplete: playSnip })
      .to(scissors, { alpha: 0, x: best.x - approach * 40, duration: 0.16, ease: 'power2.in' }, '+=0.04');
  }

  /** The wand sweeps in beside the most visible growing region, waves, and sends up a fountain of stars. */
  function waveWand(growing: Region[], from: Positions): void {
    const best = growing
      .map((r) => ({ r, ...regionPoint(r, turn.phi, reachOf(from, r)) }))
      .sort((a, b) => b.facing - a.facing)[0];
    const fromLeft = best.x < HEAD.cx;
    const approach = fromLeft ? 1 : -1;
    snip?.kill();
    wand.x = best.x - approach * 50;
    wand.y = best.y - 26;
    wand.angle = fromLeft ? -0.7 : Math.PI + 0.7;
    wand.glow = 0;
    wand.alpha = 0;
    const tl = gsap.timeline({ onUpdate: draw });
    snip = tl;
    tl.to(wand, { alpha: 1, x: best.x - approach * 14, y: best.y - 8, duration: 0.12, ease: 'power2.out' })
      .call(() => playSparks(wandSparks(best.x, best.y + 6)))
      .to(wand, { glow: 1, angle: wand.angle + (fromLeft ? 0.35 : -0.35), duration: 0.12, ease: 'sine.inOut' })
      .to(wand, { glow: 0.2, angle: wand.angle, duration: 0.12, ease: 'sine.inOut' })
      .to(wand, { glow: 1, angle: wand.angle + (fromLeft ? 0.35 : -0.35), duration: 0.12, ease: 'sine.inOut' })
      .to(wand, { alpha: 0, glow: 0, x: best.x - approach * 50, y: best.y - 30, duration: 0.18, ease: 'power2.in' });
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

  /** Squirt some of a product onto her head. A second squirt of the same product tops it up; another product replaces it. */
  function squirt(product: Product): void {
    load =
      load.product === product && load.amount > 0
        ? { product, amount: Math.min(2, load.amount + LOAD_PER_SQUIRT) }
        : { product, amount: LOAD_PER_SQUIRT };
    blobAge = 0;
    blobColour = SHELF_PRODUCTS[product].colour;
    eyeTimer = Math.max(eyeTimer, EYES_SHUT_AFTER_SQUIRT);
    playSquirt();
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
      prevCut = null;
      swipeReset();
      mood = CALM;
      load = { ...load, amount: 0 };
      blobAge = -1;
      rub = 0;
      rubMoved = 0;
      rubLast = undefined;
      eyeTimer = 0;
      seenSquirts = next.wash.squirts;
    }

    // A squirt: a blob pops onto her crown, and the product waits to be rubbed in.
    if (next.wash.squirts !== seenSquirts) {
      seenSquirts = next.wash.squirts;
      if (next.stage === 'wash') squirt(next.wash.product);
    }
    if (next.stage !== 'cut') swipeReset();
    // Leaving the sink ends any rubbing and opens her eyes.
    if (next.stage !== 'wash' && (rub > 0 || eyeTimer > 0 || blobAge >= 0)) {
      rub = 0;
      rubMoved = 0;
      rubLast = undefined;
      aimGoal = null;
      eyeTimer = 0;
      blobAge = -1;
    }

    applyLook(next);

    // A different character gets a fresh head of hair at once; a change of cut goes through the scissors.
    const seedKey = String(next.character.seed);
    if (seedKey !== locksKey) {
      finishCut();
      showCut(hairPosition(next), next.character.seed);
      prevCut = next.cut;
      locksKey = seedKey;
    } else {
      applyCut(next);
    }

    // The washing levels come from the store whenever something other than this scene changed them.
    const stored = washLevels(next);
    if (!sameLevels(stored, lastCommitted)) {
      levels = stored;
      lastCommitted = stored;
      lightShown = stored.cream;
    }
    const running = waterRunning(next);
    if (wasApplying && !running) commit();
    wasApplying = running;
    if (next.stage !== 'wash') washFx.clear();
    updateWashSound(soundFor(next), next.wash.pressure, rub);
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
    const was = { scale: world.scale.x, x: world.x, y: world.y, blink: eyes.blink, fx: fx.visible, cy: character.y, eyeTimer, blobAge };
    try {
      // Show her as she'd pose: eyes open, no breath, no markers, no scissors or sparks.
      eyes.blink = 0;
      eyeTimer = 0;
      blobAge = -1;
      posing = true;
      character.y = washG.y = 0;
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
      eyeTimer = was.eyeTimer;
      posing = false;
      blobAge = was.blobAge;
      fx.visible = was.fx;
      character.y = washG.y = was.cy;
      target.destroy(true);
      draw();
    }
  }

  return {
    render,
    regionAt,
    photo,
    washHit,
    onHair(clientX: number, clientY: number): boolean {
      return !!state && regionAt(clientX, clientY) !== undefined;
    },
    rub(clientX: number, clientY: number): void {
      const p = toDesign(clientX, clientY);
      if (!p || !state || state.stage !== 'wash') return;
      if (regionAt(clientX, clientY) === undefined) {
        rubLast = undefined;
        swipeReset();
        return;
      }
      if (rubLast) rubMoved += Math.hypot(p.x - rubLast.x, p.y - rubLast.y);
      rubLast = p;
      if (strokeStep(p)) conditionStep();
      aimGoal = { x: Math.min(300, Math.max(120, p.x)), y: Math.min(300, Math.max(170, p.y)) };
      syncTicker();
    },
    swipe(clientX: number, clientY: number): void {
      const p = toDesign(clientX, clientY);
      if (!p || !state || state.stage !== 'cut') return;
      if (regionAt(clientX, clientY) === undefined) {
        swipeReset();
        return;
      }
      if (strokeStep(p)) cutSwipe();
    },
    endSwipe() {
      swipeReset();
    },
    endRub() {
      rubLast = undefined;
      swipeReset();
      aimGoal = null;
      syncTicker();
    },
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
      gsap.killTweensOf(wand);
      gsap.killTweensOf(turn);
      if (fade) gsap.killTweensOf(fade);
      observer.disconnect();
      app.renderer.off('resize', layout);
      app.destroy({ removeView: true }, { children: true });
    },
  };
}
