import type { Graphics } from 'pixi.js';
import { INK, OUTLINE, celEllipse, shade } from './style';

/**
 * Reusable procedural props. Every prop sits on a line at `baseY` (its lowest point) around `x`,
 * uses the same ink outline as the characters, and takes colours as parameters so variety is cheap.
 */

const LINE = 3;

export function shelfBoard(g: Graphics, x: number, y: number, width: number): void {
  g.roundRect(x, y, width, 12, 4).fill(0xb5651d).stroke({ width: OUTLINE, color: INK });
  g.roundRect(x + 3, y + 2, width - 6, 3, 1).fill(0xd68a45);
}

export function pot(g: Graphics, x: number, baseY: number, scale = 1, colour = 0xff8a5b): void {
  const w = 44 * scale;
  const h = 40 * scale;
  g.poly([x - w / 2, baseY - h, x + w / 2, baseY - h, x + w / 2 - 6 * scale, baseY, x - w / 2 + 6 * scale, baseY])
    .fill(colour)
    .stroke({ width: OUTLINE, color: INK });
  g.rect(x - w / 2 - 3, baseY - h - 6 * scale, w + 6, 10 * scale)
    .fill(shade(colour, 1.12))
    .stroke({ width: OUTLINE, color: INK });
}

export function plant(g: Graphics, x: number, baseY: number, scale = 1, potColour = 0xff8a5b, leaf = 0x2ecc71): void {
  // Leaves go down first so the pot overlaps their stems.
  const leaves: Array<[number, number, number, number]> = [
    [-14, -62, 13, 30],
    [14, -62, 13, 30],
    [0, -74, 12, 34],
    [-26, -48, 11, 24],
    [26, -48, 11, 24],
  ];
  for (const [lx, ly, rx, ry] of leaves) {
    celEllipse(g, x + lx * scale, baseY + ly * scale, rx * scale, ry * scale, leaf, { inset: 5 * scale });
  }
  pot(g, x, baseY, scale, potColour);
}

export function bottle(g: Graphics, x: number, baseY: number, colour: number, tall = 1, size = 1): void {
  const h = 34 * tall * size;
  g.roundRect(x - 9 * size, baseY - h, 18 * size, h, 5 * size).fill(colour).stroke({ width: LINE, color: INK });
  g.roundRect(x - 6 * size, baseY - h * 0.7, 6 * size, h * 0.5, 3 * size).fill({ color: 0xffffff, alpha: 0.45 });
  g.roundRect(x - 5 * size, baseY - h - 9 * size, 10 * size, 9 * size, 2 * size)
    .fill(0xffffff)
    .stroke({ width: LINE, color: INK });
}

export function sprayBottle(g: Graphics, x: number, baseY: number, colour = 0x7bdff2): void {
  g.roundRect(x - 11, baseY - 38, 22, 38, 6).fill(colour).stroke({ width: LINE, color: INK });
  g.roundRect(x - 7, baseY - 33, 6, 18, 3).fill({ color: 0xffffff, alpha: 0.45 });
  g.rect(x - 5, baseY - 46, 10, 8).fill(0xdfe6ea).stroke({ width: LINE, color: INK });
  g.poly([x - 7, baseY - 56, x + 13, baseY - 56, x + 13, baseY - 46, x - 7, baseY - 46])
    .fill(0xffffff)
    .stroke({ width: LINE, color: INK });
  g.rect(x + 13, baseY - 54, 6, 4).fill(0xdfe6ea).stroke({ width: 2, color: INK });
  g.poly([x + 9, baseY - 46, x + 14, baseY - 46, x + 11, baseY - 38]).fill(0xff4d6d).stroke({ width: 2, color: INK });
}

export function hairdryer(g: Graphics, x: number, baseY: number, colour = 0xff6fb1): void {
  const cy = baseY - 44;
  // Handle first, so the body overlaps its top.
  g.roundRect(x - 8, cy + 6, 15, baseY - cy - 6, 5).fill(0x3a2a55).stroke({ width: LINE, color: INK });
  g.poly([x + 22, cy - 11, x + 38, cy - 16, x + 38, cy + 16, x + 22, cy + 11])
    .fill(shade(colour, 0.8))
    .stroke({ width: LINE, color: INK });
  g.roundRect(x - 30, cy - 14, 54, 28, 13).fill(colour).stroke({ width: OUTLINE, color: INK });
  g.roundRect(x - 24, cy - 9, 30, 5, 2).fill({ color: 0xffffff, alpha: 0.55 });
  for (let i = 0; i < 3; i++) g.moveTo(x - 16 + i * 7, cy + 3).lineTo(x - 16 + i * 7, cy + 9).stroke({ width: 2.5, color: INK, cap: 'round' });
}

/** A cup holding scissors, a comb and a brush. */
export function toolCup(g: Graphics, x: number, baseY: number, colour = 0x4cc9f0): void {
  // Brush, comb and scissors poke out behind the cup.
  g.roundRect(x - 20, baseY - 58, 6, 34, 3).fill(0xffd84a).stroke({ width: LINE, color: INK });
  g.ellipse(x - 17, baseY - 62, 9, 7).fill(0xff6fb1).stroke({ width: LINE, color: INK });
  g.roundRect(x + 13, baseY - 56, 7, 32, 2).fill(0x6c5ce7).stroke({ width: LINE, color: INK });

  g.moveTo(x - 5, baseY - 56).lineTo(x + 9, baseY - 26).stroke({ width: 7, color: INK, cap: 'round' });
  g.moveTo(x + 9, baseY - 56).lineTo(x - 5, baseY - 26).stroke({ width: 7, color: INK, cap: 'round' });
  g.moveTo(x - 5, baseY - 56).lineTo(x + 9, baseY - 26).stroke({ width: 3, color: 0xdfe6ea, cap: 'round' });
  g.moveTo(x + 9, baseY - 56).lineTo(x - 5, baseY - 26).stroke({ width: 3, color: 0xdfe6ea, cap: 'round' });
  for (const rx of [x - 5, x + 9]) {
    g.circle(rx, baseY - 61, 6).stroke({ width: 5.5, color: INK });
    g.circle(rx, baseY - 61, 6).stroke({ width: 2.5, color: 0xff4d6d });
  }

  g.poly([x - 18, baseY - 30, x + 18, baseY - 30, x + 14, baseY, x - 14, baseY])
    .fill(colour)
    .stroke({ width: OUTLINE, color: INK });
  g.roundRect(x - 14, baseY - 26, 6, 18, 3).fill({ color: 0xffffff, alpha: 0.4 });
}

export function clippers(g: Graphics, x: number, baseY: number, colour = 0x6c5ce7): void {
  g.roundRect(x - 12, baseY - 44, 24, 44, 8).fill(colour).stroke({ width: LINE, color: INK });
  g.roundRect(x - 8, baseY - 38, 6, 22, 3).fill({ color: 0xffffff, alpha: 0.4 });
  g.rect(x - 15, baseY - 54, 30, 11).fill(0xdfe6ea).stroke({ width: LINE, color: INK });
  for (let i = 0; i < 6; i++) g.moveTo(x - 12 + i * 5, baseY - 53).lineTo(x - 12 + i * 5, baseY - 46).stroke({ width: 1.5, color: INK });
  g.circle(x, baseY - 14, 4).fill(0xffffff).stroke({ width: 2, color: INK });
}

export function colourBowl(g: Graphics, x: number, baseY: number, colour = 0xb388ff): void {
  g.moveTo(x - 25, baseY - 18)
    .bezierCurveTo(x - 23, baseY + 1, x + 23, baseY + 1, x + 25, baseY - 18)
    .closePath()
    .fill(0xf5f5f5)
    .stroke({ width: LINE, color: INK });
  g.ellipse(x, baseY - 18, 25, 6).fill(colour).stroke({ width: LINE, color: INK });
  // Application brush resting in the bowl.
  g.moveTo(x + 2, baseY - 19).lineTo(x + 28, baseY - 54).stroke({ width: 7, color: INK, cap: 'round' });
  g.moveTo(x + 2, baseY - 19).lineTo(x + 28, baseY - 54).stroke({ width: 3.5, color: 0xffd84a, cap: 'round' });
  g.ellipse(x + 3, baseY - 20, 5, 4).fill(colour).stroke({ width: 2, color: INK });
}

export function clips(g: Graphics, x: number, baseY: number): void {
  const colours = [0x4cc9f0, 0xffd84a, 0xff6fb1];
  colours.forEach((c, i) => {
    const y = baseY - 9 * (i + 1);
    g.roundRect(x - 18 + i * 2, y, 36, 9, 4).fill(c).stroke({ width: 2.5, color: INK });
    g.circle(x - 10 + i * 2, y + 4.5, 2).fill(INK);
  });
}

export function comb(g: Graphics, x: number, baseY: number, width = 40): void {
  g.roundRect(x, baseY - 13, width, 6, 3).fill(0x6c5ce7).stroke({ width: 2.5, color: INK });
  for (let i = 0; i < Math.floor((width - 4) / 4); i++) {
    g.rect(x + 3 + i * 4, baseY - 7, 2.5, 7).fill(0x6c5ce7).stroke({ width: 1.2, color: INK });
  }
}

export function roundBrush(g: Graphics, x: number, baseY: number): void {
  g.roundRect(x - 28, baseY - 9, 36, 8, 4).fill(0x8e5a2b).stroke({ width: 2.5, color: INK });
  g.circle(x + 16, baseY - 13, 13).fill(0xff6fb1).stroke({ width: LINE, color: INK });
  for (let a = 0; a < 6; a++) {
    const t = (a / 6) * Math.PI * 2;
    g.moveTo(x + 16 + Math.cos(t) * 4, baseY - 13 + Math.sin(t) * 4)
      .lineTo(x + 16 + Math.cos(t) * 10, baseY - 13 + Math.sin(t) * 10)
      .stroke({ width: 2, color: INK, cap: 'round' });
  }
}

export function towelStack(g: Graphics, x: number, baseY: number): void {
  const colours = [0xffffff, 0xffb4d2, 0x9ff0d6];
  colours.forEach((c, i) => {
    g.roundRect(x - 27 + (i % 2), baseY - 13 * (i + 1), 54, 13, 5).fill(c).stroke({ width: LINE, color: INK });
    g.moveTo(x - 20, baseY - 13 * (i + 1) + 6).lineTo(x + 20, baseY - 13 * (i + 1) + 6).stroke({ width: 1.5, color: shade(c, 0.8) });
  });
}
