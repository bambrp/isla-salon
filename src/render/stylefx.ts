import type { Graphics } from 'pixi.js';
import { HEAD } from './geometry';
import { INK } from './style';

/** Little stars (for curling) and puffs of mist (for product) that play when the style changes. Pure drawing. */
export interface Spark {
  kind: 'star' | 'mist';
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  size: number;
  colour: number;
}

export const SPARK_LIFE = 0.95;

const STAR_COLOURS = [0xffd84a, 0xff6fb1, 0xffffff, 0x5ec8ff];

/** A ring of stars bursting out from round the head: Isla's hair has just been curled. */
export function starBurst(random: () => number = Math.random): Spark[] {
  const out: Spark[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + random() * 0.3;
    const speed = 70 + random() * 70;
    out.push({
      kind: 'star',
      x: HEAD.cx + Math.cos(a) * 95,
      y: HEAD.cy - 10 + Math.sin(a) * 105,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed - 20,
      rot: random() * Math.PI,
      size: 5 + random() * 5,
      colour: STAR_COLOURS[i % STAR_COLOURS.length],
    });
  }
  return out;
}

/** A spray of mist coming in from the upper right and settling over the hair. */
/** A small fountain of stars at the wand's tip, drifting up and out as the hair grows. */
export function wandSparks(x: number, y: number, random: () => number = Math.random): Spark[] {
  const out: Spark[] = [];
  for (let i = 0; i < 12; i++) {
    const a = -Math.PI / 2 + (random() - 0.5) * 2.6;
    const speed = 30 + random() * 55;
    out.push({
      kind: 'star',
      x: x + (random() - 0.5) * 24,
      y: y + (random() - 0.5) * 24,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      rot: random() * Math.PI,
      size: 3.5 + random() * 3.5,
      colour: STAR_COLOURS[i % STAR_COLOURS.length],
    });
  }
  return out;
}

export function mistSpray(colour: number, random: () => number = Math.random): Spark[] {
  const out: Spark[] = [];
  for (let i = 0; i < 26; i++) {
    const sx = HEAD.cx + 150 + random() * 20;
    const sy = HEAD.cy - 120 + random() * 20;
    const tx = HEAD.cx + (random() - 0.5) * 110;
    const ty = HEAD.cy - 70 + random() * 90;
    const flight = 0.45;
    out.push({
      kind: 'mist',
      x: sx,
      y: sy,
      vx: (tx - sx) / flight,
      vy: (ty - sy) / flight,
      rot: 0,
      size: 4 + random() * 6,
      colour,
    });
  }
  return out;
}

export function drawSparks(g: Graphics, sparks: readonly Spark[], t: number): void {
  if (t >= SPARK_LIFE) return;
  const fade = t < SPARK_LIFE - 0.3 ? 1 : Math.max(0, (SPARK_LIFE - t) / 0.3);
  for (const s of sparks) {
    if (s.kind === 'mist') {
      // Mist flies in, then hangs and thins out where it lands.
      const tt = Math.min(t, 0.45);
      const r = s.size * (1 + 1.4 * Math.min(1, t / SPARK_LIFE));
      g.circle(s.x + s.vx * tt, s.y + s.vy * tt, r).fill({ color: s.colour, alpha: 0.55 * fade });
    } else {
      const x = s.x + s.vx * t * (1 - 0.4 * t);
      const y = s.y + s.vy * t * (1 - 0.4 * t) + 40 * t * t;
      const r = s.size * (1 - 0.35 * (t / SPARK_LIFE));
      const pts: number[] = [];
      for (let k = 0; k < 8; k++) {
        const a = s.rot + t * 3 + (k * Math.PI) / 4;
        const rr = k % 2 ? r * 0.4 : r;
        pts.push(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      g.poly(pts).fill({ color: s.colour, alpha: fade }).stroke({ width: 1.2, color: INK, alpha: fade, join: 'round' });
    }
  }
}
