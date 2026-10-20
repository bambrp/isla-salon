import { VIEWS, type View } from '../state';

/**
 * Shared 3D-to-2D helpers.
 *
 * Head space: origin at the head centre, +x is the character's left (screen right when she faces us),
 * +y points down, +z points out of her face. A view angle phi turns her about the vertical axis:
 * phi = 0 front, 90 deg left side (face points to screen left), 180 deg back, 270 deg right side.
 * Projection is orthographic, which suits a flat cartoon look and keeps swings cheap.
 */

export const DEG = Math.PI / 180;

/** Head ellipsoid, in design space (the scene is drawn in a 400 x 500 box). */
export const HEAD = { cx: 200, cy: 262, rx: 78, ry: 88, rz: 72 } as const;

/** Half-extents of the gowned torso (width across the shoulders, depth front to back). */
export const TORSO = { rx: 190, rz: 110 } as const;

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Deterministic random numbers so a character's hair never changes between redraws. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function viewAngle(view: View): number {
  return (VIEWS.indexOf(view) * Math.PI) / 2;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Projected {
  /** Screen x in design space. */
  sx: number;
  /** Screen y in design space. */
  sy: number;
  /** Depth towards the viewer: positive means in front of the head's centre plane. */
  d: number;
}

export function project(x: number, y: number, z: number, phi: number): Projected {
  const c = Math.cos(phi);
  const s = Math.sin(phi);
  return { sx: HEAD.cx + x * c - z * s, sy: HEAD.cy + y, d: x * s + z * c };
}

/** A point on (or lifted off) the head ellipsoid at azimuth az (0 = straight ahead) and height y. */
export function surface(az: number, y: number, lift = 0): Vec3 {
  const k = Math.sqrt(Math.max(0, 1 - (y / HEAD.ry) ** 2));
  return { x: (HEAD.rx + lift) * k * Math.sin(az), y, z: (HEAD.rz + lift) * k * Math.cos(az) };
}

/** Cosine between the head surface normal at p and the direction to the viewer. Negative means facing away. */
export function facing(p: Vec3, phi: number): number {
  const nx = p.x / HEAD.rx ** 2;
  const ny = p.y / HEAD.ry ** 2;
  const nz = p.z / HEAD.rz ** 2;
  const len = Math.hypot(nx, ny, nz) || 1;
  return (nx * Math.sin(phi) + nz * Math.cos(phi)) / len;
}

/** Horizontal half-extent of an ellipse-section of half-widths (ax, az) seen at phi. */
export function silhouetteHalfWidth(ax: number, az: number, phi: number): number {
  return Math.hypot(ax * Math.cos(phi), az * Math.sin(phi));
}

/** Torso width factor at phi relative to its front-on width. */
export function torsoScale(phi: number): number {
  return silhouetteHalfWidth(TORSO.rx, TORSO.rz, phi) / TORSO.rx;
}
