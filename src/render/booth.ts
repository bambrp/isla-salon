import type { Graphics } from 'pixi.js';
import { mulberry32 } from './geometry';
import { INK, OUTLINE, shade } from './style';

/**
 * The photo booth's backgrounds, drawn in code in the same cel-shaded style as the salon: flat colours, thick ink outlines.
 * Design space is 400 x 500 with the character's head centred at (200, 262) and the gown from y 398 down; everything is drawn
 * oversized sideways and up and down so any screen shape is covered. Arcs are always point lists (never moveTo then arc),
 * and no outline repeats a point, because phone graphics chips draw broken vertices as stray lines.
 */

export type BoothBackground = 'salon' | 'beach' | 'city' | 'forest' | 'clouds' | 'brick' | 'transparent';
export const BOOTH_BACKGROUNDS: readonly BoothBackground[] = ['salon', 'beach', 'city', 'forest', 'clouds', 'brick', 'transparent'];
export const BOOTH_LABELS: Record<BoothBackground, string> = { salon: 'Salon', beach: 'Beach', city: 'City', forest: 'Forest', clouds: 'Clouds', brick: 'Brick', transparent: 'Clear' };

const X0 = -600;
const X1 = 1000;
const Y0 = -600;
const Y1 = 1200;

/** Horizontal bands of colour from top to bottom: each stop is [colour, y where the band ends]; the last runs on to the bottom. */
function bands(g: Graphics, stops: Array<[number, number]>): void {
  let y = Y0;
  for (const [colour, end] of stops) {
    g.rect(X0, y, X1 - X0, end - y + 1).fill(colour);
    y = end;
  }
}

/** A puffy cloud of overlapping circles with one clean outline round the whole thing (outlines first, then the white on top). */
function cloud(g: Graphics, x: number, y: number, s: number, colour = 0xffffff): void {
  const puffs: Array<[number, number, number]> = [
    [-34, 8, 17],
    [-14, -6, 23],
    [14, -10, 26],
    [38, 2, 19],
    [52, 12, 12],
    [0, 12, 20],
    [-50, 14, 11],
  ];
  for (const [px, py, r] of puffs) g.circle(x + px * s, y + py * s, r * s + OUTLINE * 0.75).fill(INK);
  g.rect(x - 62 * s - OUTLINE, y + 20 * s, 130 * s + OUTLINE * 2, OUTLINE * 1.5).fill(INK);
  for (const [px, py, r] of puffs) g.circle(x + px * s, y + py * s, r * s).fill(colour);
  g.rect(x - 62 * s, y + 20 * s - OUTLINE * 0.1, 130 * s, OUTLINE * 0.6).fill(colour);
  // A soft shadow under the puffs.
  g.ellipse(x + 4 * s, y + 18 * s, 42 * s, 5 * s).fill({ color: shade(colour, 0.9), alpha: 0.6 });
}

/** The points of an arc of a circle, from angle a0 to a1 (radians, 0 = right, positive = down), as flat x,y pairs. */
function arcPoints(cx: number, cy: number, r: number, a0: number, a1: number, steps: number): number[] {
  const out: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    out.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  return out;
}

/** A pine-style tree of stacked triangles on a trunk, with its base at (x, baseY). */
function pine(g: Graphics, x: number, baseY: number, h: number, colour: number, trunk = 0x8a5a2b): void {
  const w = h * 0.42;
  g.rect(x - h * 0.05, baseY - h * 0.2, h * 0.1, h * 0.2).fill(trunk).stroke({ width: 3, color: INK });
  for (let tier = 0; tier < 3; tier++) {
    const top = baseY - h + tier * h * 0.22;
    const bottom = baseY - h * 0.18 - (2 - tier) * h * 0.2;
    const half = w * (0.5 + tier * 0.25);
    g.poly([x, top, x + half, bottom, x - half, bottom]).fill(shade(colour, 1 - tier * 0.05)).stroke({ width: 3, color: INK, join: 'round' });
  }
}

// ---------------------------------------------------------------------------------------------------
// Beach
// ---------------------------------------------------------------------------------------------------

function drawBeach(g: Graphics): void {
  const horizon = 262;
  bands(g, [
    [0x62c9ff, 20],
    [0x7fd6ff, 90],
    [0x9de2ff, 160],
    [0xbdeeff, 215],
    [0xdcf7ff, horizon],
  ]);

  // The sun, with rays.
  const sx = 330;
  const sy = 82;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const b = 0.13;
    g.poly([
      sx + Math.cos(a - b) * 48, sy + Math.sin(a - b) * 48,
      sx + Math.cos(a) * 70, sy + Math.sin(a) * 70,
      sx + Math.cos(a + b) * 48, sy + Math.sin(a + b) * 48,
    ]).fill(0xffd23f).stroke({ width: 3, color: INK, join: 'round' });
  }
  g.circle(sx, sy, 40).fill(0xffe45e).stroke({ width: OUTLINE, color: INK });
  g.circle(sx - 12, sy - 12, 10).fill({ color: 0xffffff, alpha: 0.55 });

  cloud(g, 70, 70, 0.8);
  cloud(g, 215, 150, 0.55);
  cloud(g, -120, 160, 0.9);

  // The sea, in bands that get deeper towards the viewer, with white wave marks.
  g.rect(X0, horizon, X1 - X0, 140).fill(0x3fc1ec);
  g.rect(X0, horizon, X1 - X0, 30).fill(0x66d3f5);
  g.rect(X0, horizon + 60, X1 - X0, 34).fill(0x2fb0e0);
  g.moveTo(X0, horizon).lineTo(X1, horizon).stroke({ width: OUTLINE, color: INK });
  const rand = mulberry32(21);
  for (let i = 0; i < 34; i++) {
    const wx = -200 + rand() * 800;
    const wy = horizon + 14 + rand() * 118;
    const len = 22 + rand() * 26;
    const pts: number[] = [];
    for (let k = 0; k <= 6; k++) pts.push(wx + (k / 6) * len, wy + Math.sin((k / 6) * Math.PI * 2) * 3);
    g.poly(pts, false).stroke({ width: 3, color: 0xffffff, alpha: 0.85, cap: 'round', join: 'round' });
  }

  // The sand, with a foamy edge and speckles.
  const edge: number[] = [];
  for (let x = X0; x <= X1; x += 20) edge.push(x, 384 + Math.sin(x * 0.045) * 6);
  g.poly([...edge, X1, Y1, X0, Y1]).fill(0xf8de92).stroke({ width: OUTLINE, color: INK, join: 'round' });
  const foam: number[] = [];
  for (let x = X0; x <= X1; x += 20) foam.push(x, 376 + Math.sin(x * 0.045) * 6);
  g.poly(foam, false).stroke({ width: 5, color: 0xffffff, cap: 'round', join: 'round' });
  for (let i = 0; i < 70; i++) g.circle(-200 + rand() * 800, 395 + rand() * 120, 1.6).fill({ color: 0xd9b45c, alpha: 0.9 });

  // A palm tree on the left, leaning in.
  const trunk = [34, 520, 52, 520, 72, 330, 78, 236, 62, 236, 52, 330];
  g.poly(trunk).fill(0xb97a3c).stroke({ width: OUTLINE, color: INK, join: 'round' });
  for (let i = 0; i < 6; i++) g.moveTo(50 + i * 2.4, 470 - i * 48).lineTo(64 + i * 2.4, 460 - i * 48).stroke({ width: 3, color: 0x8a5424, cap: 'round' });
  const leaves: Array<[number, number]> = [[-72, 28], [-40, -22], [8, -38], [56, -16], [78, 30], [-22, 52]];
  for (const [dx, dy] of leaves) {
    const tx = 70 + dx;
    const ty = 236 + dy;
    const mx = 70 + dx * 0.5;
    const my = 236 + dy * 0.5 - 24;
    const nx = -dy;
    const ny = dx;
    const nl = Math.hypot(nx, ny);
    const wdt = 13;
    g.poly([
      70, 236,
      mx + (nx / nl) * wdt, my + (ny / nl) * wdt,
      tx, ty,
      mx - (nx / nl) * wdt, my - (ny / nl) * wdt,
    ]).fill(0x37b34a).stroke({ width: 3, color: INK, join: 'round' });
    g.moveTo(70, 236).lineTo(tx, ty).stroke({ width: 2, color: 0x8be08f, cap: 'round' });
  }
  g.circle(64, 246, 8).fill(0x7a4a1f).stroke({ width: 3, color: INK });
  g.circle(78, 248, 8).fill(0x7a4a1f).stroke({ width: 3, color: INK });

  // A striped parasol on the right.
  g.poly([343, 396, 350, 396, 352, 262, 345, 262]).fill(0xd49a54).stroke({ width: 3, color: INK, join: 'round' });
  const cx = 348;
  const cy = 262;
  const sectors = 6;
  for (let i = 0; i < sectors; i++) {
    const a0 = Math.PI + (i / sectors) * Math.PI;
    const a1 = Math.PI + ((i + 1) / sectors) * Math.PI;
    g.poly([cx, cy + 2, ...arcPoints(cx, cy + 2, 66, a0, a1, 6)]).fill(i % 2 ? 0xffffff : 0xff4d6d);
  }
  g.poly([...arcPoints(cx, cy + 2, 66, Math.PI, Math.PI * 2, 24)]).stroke({ width: OUTLINE, color: INK, join: 'round' });
  g.moveTo(cx - 66, cy + 2).lineTo(cx + 66, cy + 2).stroke({ width: OUTLINE, color: INK, cap: 'round' });
  g.circle(cx, cy - 66, 4).fill(0xffd23f).stroke({ width: 3, color: INK });
}

// ---------------------------------------------------------------------------------------------------
// City
// ---------------------------------------------------------------------------------------------------

function drawCity(g: Graphics): void {
  bands(g, [
    [0x78c8ff, 40],
    [0x9cd9ff, 110],
    [0xc1e8ff, 180],
    [0xe3f3ff, 250],
    [0xfff0d2, 330],
  ]);
  cloud(g, 90, 80, 0.7);
  cloud(g, 300, 140, 0.55);

  const base = 420;
  const rand = mulberry32(5);
  // Far buildings: pale and plain.
  for (let x = -320; x < 720; ) {
    const w = 40 + rand() * 40;
    const h = 120 + rand() * 120;
    g.rect(x, base - h, w, h + 40).fill(0xa9c3ee).stroke({ width: 3, color: 0x7f9bd0 });
    x += w + 2;
  }
  // Near buildings with windows.
  const colours = [0xff9eb5, 0xffd166, 0x7ee0b5, 0xb69cff, 0x6ec6ff, 0xff9770];
  let i = 0;
  for (let x = -330; x < 730; i++) {
    const w = 52 + rand() * 40;
    const h = 120 + rand() * 150;
    const c = colours[i % colours.length];
    const top = base - h;
    g.rect(x, top, w, h + 60).fill(c).stroke({ width: OUTLINE, color: INK });
    g.rect(x + w * 0.62, top, w * 0.38, h + 60).fill({ color: shade(c, 0.86), alpha: 0.7 });
    if (i % 3 === 0) {
      // A rooftop water tower or aerial.
      g.moveTo(x + w / 2, top).lineTo(x + w / 2, top - 22).stroke({ width: 3, color: INK, cap: 'round' });
      g.circle(x + w / 2, top - 24, 3.5).fill(0xff4d4d).stroke({ width: 2, color: INK });
    }
    const cols = Math.max(2, Math.floor((w - 10) / 16));
    const rows = Math.floor((h - 14) / 22);
    for (let r = 0; r < rows; r++)
      for (let k = 0; k < cols; k++) {
        const lit = rand() > 0.35;
        g.roundRect(x + 8 + k * ((w - 16) / cols), top + 12 + r * 22, (w - 16) / cols - 5, 12, 2).fill(lit ? 0xfff6b8 : 0x3f5c8c);
      }
    x += w + 3;
  }
  // The pavement and road.
  g.rect(X0, 418, X1 - X0, 40).fill(0xd8d2cc).stroke({ width: OUTLINE, color: INK });
  g.rect(X0, 458, X1 - X0, Y1 - 458).fill(0x6b7385);
  for (let x = -300; x < 700; x += 70) g.rect(x, 494, 36, 6).fill(0xffe45e);
  // A street lamp on the left.
  g.rect(30, 300, 7, 126).fill(0x3d4559).stroke({ width: 3, color: INK });
  g.poly([20, 300, 47, 300, 42, 280, 25, 280]).fill(0xffe45e).stroke({ width: 3, color: INK, join: 'round' });
}

// ---------------------------------------------------------------------------------------------------
// Forest
// ---------------------------------------------------------------------------------------------------

function drawForest(g: Graphics): void {
  bands(g, [
    [0xe2f7ae, 60],
    [0xd0f09a, 150],
    [0xbde886, 260],
    [0xa9de78, 340],
  ]);
  // Sunbeams slanting in from the top left.
  for (const [x, w] of [[40, 40], [120, 28], [210, 46], [310, 26]] as Array<[number, number]>)
    g.poly([x, -20, x + w, -20, x + w + 150, 430, x + 110, 430]).fill({ color: 0xffffff, alpha: 0.16 });

  const rand = mulberry32(9);
  for (let x = -330; x < 730; x += 38 + rand() * 12) pine(g, x, 380, 120 + rand() * 90, 0x7fcf6a);
  for (let x = -320; x < 720; x += 52 + rand() * 18) pine(g, x, 418, 150 + rand() * 90, 0x3fae57);

  // The ground, with tufts of grass.
  const edge: number[] = [];
  for (let x = X0; x <= X1; x += 20) edge.push(x, 400 + Math.sin(x * 0.03) * 5);
  g.poly([...edge, X1, Y1, X0, Y1]).fill(0x6fc24b).stroke({ width: OUTLINE, color: INK, join: 'round' });
  for (let i = 0; i < 40; i++) {
    const gx = -250 + rand() * 700;
    const gy = 412 + rand() * 90;
    g.poly([gx - 5, gy, gx - 2, gy - 9, gx, gy]).fill(0x4aa23a);
    g.poly([gx, gy, gx + 2, gy - 12, gx + 5, gy]).fill(0x4aa23a);
  }

  // Wild flowers beside her.
  for (const [fx, fy, c] of [[44, 372, 0xff6fb1], [76, 384, 0xffe45e], [104, 366, 0xffffff], [310, 372, 0xffe45e], [340, 384, 0xff6fb1], [372, 366, 0xffffff]] as Array<[number, number, number]>) {
    g.moveTo(fx, fy).lineTo(fx, 402).stroke({ width: 3, color: 0x2f8f3c, cap: 'round' });
    g.circle(fx, fy, 7).fill(c).stroke({ width: 3, color: INK });
    g.circle(fx, fy, 2.6).fill(0xf29a2e);
  }

  // Big trunks at either edge, with leafy tops.
  for (const [tx, tw] of [[-40, 62], [378, 70]] as Array<[number, number]>) {
    g.rect(tx, -60, tw, 640).fill(0x946034).stroke({ width: OUTLINE, color: INK });
    g.rect(tx + tw * 0.62, -60, tw * 0.38, 640).fill({ color: 0x6f4421, alpha: 0.7 });
    for (let k = 0; k < 6; k++) g.moveTo(tx + 10 + (k % 2) * 16, 40 + k * 70).lineTo(tx + 16 + (k % 2) * 16, 70 + k * 70).stroke({ width: 3, color: 0x6f4421, cap: 'round' });
  }
  for (const [lx, ly, r] of [[-20, 20, 56], [26, 6, 48], [380, 14, 54], [336, 4, 44]] as Array<[number, number, number]>) {
    g.circle(lx, ly, r + 3).fill(INK);
  }
  for (const [lx, ly, r, c] of [[-20, 20, 56, 0x3a9c4a], [26, 6, 48, 0x4aba58], [380, 14, 54, 0x3a9c4a], [336, 4, 44, 0x4aba58]] as Array<[number, number, number, number]>) {
    g.circle(lx, ly, r).fill(c);
  }
}

// ---------------------------------------------------------------------------------------------------
// Clouds
// ---------------------------------------------------------------------------------------------------

function drawClouds(g: Graphics): void {
  bands(g, [
    [0x3f9cf5, 60],
    [0x5ab2fa, 150],
    [0x7cc4fc, 240],
    [0x9fd5fd, 330],
    [0xc3e5fe, 420],
    [0xdff2ff, Y1],
  ]);
  // A rainbow arching behind her.
  const rainbow = [0xff5d6c, 0xff9f43, 0xffe45e, 0x5bd37a, 0x4cb8ff, 0x7c6cf0];
  rainbow.forEach((c, i) => {
    const r = 200 - i * 13;
    g.poly(arcPoints(200, 430, r, Math.PI * 1.07, Math.PI * 1.93, 36), false).stroke({ width: 15, color: c });
  });
  g.poly(arcPoints(200, 430, 207, Math.PI * 1.07, Math.PI * 1.93, 36), false).stroke({ width: 3, color: INK, alpha: 0.9 });
  g.poly(arcPoints(200, 430, 200 - 5 * 13 - 8, Math.PI * 1.07, Math.PI * 1.93, 36), false).stroke({ width: 3, color: INK, alpha: 0.9 });

  // A little sun, birds and small clouds higher up.
  g.circle(335, 70, 30).fill(0xfff3a0).stroke({ width: OUTLINE, color: INK });
  g.circle(326, 61, 8).fill({ color: 0xffffff, alpha: 0.6 });
  for (const [bx, by] of [[70, 110], [108, 84], [300, 190]] as Array<[number, number]>)
    g.poly([bx - 12, by - 3, bx - 6, by - 8, bx, by, bx + 6, by - 8, bx + 12, by - 3], false).stroke({ width: 3, color: INK, cap: 'round', join: 'round' });
  cloud(g, 60, 190, 0.7);
  cloud(g, 330, 140, 0.6);
  cloud(g, 200, 50, 0.5);
  // The cloud bank she sits in.
  for (const [x, y, s] of [[-80, 410, 1.5], [60, 420, 1.3], [330, 412, 1.4], [470, 420, 1.5], [200, 450, 1.7]] as Array<[number, number, number]>) cloud(g, x, y, s);
  g.rect(X0, 446, X1 - X0, Y1 - 446).fill(0xffffff);
  cloud(g, 120, 462, 1.2);
  cloud(g, 300, 470, 1.3);
}

// ---------------------------------------------------------------------------------------------------
// Brick
// ---------------------------------------------------------------------------------------------------

function drawBrick(g: Graphics): void {
  const MORTAR = 0xe3cfae;
  const EDGE = 0x5a2a22;
  const palette = [0xc4573d, 0xb34a35, 0xd06a45, 0xa8432f, 0xcf7a52, 0xbb5238];
  g.rect(X0, Y0, X1 - X0, Y1 - Y0).fill(MORTAR);
  const rand = mulberry32(31);
  const BW = 56;
  const BH = 26;
  let row = 0;
  for (let y = -400; y < 900; y += BH, row++) {
    const offset = (row % 2) * (BW / 2);
    for (let x = -500 - offset; x < 900; x += BW) {
      const pick = rand();
      const colour = pick < 0.12 ? 0xe29b6c : pick < 0.2 ? 0x8f3a2a : palette[Math.floor(rand() * palette.length)];
      g.roundRect(x + 2, y + 2, BW - 4, BH - 4, 4).fill(colour).stroke({ width: 3, color: EDGE, join: 'round' });
      // A lit top edge on each brick, and now and then a chip.
      g.rect(x + 7, y + 6, BW - 18, 3).fill({ color: 0xffffff, alpha: 0.2 });
      if (rand() < 0.08) g.poly([x + BW - 14, y + 3, x + BW - 4, y + 3, x + BW - 4, y + 12]).fill({ color: MORTAR, alpha: 0.9 });
    }
  }
  // Faded whitewash across the top, so the wall is lightest at the top and richest at her shoulders.
  for (let i = 0; i < 5; i++) g.rect(X0, Y0 + i * 160, X1 - X0, 160).fill({ color: 0xfff3d6, alpha: 0.05 });
  g.rect(X0, 120, X1 - X0, 190).fill({ color: 0x7a2f22, alpha: 0.07 });

  // A paper poster, pasted on the left, with stripes and a sun.
  g.rect(22, 70, 84, 104).fill(0xf6e7bd).stroke({ width: OUTLINE, color: INK, join: 'round' });
  g.rect(30, 78, 68, 52).fill(0x4aa7a0).stroke({ width: 3, color: INK });
  g.circle(64, 112, 15).fill(0xffd166).stroke({ width: 3, color: INK });
  g.rect(31, 118, 66, 11).fill(0x2f7f79);
  g.rect(32, 138, 64, 6).fill(0xc4573d);
  g.rect(32, 150, 46, 5).fill(0x8f7a55);
  g.rect(32, 160, 54, 5).fill(0x8f7a55);
  g.poly([106, 70, 106, 92, 84, 70]).fill(0xd9c391).stroke({ width: 3, color: INK, join: 'round' });

  // An old enamel sign on the right, hanging from a lamp post with a gas lamp on top.
  g.rect(318, 52, 7, 150).fill(0x2b2f3a).stroke({ width: 3, color: INK });
  g.poly(roundPoints(362, 160, 40, 26, 24)).fill(0x2f5da8).stroke({ width: OUTLINE, color: INK, join: 'round' });
  g.poly(roundPoints(362, 160, 33, 19, 24)).fill(0xf6e7bd).stroke({ width: 3, color: INK, join: 'round' });
  g.circle(362, 160, 9).fill(0xc4573d).stroke({ width: 3, color: INK });
  g.poly([306, 52, 337, 52, 331, 26, 312, 26]).fill(0xffe08a).stroke({ width: 3, color: INK, join: 'round' });
  g.circle(321, 39, 34).fill({ color: 0xffe9a8, alpha: 0.28 });
  g.rect(310, 20, 22, 7).fill(0x2b2f3a).stroke({ width: 3, color: INK });

  // The pavement along the bottom.
  g.rect(X0, 440, X1 - X0, Y1 - 440).fill(0x6e6a7a).stroke({ width: OUTLINE, color: INK });
  g.rect(X0, 440, X1 - X0, 12).fill(0x8b869a);
  for (let x = -520; x < 920; x += 70) g.moveTo(x, 452).lineTo(x - 14, 520).stroke({ width: 3, color: 0x4d4a58, cap: 'round' });
  for (let x = -560; x < 960; x += 90) g.moveTo(x, 520).lineTo(x + 70, 520).stroke({ width: 3, color: 0x4d4a58, cap: 'round' });
}

/** The points of a rounded oval (a superellipse) around (cx, cy), as flat x,y pairs. */
function roundPoints(cx: number, cy: number, rx: number, ry: number, steps: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    out.push(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
  }
  return out;
}

/**
 * The Transparent background as seen on screen: a grey and white chequerboard, the usual sign of "nothing here". The photo
 * leaves it out (the scene hides it while the photo is taken), so the saved picture has no background at all.
 */
function drawChecker(g: Graphics): void {
  const SQ = 24;
  g.rect(-400, -300, 1200, 1100).fill(0xf4f1f8);
  for (let row = 0; row * SQ < 1100; row++)
    for (let col = 0; col * SQ < 1200; col++) if ((row + col) % 2 === 0) g.rect(-400 + col * SQ, -300 + row * SQ, SQ, SQ).fill(0xd3cddc);
  // Beyond the area above (never normally in view) keep to the light colour so no gap shows.
  g.rect(X0, Y0, X1 - X0, -300 - Y0).fill(0xf4f1f8);
  g.rect(X0, 800, X1 - X0, Y1 - 800).fill(0xf4f1f8);
  g.rect(X0, -300, -400 - X0, 1100).fill(0xf4f1f8);
  g.rect(800, -300, X1 - 800, 1100).fill(0xf4f1f8);
}

export function drawBoothBackground(g: Graphics, background: Exclude<BoothBackground, 'salon'>): void {
  if (background === 'beach') drawBeach(g);
  else if (background === 'city') drawCity(g);
  else if (background === 'forest') drawForest(g);
  else if (background === 'brick') drawBrick(g);
  else if (background === 'transparent') drawChecker(g);
  else drawClouds(g);
}
