import type { Graphics } from 'pixi.js';
import { INK, OUTLINE } from './style';
import { DIAL, SHELF_PRODUCTS, SPRAYER, SPRAY_TARGET } from './sinkLayout';
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
  towelStack,
} from './props';

/** Design space is 400 x 500. The wall is drawn oversized so any screen aspect is covered. */
const WALL = { x: -600, y: -600, w: 1600, h: 1800 };

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
  shelfBoard(g, 4, 232, 92);
  shelfBoard(g, 4, 322, 92);
  for (const b of Object.values(SHELF_PRODUCTS)) bottle(g, b.x, b.baseY, b.colour, b.tall);
  // A little heart on the conditioner, so it reads as the creamy one.
  const c = SHELF_PRODUCTS.conditioner;
  g.circle(c.x - 3, c.baseY - 20, 3).circle(c.x + 3, c.baseY - 20, 3).fill(0xffffff);
  g.poly([c.x - 6, c.baseY - 18, c.x + 6, c.baseY - 18, c.x, c.baseY - 11]).fill(0xffffff);

  // Wall shelf on the right: towels and a small plant.
  shelfBoard(g, 304, 262, 92);
  towelStack(g, 334, 262);
  plant(g, 376, 262, 0.55, 0xffd84a);

  // Handheld sprayer on its hose, aimed at the crown of her head. Drawn along +x then turned to point at SPRAY_TARGET.
  const ang = Math.atan2(SPRAY_TARGET.y - SPRAYER.y, SPRAY_TARGET.x - SPRAYER.x);
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  const place = (pts: number[]): number[] => {
    const out: number[] = [];
    for (let i = 0; i < pts.length; i += 2) {
      // Local x runs along the sprayer; the nozzle face sits at local x = 0, the handle behind it at negative x.
      out.push(SPRAYER.x + pts[i] * ca - pts[i + 1] * sa, SPRAYER.y + pts[i] * sa + pts[i + 1] * ca);
    }
    return out;
  };
  g.roundRect(310, 40, 26, 12, 4).fill(0xc9d6df).stroke({ width: OUTLINE, color: INK });
  const handleEnd = place([-44, 0]);
  g.moveTo(323, 52).bezierCurveTo(352, 70, 346, 110, handleEnd[0], handleEnd[1]).stroke({ width: 11, color: INK, cap: 'round' });
  g.moveTo(323, 52).bezierCurveTo(352, 70, 346, 110, handleEnd[0], handleEnd[1]).stroke({ width: 6, color: 0x8fa3ad, cap: 'round' });
  g.poly(place([-44, -6, -14, -6, -14, 6, -44, 6])).fill(0xdfe9f0).stroke({ width: OUTLINE, color: INK, join: 'round' });
  g.poly(place([-14, -7, 0, -17, 0, 17, -14, 7])).fill(0xc9d6df).stroke({ width: OUTLINE, color: INK, join: 'round' });
  for (const o of [-9, 0, 9]) {
    const hole = place([1, o]);
    g.circle(hole[0], hole[1], 1.8).fill(INK);
  }

  // Temperature dial on the wall: a chrome ring with a blue to red scale. The washing layer draws the lever on top.
  g.circle(DIAL.x, DIAL.y, DIAL.r + 6).fill(0xdfe9f0).stroke({ width: OUTLINE, color: INK });
  for (let i = 0; i < 12; i++) {
    const t = i / 11;
    const a0 = (-125 + 250 * (i / 12) - 90) * (Math.PI / 180);
    const a1 = (-125 + 250 * ((i + 1) / 12) - 90) * (Math.PI / 180);
    const r = DIAL.r + 1;
    g.moveTo(DIAL.x + Math.cos(a0) * r, DIAL.y + Math.sin(a0) * r)
      .arc(DIAL.x, DIAL.y, r, a0, a1)
      .stroke({ width: 5, color: dialColour(t) });
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

export function drawBackdrop(g: Graphics, scene: 'sink' | 'mirror'): void {
  g.clear();
  if (scene === 'sink') drawSink(g);
  else drawMirror(g);
}
