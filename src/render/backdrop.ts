import type { Graphics } from 'pixi.js';
import { INK, OUTLINE } from './style';
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

function drawSink(g: Graphics): void {
  // Tiled wall.
  g.rect(WALL.x, WALL.y, WALL.w, WALL.h).fill(0x9fe3f5);
  for (let x = -600; x < 1000; x += 50) g.moveTo(x, WALL.y).lineTo(x, 1200).stroke({ width: 1.5, color: 0x6fc8e0 });
  for (let y = -600; y < 1200; y += 50) g.moveTo(WALL.x, y).lineTo(1000, y).stroke({ width: 1.5, color: 0x6fc8e0 });

  // Wall shelf on the left: the three shampoos (mint, citrus, tropical).
  shelfBoard(g, 4, 232, 92);
  bottle(g, 24, 232, 0x4fe3b5, 1.2);
  bottle(g, 50, 232, 0xffa62b, 1.2);
  bottle(g, 76, 232, 0xff6fb1, 1.2);

  // Wall shelf on the right: towels and a small plant.
  shelfBoard(g, 304, 262, 92);
  towelStack(g, 334, 262);
  plant(g, 376, 262, 0.55, 0xffd84a);

  // Shower hose and handheld sprayer, hanging beside the head so the stream has somewhere to come from.
  g.roundRect(310, 48, 26, 12, 4).fill(0xc9d6df).stroke({ width: OUTLINE, color: INK });
  g.moveTo(323, 60).bezierCurveTo(330, 150, 292, 90, 276, 152).stroke({ width: 11, color: INK, cap: 'round' });
  g.moveTo(323, 60).bezierCurveTo(330, 150, 292, 90, 276, 152).stroke({ width: 6, color: 0x8fa3ad, cap: 'round' });
  g.roundRect(268, 140, 16, 28, 5).fill(0xdfe9f0).stroke({ width: OUTLINE, color: INK });
  g.poly([262, 168, 290, 168, 296, 188, 256, 188]).fill(0xc9d6df).stroke({ width: OUTLINE, color: INK });
  for (let i = 0; i < 4; i++) g.circle(266 + i * 9, 180, 1.8).fill(INK);

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
