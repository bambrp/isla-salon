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
import type { HairPaint } from './colour';
import { CALM, tintedSkin, type Mood } from './complexion';
import { drawLocks, sheenRuns, splitLocks, type Lock, type SheenPoint } from './hair';
import { INK, OUTLINE, PALETTE, SHADOW_FACTOR, celEllipse, shade } from './style';

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

function drawEye(g: Graphics, az: number, phi: number, iris: number, blink: number): void {
  const p = surface(az, 6, 0.5);
  const vis = facing(p, phi);
  if (vis < 0.12) return;
  const kx = Math.pow(vis, 0.7);
  const { sx, sy } = project(p.x, p.y, p.z, phi);
  const w = 13 * kx;
  if (blink >= 0.75) {
    // Eyes shut: a curved lash line where the eye was.
    g.moveTo(sx - w, sy + 1).quadraticCurveTo(sx, sy + 9, sx + w, sy + 1).stroke({ width: 3.5, color: INK, cap: 'round' });
    return;
  }
  const open = 1 - blink * 0.9;
  g.ellipse(sx, sy + 16 * (1 - open) * 0.5, w, 16 * open).fill(0xffffff).stroke({ width: 3, color: INK });
  // The gaze runs straight ahead, which in screen space is towards the way the face points.
  const gaze = -Math.sin(phi) * w * 0.35;
  const cy = sy + 2 + 16 * (1 - open) * 0.5;
  g.ellipse(sx + gaze, cy, 9 * kx, 9 * open).fill(iris);
  g.ellipse(sx + gaze, cy, 4.5 * kx, 4.5 * open).fill(INK);
  g.ellipse(sx + gaze - 3 * kx, cy - 5 * open, 3 * kx, 3 * open).fill(0xffffff);
}

function drawBrow(g: Graphics, side: number, phi: number, colour: number, annoyed: number): void {
  const pts: Array<Pt & { visible: boolean }> = [];
  const steps = 8;
  for (let k = 0; k <= steps; k++) {
    const t = k / steps;
    const az = side * (12 + 24 * t) * DEG;
    // Annoyed: the inner ends sink and the outer ends lift, so the brows slant down towards the nose.
    const y = -13 - 5 * Math.sin(Math.PI * t) + annoyed * (7 - 12 * t);
    const s = surface(az, y, 0.5);
    const { sx, sy } = project(s.x, s.y, s.z, phi);
    pts.push({ x: sx, y: sy, visible: facing(s, phi) > 0.12 });
  }
  strokeRuns(g, pts, { width: 4, color: colour });
}

/** How the mouth line sits at t (-1 to 1 across the mouth): a smile, turned over by annoyance, flattened by a clench. */
function mouthY(t: number, annoyed: number, clench: number): number {
  return 56 - 10 * t * t * (1 - 2 * annoyed) * (1 - 0.85 * clench) + 3 * annoyed;
}

/**
 * Clenched teeth for the cold. The mouth opens up (the smile flattens into a wide grimace and the lower lip drops)
 * to show a row of white teeth, with a line down each gap and one across the bite. Solid from the first moment: it
 * is the opening, not a fade, that shows it coming on. It only dims as she turns away from the viewer.
 */
function drawTeeth(g: Graphics, phi: number, annoyed: number, clench: number): void {
  const centre = surface(0, 56, 0.5);
  const vis = facing(centre, phi);
  if (vis < 0.25 || clench <= 0.01) return;
  const alpha = Math.min(1, (vis - 0.25) / 0.3);
  const half = 20 * DEG;
  const open = 14 * clench;
  const at = (f: number, drop: number): [number, number] => {
    const t = f; // -1 to 1 across the mouth
    const s = surface(t * half, mouthY(t, annoyed, clench) + drop * open * (1 - 0.35 * t * t), 0.5);
    const p = project(s.x, s.y, s.z, phi);
    return [p.sx, p.sy];
  };
  const steps = 8;
  const outline: number[] = [];
  for (let k = 0; k <= steps; k++) outline.push(...at((2 * k) / steps - 1, 0));
  for (let k = steps; k >= 0; k--) outline.push(...at((2 * k) / steps - 1, 1));
  g.poly(outline).fill({ color: 0xffffff, alpha }).stroke({ width: 3, color: INK, alpha, join: 'round' });
  const across: number[] = [];
  for (let k = 0; k <= steps; k++) across.push(...at((2 * k) / steps - 1, 0.5));
  g.poly(across, false).stroke({ width: 1.6, color: INK, alpha });
  for (const f of [-0.5, 0, 0.5]) {
    const [x0, y0] = at(f, 0);
    const [x1, y1] = at(f, 1);
    g.moveTo(x0, y0).lineTo(x1, y1).stroke({ width: 1.6, color: INK, alpha });
  }
}

function drawMouth(g: Graphics, phi: number, annoyed: number, clench: number): void {
  const pts: Array<Pt & { visible: boolean }> = [];
  const steps = 10;
  for (let k = 0; k <= steps; k++) {
    const t = (k / steps) * 2 - 1;
    // Annoyed turns the smile over into a frown.
    const s = surface(t * (18 + 2 * clench) * DEG, mouthY(t, annoyed, clench), 0.5);
    const { sx, sy } = project(s.x, s.y, s.z, phi);
    pts.push({ x: sx, y: sy, visible: facing(s, phi) > 0.1 });
  }
  strokeRuns(g, pts, { width: 4, color: INK });
}

function drawCheeks(g: Graphics, phi: number, tone: number): void {
  for (const side of [-1, 1]) {
    const s = surface(side * 40 * DEG, 34, 0.5);
    const vis = facing(s, phi);
    if (vis < 0.15) continue;
    const { sx, sy } = project(s.x, s.y, s.z, phi);
    g.ellipse(sx, sy, 11 * Math.pow(vis, 0.7), 7).fill({ color: PALETTE.blush, alpha: tone > 0 ? 0.55 + 0.4 * tone : 0.55 * (1 + 0.5 * tone) });
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

function drawFace(g: Graphics, state: SalonState, skin: number, phi: number, paint: HairPaint, blink: number, mood: Mood): void {
  const { eyes } = state.character;
  drawCheeks(g, phi, mood.tone);
  for (const side of [-1, 1] as const) {
    drawEye(g, side * 23 * DEG, phi, eyes, blink);
    // Each brow is a darker shade of the root colour on its own side of the head.
    drawBrow(g, side, phi, shade(paint.root(side), 0.6), mood.annoyed);
  }
  drawNose(g, skin, phi);
  drawTeeth(g, phi, mood.annoyed, mood.clench);
  drawMouth(g, phi, mood.annoyed, mood.clench);
}

// ---------------------------------------------------------------------------------------------------
// Whole character
// ---------------------------------------------------------------------------------------------------

/** The glossy highlight, in runs of the same colour so a split colour changes cleanly at the centre line. */
function drawSheen(g: Graphics, runs: SheenPoint[][], paint: HairPaint): void {
  const colourOf = (p: SheenPoint) => shade(paint.sheen(p.az), 1.22);
  for (const run of runs) {
    let start = 0;
    for (let i = 1; i <= run.length; i++) {
      if (i < run.length && colourOf(run[i]) === colourOf(run[start])) continue;
      // Points start..i share a colour; including point i lets neighbouring stretches meet without a gap.
      const pts = run.slice(start, Math.min(i, run.length - 1) + 1);
      if (pts.length > 1) {
        g.moveTo(pts[0].x, pts[0].y);
        for (let k = 1; k < pts.length; k++) g.lineTo(pts[k].x, pts[k].y);
        g.stroke({ width: 7, color: colourOf(run[start]), alpha: 0.85, cap: 'round', join: 'round' });
      }
      start = i;
    }
  }
}

/**
 * Draw Isla at view angle phi (radians; 0 front, pi/2 left, pi back, 3pi/2 right; any value in between is a
 * frame of the swing) with her hair painted as `paint` describes, which may be partway through a colour fade.
 * Order matters: far-side hair, gown and neck, head and face, near-side hair, highlight.
 */
export function drawCharacter(
  g: Graphics,
  state: SalonState,
  phi: number,
  locks: Lock[],
  paint: HairPaint,
  blink = 0,
  mood: Mood = CALM,
): void {
  g.clear();
  const skin = tintedSkin(state.character.skin, mood.tone);
  const bandsOf = (lock: Lock) => paint.bands(lock.a0);
  const { behind, front } = splitLocks(locks, phi);

  drawLocks(g, behind, bandsOf);

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
  drawFace(g, state, skin, phi, paint, blink, mood);

  drawLocks(g, front, bandsOf);

  // Highlight band, only where hair actually covers.
  drawSheen(g, sheenRuns(locks, phi), paint);
}
