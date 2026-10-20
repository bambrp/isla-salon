import type { Graphics } from 'pixi.js';
import { INK, OUTLINE, celEllipse, shade } from './style';

/** Design space is 400 x 500. The wall is drawn oversized so any screen aspect is covered. */
const WALL = { x: -600, y: -600, w: 1600, h: 1800 };

function plant(g: Graphics, x: number, baseY: number, scale = 1, potColour = 0xff8a5b): void {
  const w = 44 * scale;
  const h = 40 * scale;
  // Leaves first so the pot overlaps their stems.
  const leaves: Array<[number, number, number, number]> = [
    [-14, -62, 13, 30],
    [14, -62, 13, 30],
    [0, -74, 12, 34],
    [-26, -48, 11, 24],
    [26, -48, 11, 24],
  ];
  for (const [lx, ly, rx, ry] of leaves) {
    celEllipse(g, x + lx * scale, baseY + ly * scale, rx * scale, ry * scale, 0x2ecc71, {
      inset: 5 * scale,
    });
  }
  g.poly([x - w / 2, baseY - h, x + w / 2, baseY - h, x + w / 2 - 6 * scale, baseY, x - w / 2 + 6 * scale, baseY])
    .fill(potColour)
    .stroke({ width: OUTLINE, color: INK });
  g.rect(x - w / 2 - 3, baseY - h - 6 * scale, w + 6, 10 * scale)
    .fill(shade(potColour, 1.1))
    .stroke({ width: OUTLINE, color: INK });
}

function bottle(g: Graphics, x: number, baseY: number, colour: number, tall = 1): void {
  const h = 34 * tall;
  g.roundRect(x - 9, baseY - h, 18, h, 5).fill(colour).stroke({ width: 3, color: INK });
  g.rect(x - 5, baseY - h - 9, 10, 9).fill(0xffffff).stroke({ width: 3, color: INK });
}

function shelf(g: Graphics, x: number, y: number, width: number): void {
  g.roundRect(x, y, width, 12, 4).fill(0xb5651d).stroke({ width: OUTLINE, color: INK });
}

function drawSink(g: Graphics): void {
  // Tiled wall.
  g.rect(WALL.x, WALL.y, WALL.w, WALL.h).fill(0x9fe3f5);
  for (let x = -600; x < 1000; x += 50) g.moveTo(x, WALL.y).lineTo(x, 1200).stroke({ width: 1.5, color: 0x6fc8e0 });
  for (let y = -600; y < 1200; y += 50) g.moveTo(WALL.x, y).lineTo(1000, y).stroke({ width: 1.5, color: 0x6fc8e0 });

  // Tap on the wall, curving over the basin.
  g.roundRect(188, 170, 24, 70, 8).fill(0xc9d6df).stroke({ width: OUTLINE, color: INK });
  g.roundRect(176, 160, 48, 22, 10).fill(0xdfe9f0).stroke({ width: OUTLINE, color: INK });

  // Basin: a wide white bowl behind the shoulders.
  g.roundRect(30, 400, 340, 140, 40).fill(0xeef6fa).stroke({ width: OUTLINE, color: INK });
  g.roundRect(46, 414, 308, 40, 20).fill(0xd2e4ec);

  // Counter and plants either side.
  g.roundRect(-600, 430, 640, 24, 6).fill(0xf5d6a1).stroke({ width: OUTLINE, color: INK });
  g.roundRect(360, 430, 640, 24, 6).fill(0xf5d6a1).stroke({ width: OUTLINE, color: INK });
  plant(g, 10, 430, 1.1);
  plant(g, 395, 430, 0.95, 0x6c5ce7);
}

function drawMirror(g: Graphics): void {
  g.rect(WALL.x, WALL.y, WALL.w, WALL.h).fill(0xffb4d2);
  // Stripes for the wallpaper.
  for (let x = -600; x < 1000; x += 80) g.rect(x, WALL.y, 36, WALL.h).fill(0xffa2c8);

  // Mirror.
  g.roundRect(95, 25, 210, 330, 90).fill(0xd9f6ff).stroke({ width: 6, color: INK });
  g.roundRect(95, 25, 210, 330, 90).stroke({ width: 3, color: 0xffd84a, alignment: 1 });
  g.poly([130, 120, 160, 120, 130, 220, 110, 220]).fill({ color: 0xffffff, alpha: 0.7 });
  g.poly([170, 120, 182, 120, 152, 220, 140, 220]).fill({ color: 0xffffff, alpha: 0.7 });

  // Shelf of tools, left.
  shelf(g, -20, 190, 110);
  bottle(g, 12, 190, 0xff4d6d, 1.1);
  bottle(g, 38, 190, 0x4cc9f0);
  bottle(g, 62, 190, 0xffd84a, 0.8);
  // Scissors, comb and brush lying on a second shelf.
  shelf(g, -20, 290, 110);
  g.roundRect(0, 270, 10, 20, 3).fill(0xc9d6df).stroke({ width: 3, color: INK });
  g.roundRect(14, 262, 10, 28, 3).fill(0xc9d6df).stroke({ width: 3, color: INK });
  g.roundRect(34, 276, 48, 14, 4).fill(0x6c5ce7).stroke({ width: 3, color: INK });
  g.circle(26, 286, 6).stroke({ width: 3, color: INK });

  // Hairdryer and plant, right.
  shelf(g, 310, 200, 110);
  g.roundRect(326, 160, 50, 26, 10).fill(0xff6fb1).stroke({ width: 3, color: INK });
  g.roundRect(364, 182, 16, 24, 4).fill(0x3a2a55).stroke({ width: 3, color: INK });
  plant(g, 360, 200, 0.75, 0xffd84a);
  // A bigger floor plant in the corner, behind the character.
  plant(g, 372, 500, 1.2, 0x2d98da);
}

export function drawBackdrop(g: Graphics, scene: 'sink' | 'mirror'): void {
  g.clear();
  if (scene === 'sink') drawSink(g);
  else drawMirror(g);
}
