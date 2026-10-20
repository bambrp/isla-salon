import { Application, Container, Graphics } from 'pixi.js';
import gsap from 'gsap';
import { VIEWS, sceneFor, type SalonState } from '../state';
import { drawBackdrop } from './backdrop';
import { drawCharacter } from './character';
import { COLOUR_FADE_SECONDS, ColourFade } from './colourFade';
import { buildLocks, type Lock } from './hair';

export interface SceneHandle {
  /** Redraw the scene for the given state. Cheap enough to call on every state change. */
  render(state: SalonState): void;
  destroy(): void;
}

/** Design space: everything is drawn in a 400 x 500 box, then scaled to fit the host. */
const DESIGN_W = 400;
const DESIGN_H = 500;

/** Seconds for the swing between two views. */
const SWING_SECONDS = 0.55;

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
  world.addChild(backdrop, character);
  app.stage.addChild(world);

  let state: SalonState | undefined;
  let drawnScene: 'sink' | 'mirror' | undefined;
  let destroyed = false;

  // Hair geometry only changes when the cut does, so build it once per cut rather than per frame.
  let locks: Lock[] = [];
  let locksKey = '';

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
    drawCharacter(character, state, turn.phi, locks, fade.paint());
  }

  function render(next: SalonState): void {
    if (destroyed) return;
    state = next;

    const scene = sceneFor(next.stage);
    if (scene !== drawnScene) {
      drawBackdrop(backdrop, scene);
      drawnScene = scene;
    }

    const { front, left, right, back } = next.hair.length;
    const key = `${front}|${left}|${right}|${back}|${next.character.seed}`;
    if (key !== locksKey) {
      locks = buildLocks(next.hair.length, next.character.seed);
      locksKey = key;
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

  return {
    render,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      gsap.killTweensOf(turn);
      if (fade) gsap.killTweensOf(fade);
      observer.disconnect();
      app.renderer.off('resize', layout);
      app.destroy({ removeView: true }, { children: true });
    },
  };
}
