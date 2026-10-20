import type { Graphics } from 'pixi.js';
import type { Length, SalonState, View } from '../state';
import { INK, OUTLINE, celEllipse, hexToNumber, shade } from './style';

/**
 * Stage 0 placeholder character. It is drawn procedurally and reacts to the view and hair colour,
 * but the strand-based four-view hair model arrives in Stage 1.
 */

const CX = 200;
const GOWN = 0x14101e;

/** Where the hair ends vertically for each length (design space, y grows downward). */
export const HAIR_END: Record<Length, number> = {
  back: 450,
  shoulders: 405,
  bob: 335,
  short1: 295,
  short2: 262,
  short3: 238,
};

/** Face direction: -1 faces screen left, +1 faces screen right, 0 is front or back. */
function faceDir(view: View): -1 | 0 | 1 {
  if (view === 'left') return -1;
  if (view === 'right') return 1;
  return 0;
}

function drawGown(g: Graphics): void {
  const gown = (y0: number) => {
    g.moveTo(10, 520)
      .bezierCurveTo(14, 450, 70, y0 + 10, 150, y0)
      .lineTo(250, y0)
      .bezierCurveTo(330, y0 + 10, 386, 450, 390, 520)
      .closePath();
  };
  gown(398);
  g.fill(GOWN).stroke({ width: OUTLINE, color: INK });
  // Cel-shade fold highlights in a lighter purple-black.
  g.moveTo(70, 520).bezierCurveTo(80, 470, 110, 440, 140, 424).stroke({ width: 5, color: 0x3a2f55 });
  g.moveTo(330, 520).bezierCurveTo(320, 470, 290, 440, 262, 424).stroke({ width: 5, color: 0x2a2240 });
  // Collar.
  g.moveTo(150, 398).lineTo(200, 440).lineTo(250, 398).stroke({ width: 6, color: 0x3a2f55 });
}

function drawNeck(g: Graphics, skin: number): void {
  g.roundRect(CX - 26, 340, 52, 70, 14).fill(shade(skin, 0.82)).stroke({ width: OUTLINE, color: INK });
  g.roundRect(CX - 26, 340, 36, 58, 12).fill(skin);
}

function drawHead(g: Graphics, skin: number, view: View): void {
  const dir = faceDir(view);
  const rx = dir === 0 ? 78 : 72;
  celEllipse(g, CX, 262, rx, 88, skin, { inset: 9 });
}

function drawFace(g: Graphics, state: SalonState, view: View): void {
  const dir = faceDir(view);
  const { skin, eyes } = state.character;
  if (view === 'back') {
    // Just an ear on each side peeking out.
    for (const side of [-1, 1]) {
      celEllipse(g, CX + side * 78, 272, 11, 18, skin, { inset: 4 });
    }
    return;
  }

  const eye = (ex: number, ey: number) => {
    g.ellipse(ex, ey, 13, 16).fill(0xffffff).stroke({ width: 3, color: INK });
    g.circle(ex + dir * 3, ey + 2, 9).fill(eyes);
    g.circle(ex + dir * 3, ey + 2, 4.5).fill(INK);
    g.circle(ex + dir * 3 - 3, ey - 3, 3).fill(0xffffff);
  };

  if (dir === 0) {
    eye(CX - 30, 268);
    eye(CX + 30, 268);
    // Brows.
    g.moveTo(CX - 46, 249).quadraticCurveTo(CX - 30, 239, CX - 16, 249).stroke({ width: 4, color: shade(hexToNumber(state.hair.colour.a), 0.6) });
    g.moveTo(CX + 16, 249).quadraticCurveTo(CX + 30, 239, CX + 46, 249).stroke({ width: 4, color: shade(hexToNumber(state.hair.colour.a), 0.6) });
    // Cheeks, nose, smile.
    g.ellipse(CX - 50, 298, 11, 7).fill({ color: 0xff7aa8, alpha: 0.55 });
    g.ellipse(CX + 50, 298, 11, 7).fill({ color: 0xff7aa8, alpha: 0.55 });
    g.moveTo(CX - 4, 288).quadraticCurveTo(CX, 294, CX + 4, 288).stroke({ width: 3, color: shade(skin, 0.6) });
    g.moveTo(CX - 20, 308).quadraticCurveTo(CX, 328, CX + 20, 308).stroke({ width: 4, color: INK });
    // Ears.
    for (const side of [-1, 1]) {
      celEllipse(g, CX + side * 80, 272, 11, 18, skin, { inset: 4 });
    }
  } else {
    // Profile: one eye, nose bump on the silhouette edge, one ear towards the back of the head.
    eye(CX + dir * 38, 268);
    g.moveTo(CX + dir * 38, 249).quadraticCurveTo(CX + dir * 52, 241, CX + dir * 62, 250).stroke({ width: 4, color: shade(hexToNumber(state.hair.colour.a), 0.6) });
    g.circle(CX + dir * 72, 290, 8).fill(skin).stroke({ width: 3, color: INK });
    g.ellipse(CX + dir * 46, 298, 10, 7).fill({ color: 0xff7aa8, alpha: 0.55 });
    g.moveTo(CX + dir * 40, 312).quadraticCurveTo(CX + dir * 54, 326, CX + dir * 62, 310).stroke({ width: 4, color: INK });
    celEllipse(g, CX - dir * 12, 274, 12, 19, skin, { inset: 4 });
  }
}

/** Placeholder hair: a back mass that falls to the chosen length, plus a cap and fringe. */
function drawHair(g: Graphics, state: SalonState, view: View, layer: 'behind' | 'front'): void {
  const dir = faceDir(view);
  const base = hexToNumber(state.hair.colour.a);
  const end = HAIR_END[state.hair.length.back];
  const mass = (cx: number, rx: number) => {
    // A rounded mass reaching down to `end`.
    const top = 170;
    const height = Math.max(40, end - top);
    g.roundRect(cx - rx, top, rx * 2, height, Math.min(rx, 60)).fill(shade(base, 0.82)).stroke({ width: OUTLINE, color: INK });
    g.roundRect(cx - rx + 6, top + 4, rx * 2 - 22, height - 8, Math.min(rx - 6, 54)).fill(base);
  };

  if (view === 'back') {
    if (layer === 'front') {
      mass(CX, 92);
      celEllipse(g, CX, 215, 88, 62, base, { inset: 8 });
    }
    return;
  }

  if (layer === 'behind') {
    // In profile the hair mass sits towards the back of the head, away from the face.
    mass(CX - dir * 20, dir === 0 ? 92 : 78);
    return;
  }

  // Cap and fringe over the forehead.
  const capX = CX + (dir === 0 ? 0 : -dir * 14);
  // The cap stops above the eyes (eye tops are at y ~252) so the face stays visible.
  celEllipse(g, capX, 194, dir === 0 ? 86 : 80, 54, base, { inset: 8 });
  if (dir === 0) {
    g.moveTo(CX - 82, 226)
      .quadraticCurveTo(CX - 60, 244, CX - 36, 222)
      .quadraticCurveTo(CX - 10, 246, CX + 14, 220)
      .quadraticCurveTo(CX + 40, 244, CX + 64, 222)
      .quadraticCurveTo(CX + 78, 236, CX + 82, 226)
      .lineTo(CX + 82, 190)
      .lineTo(CX - 82, 190)
      .closePath()
      .fill(base);
  } else {
    g.moveTo(CX + dir * 30, 224)
      .quadraticCurveTo(CX + dir * 52, 242, CX + dir * 66, 220)
      .lineTo(CX + dir * 66, 190)
      .lineTo(CX + dir * 10, 190)
      .closePath()
      .fill(base);
  }
}

export function drawCharacter(g: Graphics, state: SalonState): void {
  g.clear();
  const { skin } = state.character;
  const { view } = state;

  if (view === 'back') {
    drawGown(g);
    drawNeck(g, skin);
    drawHead(g, skin, view);
    drawFace(g, state, view);
    drawHair(g, state, view, 'front');
    return;
  }

  // Hair falls over the gown, but the neck and head sit on top of it.
  drawGown(g);
  drawHair(g, state, view, 'behind');
  drawNeck(g, skin);
  drawHead(g, skin, view);
  drawFace(g, state, view);
  drawHair(g, state, view, 'front');
}
