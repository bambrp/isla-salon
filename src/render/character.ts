import type { Graphics } from 'pixi.js';
import type { SalonState } from '../state';
import {
  DEG,
  HEAD,
  clamp,
  facing,
  project,
  silhouetteHalfWidth,
  surface,
  torsoScale,
} from './geometry';
import { drawLocks, sheenRuns, splitLocks, type Lock } from './hair';
import { INK, OUTLINE, PALETTE, SHADOW_FACTOR, celEllipse, hexToNumber, shade } from './style';

/** Gown opening sits here (relative to the head centre) and the collar dips at the front, rises at the back. */
const COLLAR_Y = 398 - HEAD.cy;

interface Pt {
  x: number;
  y: number;
}

/** Stroke only the runs of points that are visible, so lines that wrap round the head never show on the far side. */
function strokeRuns(
  g: Graphics,
  points: Array<Pt & { visible: boolean }>,
  style: { width: number; color: number; alpha?: number },
): void {
  let run: Pt[] = [];
  const flush = () => {
    if (run.length > 1) {
      g.moveTo(run[0].x, run[0].y);
      for (let i = 1; i < run.length; i++) g.lineTo(run[i].x, run[i].y);
      g.stroke({ ...style, cap: 'round', join: 'round' });
    }
    run = [];
  };
  for (const p of points) {
    if (p.visible) run.push(p);
    else flush();
  }
  flush();
}

// ---------------------------------------------------------------------------------------------------
// Body
// ---------------------------------------------------------------------------------------------------

function drawGown(g: Graphics, phi: number): void {
  // The torso is wide front-on and narrow side-on; scale the front outline about the centre line.
  const k = torsoScale(phi);
  const X = (x: number) => HEAD.cx + (x - HEAD.cx) * k;
  const y0 = 398;
  g.moveTo(X(10), 520)
    .bezierCurveTo(X(14), 450, X(70), y0 + 10, X(150), y0)
    .lineTo(X(250), y0)
    .bezierCurveTo(X(330), y0 + 10, X(386), 450, X(390), 520)
    .closePath();
  g.fill(PALETTE.gown).stroke({ width: OUTLINE, color: INK });

  // Fold highlights: one lit (left), one in deeper shadow (right).
  g.moveTo(X(70), 520).bezierCurveTo(X(80), 470, X(110), 440, X(140), 424).stroke({
    width: 5,
    color: PALETTE.gownFold,
    cap: 'round',
  });
  g.moveTo(X(330), 520).bezierCurveTo(X(320), 470, X(290), 440, X(262), 424).stroke({
    width: 5,
    color: PALETTE.gownFoldDark,
    cap: 'round',
  });
}

/** The collar rim round the neck: dips in a V at the front, stands up a little at the back. */
function collarPoints(phi: number): Array<Pt & { visible: boolean }> {
  const pts: Array<Pt & { visible: boolean }> = [];
  const steps = 40;
  for (let k = 0; k <= steps; k++) {
    const theta = (k / steps) * 2 * Math.PI;
    const front = Math.cos(theta) > 0;
    const dip = front ? 40 * (1 - Math.abs(Math.sin(theta))) : -4 * -Math.cos(theta);
    const p = project(38 * Math.sin(theta), COLLAR_Y + dip, 34 * Math.cos(theta), phi);
    pts.push({ x: p.sx, y: p.sy, visible: p.d >= -2 });
  }
  return pts;
}

function drawCollar(g: Graphics, phi: number): void {
  strokeRuns(g, collarPoints(phi), { width: 7, color: PALETTE.gownFold });
}

function drawSnap(g: Graphics, phi: number): void {
  // A snap fastener at the back of the collar, visible only from behind.
  const p = project(0, COLLAR_Y - 6, -34, phi);
  if (p.d < 6) return;
  g.circle(p.sx, p.sy, 4.5).fill(PALETTE.steel).stroke({ width: 2, color: INK });
}

function drawNeck(g: Graphics, skin: number, phi: number): void {
  // The neck sits a little behind the head's centre, so in profile it slides towards the back of the head.
  const cx = HEAD.cx + 10 * Math.sin(phi);
  g.roundRect(cx - 26, 340, 52, 66, 14)
    .fill(shade(skin, SHADOW_FACTOR + 0.04))
    .stroke({ width: OUTLINE, color: INK });
  g.roundRect(cx - 26, 340, 36, 54, 12).fill(skin);
}

// ---------------------------------------------------------------------------------------------------
// Head and face
// ---------------------------------------------------------------------------------------------------

function drawEars(g: Graphics, skin: number, phi: number, nearSide: boolean): void {
  for (const side of [-1, 1]) {
    // Outward-facing normal is +/-x, so the ear faces the viewer when side * sin(phi) is positive.
    const near = side * Math.sin(phi) > -0.05;
    if (near !== nearSide) continue;
    const p = project(side * (HEAD.rx + 2), 10, -4, phi);
    const w = 11 * Math.max(Math.abs(Math.sin(phi)), 0.5);
    celEllipse(g, p.sx, p.sy, w, 18, skin, { inset: Math.min(4, w - 1), dx: -w * 0.25 });
  }
}

function drawHead(g: Graphics, skin: number, phi: number): void {
  const hw = silhouetteHalfWidth(HEAD.rx, HEAD.rz, phi);
  celEllipse(g, HEAD.cx, HEAD.cy, hw, HEAD.ry, skin, { inset: 9 });
}

function drawEye(g: Graphics, az: number, phi: number, iris: number): void {
  const p = surface(az, 6, 0.5);
  const vis = facing(p, phi);
  if (vis < 0.12) return;
  const kx = Math.pow(vis, 0.7);
  const { sx, sy } = project(p.x, p.y, p.z, phi);
  const w = 13 * kx;
  g.ellipse(sx, sy, w, 16).fill(0xffffff).stroke({ width: 3, color: INK });
  // The gaze runs straight ahead, which in screen space is towards the way the face points.
  const gaze = -Math.sin(phi) * w * 0.35;
  g.ellipse(sx + gaze, sy + 2, 9 * kx, 9).fill(iris);
  g.ellipse(sx + gaze, sy + 2, 4.5 * kx, 4.5).fill(INK);
  g.ellipse(sx + gaze - 3 * kx, sy - 3, 3 * kx, 3).fill(0xffffff);
}

function drawBrow(g: Graphics, side: number, phi: number, colour: number): void {
  const pts: Array<Pt & { visible: boolean }> = [];
  const steps = 8;
  for (let k = 0; k <= steps; k++) {
    const t = k / steps;
    const az = side * (12 + 24 * t) * DEG;
    const y = -13 - 5 * Math.sin(Math.PI * t);
    const s = surface(az, y, 0.5);
    const { sx, sy } = project(s.x, s.y, s.z, phi);
    pts.push({ x: sx, y: sy, visible: facing(s, phi) > 0.12 });
  }
  strokeRuns(g, pts, { width: 4, color: colour });
}

function drawMouth(g: Graphics, phi: number): void {
  const pts: Array<Pt & { visible: boolean }> = [];
  const steps = 10;
  for (let k = 0; k <= steps; k++) {
    const t = (k / steps) * 2 - 1;
    const s = surface(t * 18 * DEG, 56 - 10 * t * t, 0.5);
    const { sx, sy } = project(s.x, s.y, s.z, phi);
    pts.push({ x: sx, y: sy, visible: facing(s, phi) > 0.1 });
  }
  strokeRuns(g, pts, { width: 4, color: INK });
}

function drawCheeks(g: Graphics, phi: number): void {
  for (const side of [-1, 1]) {
    const s = surface(side * 40 * DEG, 34, 0.5);
    const vis = facing(s, phi);
    if (vis < 0.15) continue;
    const { sx, sy } = project(s.x, s.y, s.z, phi);
    g.ellipse(sx, sy, 11 * Math.pow(vis, 0.7), 7).fill({ color: PALETTE.blush, alpha: 0.55 });
  }
}

function drawNose(g: Graphics, skin: number, phi: number): void {
  const nose = project(0, 26, HEAD.rz + 4, phi);
  if (nose.d <= 0) return;
  const side = clamp(Math.abs(Math.sin(phi)) * 1.8, 0, 1);
  const front = Math.max(0, Math.cos(phi));
  // In profile the nose is a bump poking out of the silhouette; face-on it is just a small curved mark.
  if (side > 0.05) {
    g.circle(nose.sx, nose.sy, 6.5).fill(skin).stroke({ width: 3, color: INK, alpha: side });
    g.circle(nose.sx - Math.sign(Math.sin(phi)) * 1.5, nose.sy - 1.5, 3).fill(shade(skin, 1.03));
  }
  if (front > 0.2) {
    const a = front * front;
    g.moveTo(nose.sx - 4, nose.sy - 1)
      .quadraticCurveTo(nose.sx, nose.sy + 6, nose.sx + 4, nose.sy - 1)
      .stroke({ width: 3, color: shade(skin, 0.6), alpha: a, cap: 'round' });
  }
}

function drawFace(g: Graphics, state: SalonState, phi: number): void {
  const { skin, eyes } = state.character;
  const brow = shade(hexToNumber(state.hair.colour.a), 0.6);
  drawCheeks(g, phi);
  for (const side of [-1, 1]) {
    drawEye(g, side * 23 * DEG, phi, eyes);
    drawBrow(g, side, phi, brow);
  }
  drawNose(g, skin, phi);
  drawMouth(g, phi);
}

// ---------------------------------------------------------------------------------------------------
// Whole character
// ---------------------------------------------------------------------------------------------------

function hairColour(state: SalonState): (lock: Lock) => number {
  // Stage 2 will grow this into split and ombre colouring; for now every lock is the single colour.
  const base = hexToNumber(state.hair.colour.a);
  return () => base;
}

/**
 * Draw Isla at view angle phi (radians; 0 front, pi/2 left, pi back, 3pi/2 right; any value in between is a
 * frame of the swing). Order matters: far-side hair, gown and neck, head and face, near-side hair, highlight.
 */
export function drawCharacter(g: Graphics, state: SalonState, phi: number, locks: Lock[]): void {
  g.clear();
  const { skin } = state.character;
  const colour = hairColour(state);
  const { behind, front } = splitLocks(locks, phi);

  drawLocks(g, behind, colour);

  drawGown(g, phi);
  // From the front the V collar sits under the chin and the neck overlaps it; from the back the collar wraps in front.
  const collarFirst = Math.cos(phi) > 0.3;
  if (collarFirst) drawCollar(g, phi);
  drawNeck(g, skin, phi);
  if (!collarFirst) {
    drawCollar(g, phi);
    drawSnap(g, phi);
  }

  drawEars(g, skin, phi, false);
  drawHead(g, skin, phi);
  drawEars(g, skin, phi, true);
  drawFace(g, state, phi);

  drawLocks(g, front, colour);

  // Highlight band, only where hair actually covers.
  const base = colour(locks[0]);
  for (const run of sheenRuns(locks, phi)) {
    g.moveTo(run[0].x, run[0].y);
    for (let i = 1; i < run.length; i++) g.lineTo(run[i].x, run[i].y);
    g.stroke({ width: 7, color: shade(base, 1.22), alpha: 0.85, cap: 'round', join: 'round' });
  }
}
