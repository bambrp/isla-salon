import type { Graphics } from 'pixi.js';

/**
 * Cel-shading style constants. See docs/style-guide.md for the rules behind them.
 * Every procedural shape (character, props, backdrop) uses these so the whole scene reads as one drawing.
 */
export const INK = 0x1d1030;

/** Heavy outline for large shapes (head, gown, hair silhouette). */
export const OUTLINE = 4;
/** Lighter outline for small props and interior hair locks. */
export const OUTLINE_THIN = 3;

/** Fixed light from the upper left. Shadows always fall to the lower right, whatever the view. */
export const LIGHT = { x: -0.5, y: -0.6 } as const;

/** How much darker a shadow tone is than its lit tone. */
export const SHADOW_FACTOR = 0.78;

export const PALETTE = {
  skin: 0xffd9b8,
  blush: 0xff7aa8,
  gown: 0x14101e,
  gownFold: 0x3a2f55,
  gownFoldDark: 0x2a2240,
  pink: 0xff6fb1,
  wallPink: 0xffb4d2,
  wallPinkDark: 0xffa2c8,
  wallTile: 0x9fe3f5,
  wallTileLine: 0x6fc8e0,
  mirror: 0xd9f6ff,
  gold: 0xffd84a,
  wood: 0xb5651d,
  leaf: 0x2ecc71,
  porcelain: 0xeef6fa,
  steel: 0xc9d6df,
} as const;

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
  const { shadow = shade(base, SHADOW_FACTOR + 0.02), dx = -6, dy = -4, inset = 8 } = options;
  g.ellipse(cx, cy, rx, ry).fill(shadow).stroke({ width: OUTLINE, color: INK });
  g.ellipse(cx + dx, cy + dy, Math.max(1, rx - inset), Math.max(1, ry - inset * 0.8)).fill(base);
}
