import type { Graphics } from 'pixi.js';

/** Cel-shading style constants shared by every procedural shape. */
export const INK = 0x1d1030;
export const OUTLINE = 4;

export function hexToNumber(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

/** Multiply each channel; factor < 1 darkens, > 1 lightens (clamped). */
export function shade(color: number, factor: number): number {
  const r = Math.min(255, Math.round(((color >> 16) & 0xff) * factor));
  const g = Math.min(255, Math.round(((color >> 8) & 0xff) * factor));
  const b = Math.min(255, Math.round((color & 0xff) * factor));
  return (r << 16) | (g << 8) | b;
}

/**
 * A cel-shaded ellipse: an outlined shadow-coloured base with a smaller, offset lit shape on top.
 * The offset leaves a hard-edged crescent of shadow on the lower right, as in cell-shaded cartoons.
 */
export function celEllipse(
  g: Graphics,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  base: number,
  options: { shadow?: number; dx?: number; dy?: number; inset?: number } = {},
): void {
  const { shadow = shade(base, 0.8), dx = -6, dy = -4, inset = 8 } = options;
  g.ellipse(cx, cy, rx, ry).fill(shadow).stroke({ width: OUTLINE, color: INK });
  g.ellipse(cx + dx, cy + dy, rx - inset, ry - inset * 0.8).fill(base);
}
