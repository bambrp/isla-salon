import type { Graphics } from 'pixi.js';
import { INK, OUTLINE } from './style';
import { BOTTLE_SCALE, DIAL, TAP, SHELF_BOARD, SHELF_PRODUCTS, bottleHeight } from './sinkLayout';
import { drawHolder } from './sprayer';
import type { Product } from './wash';
import {
  bottle,
  clippers,
  clips,
  colourBowl,
  comb,
  hairdryer,
  plant,
  roundBrush,
  shelfBoard,
  sprayBottle,
  toolCup,
} from './props';

/** Design space is 400 x 500. The wall is drawn oversized so any screen aspect is covered. */
const WALL = { x: -600, y: -600, w: 1600, h: 1800 };

/** The angle of the tap handle for a pressure from 0 (off, pointing down and left) to 1 (full, down and right). */
export function tapAngle(pressure: number): number {
  return ((135 + 270 * Math.min(1, Math.max(0, pressure))) * Math.PI) / 180;
}

/** Scale colour at position t along the dial, from icy blue through pale to hot red. */
export function dialColour(t: number): number {
  const lerp = (a: number, b: number, k: number) => Math.round(a + (b - a) * k);
  const stops: [number, number, number][] = [
    [0x4c, 0xb8, 0xff],
    [0xf3, 0xf3, 0xf3],
    [0xff, 0x4d, 0x4d],
  ];
  const [a, b, k] = t < 0.5 ? [stops[0], stops[1], t / 0.5] : [stops[1], stops[2], (t - 0.5) / 0.5];
  return (lerp(a[0], b[0], k) << 16) | (lerp(a[1], b[1], k) << 8) | lerp(a[2], b[2], k);
}

function drawSink(g: Graphics): void {
  // Tiled wall.
  g.rect(WALL.x, WALL.y, WALL.w, WALL.h).fill(0x9fe3f5);
  for (let x = -600; x < 1000; x += 50) g.moveTo(x, WALL.y).lineTo(x, 1200).stroke({ width: 1.5, color: 0x6fc8e0 });
  for (let y = -600; y < 1200; y += 50) g.moveTo(WALL.x, y).lineTo(1000, y).stroke({ width: 1.5, color: 0x6fc8e0 });

  // Wall shelves on the left: the three shampoos (mint, citrus, tropical), and the conditioner below them.
  shelfBoard(g, SHELF_BOARD.x, 232, SHELF_BOARD.width);
  shelfBoard(g, SHELF_BOARD.x, 322, SHELF_BOARD.width);
  for (const [name, b] of Object.entries(SHELF_PRODUCTS) as [Product, (typeof SHELF_PRODUCTS)[Product]][]) {
    bottle(g, b.x, b.baseY, b.colour, b.tall, BOTTLE_SCALE);
    bottleLabel(g, name, b.x, b.baseY - bottleHeight(b.tall) * 0.45);
  }

  // The pressure tap: a chrome plate with a scale of five water drops, off at the bottom left and full at the bottom right.
  // The washing layer draws the cross handle on top.
  g.circle(TAP.x, TAP.y, TAP.r + 6).fill(0xdfe9f0).stroke({ width: OUTLINE, color: INK });
  for (let i = 0; i <= 4; i++) {
    const a = tapAngle(i / 4);
    const x = TAP.x + Math.cos(a) * (TAP.r + 0.5);
    const y = TAP.y + Math.sin(a) * (TAP.r + 0.5);
    g.circle(x, y, i === 0 ? 2.2 : 1.6 + 0.5 * i).fill(i === 0 ? 0xff4d4d : 0x2d98da).stroke({ width: 1, color: INK });
  }

  // The sprayer's wall bracket; the sprayer and its hose are drawn by the washing layer, because they move.
  drawHolder(g);

  // Temperature dial on the wall: a chrome ring with a blue to red scale. The washing layer draws the lever on top.
  g.circle(DIAL.x, DIAL.y, DIAL.r + 9).fill(0xdfe9f0).stroke({ width: OUTLINE, color: INK });
  for (let i = 0; i < 12; i++) {
    const t = i / 11;
    const a0 = (-125 + 250 * (i / 12) - 90) * (Math.PI / 180);
    const a1 = (-125 + 250 * ((i + 1) / 12) - 90) * (Math.PI / 180);
    const r = DIAL.r + 1.5;
    g.moveTo(DIAL.x + Math.cos(a0) * r, DIAL.y + Math.sin(a0) * r)
      .arc(DIAL.x, DIAL.y, r, a0, a1)
      .stroke({ width: 7.5, color: dialColour(t) });
  }

  // Basin: a wide white bowl behind the shoulders.
  g.roundRect(30, 400, 340, 140, 40).fill(0xeef6fa).stroke({ width: OUTLINE, color: INK });
  g.roundRect(46, 414, 308, 40, 20).fill(0xd2e4ec);

  // Counters either side with potted plants.
  g.roundRect(-600, 430, 640, 24, 6).fill(0xf5d6a1).stroke({ width: OUTLINE, color: INK });
  g.roundRect(360, 430, 640, 24, 6).fill(0xf5d6a1).stroke({ width: OUTLINE, color: INK });
  plant(g, 10, 430, 1.1);
  plant(g, 395, 430, 0.95, 0x6c5ce7);
}

function drawMirror(g: Graphics): void {
  g.rect(WALL.x, WALL.y, WALL.w, WALL.h).fill(0xffb4d2);
  // Wallpaper stripes.
  for (let x = -600; x < 1000; x += 80) g.rect(x, WALL.y, 36, WALL.h).fill(0xffa2c8);

  // A trailing plant on top of the mirror.
  plant(g, 200, 30, 0.6, 0xffd84a);

  // Mirror.
  g.roundRect(95, 25, 210, 330, 90).fill(0xd9f6ff).stroke({ width: 6, color: INK });
  g.roundRect(95, 25, 210, 330, 90).stroke({ width: 3, color: 0xffd84a, alignment: 1 });
  g.poly([130, 120, 160, 120, 130, 220, 110, 220]).fill({ color: 0xffffff, alpha: 0.7 });
  g.poly([170, 120, 182, 120, 152, 220, 140, 220]).fill({ color: 0xffffff, alpha: 0.7 });

  // Left shelves: products, colour bowl, comb, clips and a round brush.
  shelfBoard(g, 2, 175, 92);
  bottle(g, 18, 175, 0xff4d6d, 1.1);
  bottle(g, 40, 175, 0x4cc9f0);
  bottle(g, 60, 175, 0xffd84a, 0.8);
  sprayBottle(g, 80, 175);

  shelfBoard(g, 2, 275, 92);
  colourBowl(g, 34, 275);
  comb(g, 62, 275, 30);

  shelfBoard(g, 2, 375, 92);
  clips(g, 22, 375);
  roundBrush(g, 68, 375);

  // Right shelves: hairdryer, tool cup, clippers and a small plant.
  shelfBoard(g, 306, 195, 92);
  hairdryer(g, 346, 195);

  shelfBoard(g, 306, 295, 92);
  toolCup(g, 326, 295);
  clippers(g, 358, 295);
  plant(g, 384, 295, 0.5, 0xff6fb1);

  // A bigger floor plant in the corner, behind the character.
  plant(g, 372, 500, 1.2, 0x2d98da);
}

/** The little picture on a bottle's label, centred at (x, y): a mint leaf, an orange segment, a pineapple or a heart. */
function bottleLabel(g: Graphics, product: Product, x: number, y: number): void {
  g.roundRect(x - 11, y - 14, 22, 28, 5).fill({ color: 0xffffff, alpha: 0.9 }).stroke({ width: 1.5, color: INK });
  if (product === 'mint') {
    // A leaf pointing up and right, with its vein.
    g.moveTo(x - 6, y + 8)
      .bezierCurveTo(x - 9, y - 4, x - 1, y - 10, x + 7, y - 9)
      .bezierCurveTo(x + 9, y - 1, x + 3, y + 8, x - 6, y + 8)
      .fill(0x2fbf71)
      .stroke({ width: 1.4, color: INK, join: 'round' });
    g.moveTo(x - 6, y + 8).lineTo(x + 4, y - 5).stroke({ width: 1.4, color: 0xd9ffe9, cap: 'round' });
  } else if (product === 'citrus') {
    // An orange segment: a half disc with its flat edge up, rind outside, spokes inside.
    const cy = y - 4;
    g.moveTo(x + 8, cy).arc(x, cy, 8, 0, Math.PI).closePath().fill(0xff9d1c).stroke({ width: 1.4, color: INK, join: 'round' });
    g.moveTo(x + 5.5, cy).arc(x, cy, 5.5, 0, Math.PI).closePath().fill(0xffc95e);
    for (const k of [1, 2, 3]) {
      const a = (k * Math.PI) / 4;
      g.moveTo(x, cy + 1).lineTo(x + Math.cos(a) * 5.5, cy + Math.sin(a) * 5.5).stroke({ width: 1, color: 0xffffff, cap: 'round' });
    }
  } else if (product === 'tropical') {
    // A pineapple: a yellow body with a criss-cross, and a spiky green crown.
    for (const dx of [-4, 0, 4]) {
      g.poly([x + dx - 3, y - 3, x + dx, y - 12, x + dx + 3, y - 3]).fill(0x2fbf71).stroke({ width: 1.2, color: INK, join: 'round' });
    }
    g.ellipse(x, y + 4, 7, 9).fill(0xffd23f).stroke({ width: 1.4, color: INK });
    g.moveTo(x - 4, y - 1).lineTo(x + 4, y + 9).moveTo(x + 4, y - 1).lineTo(x - 4, y + 9).stroke({ width: 1, color: 0xb9791a, cap: 'round' });
  } else {
    // The conditioner keeps its heart, so it reads as the creamy one.
    g.circle(x - 4, y - 3, 4.2).circle(x + 4, y - 3, 4.2).fill(0xff6fb1);
    g.poly([x - 8, y - 1, x + 8, y - 1, x, y + 9]).fill(0xff6fb1);
  }
}

export function drawBackdrop(g: Graphics, scene: 'sink' | 'mirror'): void {
  g.clear();
  if (scene === 'sink') drawSink(g);
  else drawMirror(g);
}
