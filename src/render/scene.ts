import { Application, Container, Graphics } from 'pixi.js';
import { sceneFor, type SalonState } from '../state';
import { drawBackdrop } from './backdrop';
import { drawCharacter } from './character';

export interface SceneHandle {
  /** Redraw the scene for the given state. Cheap enough to call on every state change. */
  render(state: SalonState): void;
  destroy(): void;
}

/** Design space: everything is drawn in a 400 x 500 box, then scaled to fit the host. */
const DESIGN_W = 400;
const DESIGN_H = 500;

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

  let drawnScene: 'sink' | 'mirror' | undefined;
  let destroyed = false;

  function layout(): void {
    const w = app.screen.width;
    const h = app.screen.height;
    // Fit the character box to the host, anchoring it to the bottom so the gown always sits on the edge.
    const scale = Math.min(w / DESIGN_W, h / DESIGN_H);
    world.scale.set(scale);
    world.position.set((w - DESIGN_W * scale) / 2, h - DESIGN_H * scale);
  }

  function render(state: SalonState): void {
    if (destroyed) return;
    const scene = sceneFor(state.stage);
    if (scene !== drawnScene) {
      drawBackdrop(backdrop, scene);
      drawnScene = scene;
    }
    drawCharacter(character, state);
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
      observer.disconnect();
      app.renderer.off('resize', layout);
      app.destroy({ removeView: true }, { children: true });
    },
  };
}
