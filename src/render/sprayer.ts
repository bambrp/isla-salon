import type { Graphics } from 'pixi.js';
import { INK, OUTLINE } from './style';
import { SPRAYER, SPRAY_TARGET } from './sinkLayout';

/** Where the sprayer's hose is fixed to the wall. */
export const HOLDER = { x: 323, y: 52 } as const;

export interface SprayerPose {
  /** The nozzle face. */
  x: number;
  y: number;
  /** The point on her head the water is aimed at. */
  aimX: number;
  aimY: number;
  /** Direction the nozzle points, in radians. */
  angle: number;
}

/**
 * Where the sprayer is when it is aimed at a point on her head. At rest it points at her crown. Following a finger
 * across her hair it slides along with it (it moves further sideways than up and down) and always points at the aim.
 */
export function sprayerPose(aimX: number, aimY: number): SprayerPose {
  const x = SPRAYER.x + (aimX - SPRAY_TARGET.x) * 0.7;
  const y = SPRAYER.y + (aimY - SPRAY_TARGET.y) * 0.3;
  return { x, y, aimX, aimY, angle: Math.atan2(aimY - y, aimX - x) };
}

/** Where the shower head follows a swiping finger to: only while the water is running; with the tap off it stays where it is. */
export function followTarget(waterRunning: boolean, finger: { x: number; y: number } | null): { x: number; y: number } | null {
  return waterRunning ? finger : null;
}

/** The wall bracket the hose hangs from (it never moves, so it belongs to the backdrop). */
export function drawHolder(g: Graphics): void {
  g.roundRect(HOLDER.x - 13, HOLDER.y - 12, 26, 12, 4).fill(0xc9d6df).stroke({ width: OUTLINE, color: INK });
}

/** The handheld sprayer and its hose, drawn along +x then turned to point at the aim. */
export function drawSprayer(g: Graphics, pose: SprayerPose): void {
  const ca = Math.cos(pose.angle);
  const sa = Math.sin(pose.angle);
  const place = (pts: number[]): number[] => {
    const out: number[] = [];
    for (let i = 0; i < pts.length; i += 2) {
      // Local x runs along the sprayer; the nozzle face sits at local x = 0, the handle behind it at negative x.
      out.push(pose.x + pts[i] * ca - pts[i + 1] * sa, pose.y + pts[i] * sa + pts[i + 1] * ca);
    }
    return out;
  };
  const handleEnd = place([-44, 0]);
  // The hose swings out to the right as the handle moves.
  const c1x = HOLDER.x + 29;
  const c1y = HOLDER.y + 18;
  const c2x = Math.max(handleEnd[0], HOLDER.x) + 23;
  const c2y = HOLDER.y + 58;
  g.moveTo(HOLDER.x, HOLDER.y).bezierCurveTo(c1x, c1y, c2x, c2y, handleEnd[0], handleEnd[1]).stroke({ width: 11, color: INK, cap: 'round' });
  g.moveTo(HOLDER.x, HOLDER.y).bezierCurveTo(c1x, c1y, c2x, c2y, handleEnd[0], handleEnd[1]).stroke({ width: 6, color: 0x8fa3ad, cap: 'round' });
  g.poly(place([-44, -6, -14, -6, -14, 6, -44, 6])).fill(0xdfe9f0).stroke({ width: OUTLINE, color: INK, join: 'round' });
  g.poly(place([-14, -7, 0, -17, 0, 17, -14, 7])).fill(0xc9d6df).stroke({ width: OUTLINE, color: INK, join: 'round' });
  for (const o of [-9, 0, 9]) {
    const hole = place([1, o]);
    g.circle(hole[0], hole[1], 1.8).fill(INK);
  }
}
