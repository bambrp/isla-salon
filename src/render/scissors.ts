import type { Graphics } from 'pixi.js';
import { INK, OUTLINE_THIN } from './style';

/**
 * The hairdresser's scissors, drawn for the snip animation, and the clipped hair that falls from them.
 * Both are pure drawing: the scene decides where and when.
 */

const STEEL = 0xe3ebf3;
const STEEL_SHADE = 0xb7c4d2;
const HANDLE = 0xff5d8f;

/**
 * Scissors with the pivot at (x, y), the blades pointing along `angle` (radians, 0 = to the right). `open` runs
 * from 0 (shut) to 1 (wide open); `alpha` fades them in and out.
 */
export function drawScissors(g: Graphics, x: number, y: number, angle: number, open: number, alpha: number): void {
  if (alpha <= 0.01) return;
  const spread = (3 + 17 * open) * (Math.PI / 180);
  const blade = 62;
  const handle = 30;

  // Each half is a blade and a ring handle on opposite sides of the pivot, turned by +/- spread.
  for (const sign of [-1, 1]) {
    const a = angle + sign * spread;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const px = -sa;
    const py = ca;
    const tipX = x + ca * blade;
    const tipY = y + sa * blade;
    // Blade: a slim wedge from the pivot to a point, its inner edge straight so the two blades meet.
    g.poly([
      x + px * sign * 1, y + py * sign * 1,
      x + ca * blade * 0.55 - px * sign * 6, y + sa * blade * 0.55 - py * sign * 6,
      tipX, tipY,
    ])
      .fill({ color: sign < 0 ? STEEL : STEEL_SHADE, alpha })
      .stroke({ width: OUTLINE_THIN, color: INK, alpha, join: 'round' });

    // Handle: a shank back from the pivot, ending in a ring.
    const hx = x - ca * handle;
    const hy = y - sa * handle;
    g.moveTo(x, y).lineTo(hx, hy).stroke({ width: 5, color: INK, alpha, cap: 'round' });
    g.moveTo(x, y).lineTo(hx, hy).stroke({ width: 2.4, color: HANDLE, alpha, cap: 'round' });
    const rx = hx - ca * 7 + px * sign * 3;
    const ry = hy - sa * 7 + py * sign * 3;
    g.circle(rx, ry, 9).fill({ color: 0xffffff, alpha: 0 }).stroke({ width: 6, color: INK, alpha });
    g.circle(rx, ry, 9).stroke({ width: 3, color: HANDLE, alpha });
  }
  g.circle(x, y, 3.2).fill({ color: 0xffd84a, alpha }).stroke({ width: OUTLINE_THIN, color: INK, alpha });
}

/** One clipped lock of hair. Its position at any time follows from where it started, so no state is kept. */
export interface Clipping {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  spin: number;
  len: number;
  colour: number;
}

/** Seconds a clipping takes to fall and fade. */
export const CLIPPING_LIFE = 1.1;
const GRAVITY = 620;
/** Clippings vanish at this design-space y (the bottom of the picture). */
const FLOOR = 492;

/** Where a clipping is at time t (seconds after it was cut), and how opaque it is. */
export function clippingAt(c: Clipping, t: number): { x: number; y: number; rot: number; alpha: number } {
  const y = Math.min(FLOOR, c.y + c.vy * t + 0.5 * GRAVITY * t * t);
  const fadeStart = CLIPPING_LIFE - 0.35;
  const alpha = t <= fadeStart ? 1 : Math.max(0, 1 - (t - fadeStart) / 0.35);
  return { x: c.x + c.vx * t + 5 * Math.sin(t * 9 + c.rot), y, rot: c.rot + c.spin * t, alpha };
}

export function drawClippings(g: Graphics, clippings: readonly Clipping[], t: number): void {
  for (const c of clippings) {
    const p = clippingAt(c, t);
    if (p.alpha <= 0.01) continue;
    const dx = Math.cos(p.rot) * c.len * 0.5;
    const dy = Math.sin(p.rot) * c.len * 0.5;
    const nx = -Math.sin(p.rot) * 2.6;
    const ny = Math.cos(p.rot) * 2.6;
    g.poly([p.x - dx + nx, p.y - dy + ny, p.x + dx, p.y + dy, p.x - dx - nx, p.y - dy - ny])
      .fill({ color: c.colour, alpha: p.alpha })
      .stroke({ width: 1.1, color: INK, alpha: p.alpha, join: 'round' });
  }
}
