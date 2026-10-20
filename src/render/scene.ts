import { Application, Container, Graphics } from 'pixi.js';
import gsap from 'gsap';
import { VIEWS, sceneFor, type Region, type SalonState } from '../state';
import { playGrow, playSnip } from '../audio';
import { REGION_AZIMUTH, changedRegions, isShorter, regionOfAzimuth } from '../cut';
import { drawBackdrop } from './backdrop';
import { drawCharacter } from './character';
import { COLOUR_FADE_SECONDS, ColourFade } from './colourFade';
import { HEAD, project, silhouetteHalfWidth } from './geometry';
import { buildLocks, reachAt, splitLocks, type Lock, type Lengths } from './hair';
import { CLIPPING_LIFE, drawClippings, drawScissors, type Clipping } from './scissors';
import { INK } from './style';

export interface SceneHandle {
  /** Redraw the scene for the given state. Cheap enough to call on every state change. */
  render(state: SalonState): void;
  /** The region of the head at a point on the page (client coordinates), or undefined if the point isn't on her head or hair. */
  regionAt(clientX: number, clientY: number): Region | undefined;
  destroy(): void;
}

/** Design space: everything is drawn in a 400 x 500 box, then scaled to fit the host. */
const DESIGN_W = 400;
const DESIGN_H = 500;

/** Seconds for the swing between two views. */
const SWING_SECONDS = 0.55;

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

  const world = new Container();
  const backdrop = new Graphics();
  const character = new Graphics();
  const guide = new Graphics();
  const fx = new Graphics();
  world.addChild(backdrop, character, guide, fx);
  app.stage.addChild(world);

  let state: SalonState | undefined;
  let drawnScene: 'sink' | 'mirror' | undefined;
  let destroyed = false;

  // Hair geometry only changes when the cut does, so build it once per cut rather than per frame. The cut on show
  // lags the requested one by a moment while the scissors work.
  let locks: Lock[] = [];
  let locksKey = '';
  let shown: Lengths | undefined;
  let snip: gsap.core.Timeline | undefined;
  let pendingCut: Lengths | undefined;

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

  function layout(): void {
    const w = app.screen.width;
    const h = app.screen.height;
    // Fit the character box to the host, anchoring it to the bottom so the gown always sits on the edge.
    const scale = Math.min(w / DESIGN_W, h / DESIGN_H);
    world.scale.set(scale);
    world.position.set((w - DESIGN_W * scale) / 2, h - DESIGN_H * scale);
  }

  function draw(): void {
    if (destroyed || !state || !fade) return;
    paintNow = fade.paint();
    drawCharacter(character, state, turn.phi, locks, paintNow);
    drawGuide();
    drawFx();
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
    fx.clear();
    drawClippings(fx, clippings, fall.t);
    drawScissors(fx, scissors.x, scissors.y, scissors.angle, scissors.open, scissors.alpha);
  }

  /** The colour hair has at its tips in a region, for the clippings. */
  function tipColour(region: Region): number {
    const bands = paintNow?.bands(REGION_AZIMUTH[region]);
    return bands ? bands[bands.length - 1].colour : 0xffd84a;
  }

  function showCut(lengths: Lengths, seed: number): void {
    locks = buildLocks(lengths, seed);
    shown = { ...lengths };
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

  function render(next: SalonState): void {
    if (destroyed) return;
    state = next;

    const scene = sceneFor(next.stage);
    if (scene !== drawnScene) {
      drawBackdrop(backdrop, scene);
      drawnScene = scene;
    }

    // A different character gets a fresh head of hair at once; a change of cut goes through the scissors.
    const seedKey = String(next.character.seed);
    if (seedKey !== locksKey) {
      finishCut();
      showCut(next.hair.length, next.character.seed);
      locksKey = seedKey;
    } else {
      applyCut(next);
    }

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
      targetPhi += (steps * Math.PI) / 2;
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

  function regionAt(clientX: number, clientY: number): Region | undefined {
    const rect = app.canvas.getBoundingClientRect();
    const scale = world.scale.x;
    if (!scale || !state) return undefined;
    const x = (clientX - rect.left - world.x) / scale;
    const y = (clientY - rect.top - world.y) / scale;

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

  return {
    render,
    regionAt,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      snip?.kill();
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
