import type { Length, Region, View } from './state';

// Defined here, not imported from the render code, which imports the store and would make an import cycle.
const DEG = Math.PI / 180;

/**
 * Cutting helpers that need no drawing: the six lengths in order, how regions map onto the head, and how to
 * compare two cuts. Left and right regions are as the player sees Isla from the front (Left is the screen-left
 * side of the front view), the same as the colour chooser.
 */

/** Longest first. A higher index is a shorter cut. */
export const LENGTHS: readonly Length[] = ['back', 'shoulders', 'bob', 'short1', 'short2', 'short3'];

export const LENGTH_LABELS: Record<Length, string> = {
  back: 'Long',
  shoulders: 'Shoulder',
  bob: 'Bob',
  short1: 'Short',
  short2: 'Shorter',
  short3: 'Crop',
};

export const REGIONS: readonly Region[] = ['front', 'left', 'right', 'back'];

/**
 * The azimuth round the head at the middle of each region (0 = straight ahead, + = the screen-right
 * of the front view). So the player's Left is at a negative azimuth.
 */
export const REGION_AZIMUTH: Record<Region, number> = {
  front: 0,
  right: 90 * DEG,
  back: 180 * DEG,
  left: -90 * DEG,
};

/** Which region a point at this azimuth belongs to: the nearest of the four compass points. */
export function regionOfAzimuth(az: number): Region {
  const t = Math.atan2(Math.sin(az), Math.cos(az)); // wrap into (-pi, pi]
  const abs = Math.abs(t);
  if (abs < 45 * DEG) return 'front';
  if (abs >= 135 * DEG) return 'back';
  return t > 0 ? 'right' : 'left';
}

/** Angle each view turns Isla by (see geometry.ts): the left view shows the Left region, the right view the Right. */
const VIEW_PHI: Record<View, number> = { front: 0, left: -90 * DEG, back: 180 * DEG, right: 90 * DEG };

/** Smallest angle between two azimuths, 0 to pi. */
function gap(a: number, b: number): number {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
}

/** True if the region is on the far side of her head in this view, so a cut there can't be seen. */
export function isHiddenIn(region: Region, view: View): boolean {
  return gap(REGION_AZIMUTH[region], VIEW_PHI[view]) > 100 * DEG;
}

/** Regions whose length differs between two cuts. */
export function changedRegions(from: Record<Region, Length>, to: Record<Region, Length>): Region[] {
  return REGIONS.filter((r) => from[r] !== to[r]);
}

/** True if `to` is a shorter cut than `from`. */
export function isShorter(from: Length, to: Length): boolean {
  return LENGTHS.indexOf(to) > LENGTHS.indexOf(from);
}

// ---------------------------------------------------------------------------------------------------
// Cutting over several swipes
// ---------------------------------------------------------------------------------------------------

/** How many swipes across her hair it takes to move to a chosen length. */
export const SWIPES_TO_CUT = 8;

/** A length's place along the list: 0 is the longest, 5 the shortest. */
export type Positions = Record<Region, number>;

/**
 * A cut in progress: where each part of the hair started, where it is heading, and how many swipes have been
 * made. The hair on show is `from` plus `swipes / SWIPES_TO_CUT` of the way to `to`.
 */
export interface CutPlan {
  from: Positions;
  to: Positions;
  swipes: number;
}

export function positionOf(length: Length): number {
  return LENGTHS.indexOf(length);
}

export function positionsOf(lengths: Record<Region, Length>): Positions {
  return { front: positionOf(lengths.front), left: positionOf(lengths.left), right: positionOf(lengths.right), back: positionOf(lengths.back) };
}

/** The whole length nearest each position. */
export function lengthsOf(p: Positions): Record<Region, Length> {
  const at = (v: number): Length => LENGTHS[Math.min(LENGTHS.length - 1, Math.max(0, Math.round(v)))];
  return { front: at(p.front), left: at(p.left), right: at(p.right), back: at(p.back) };
}

/** Where the hair has got to for a plan: an equal step towards the target with each swipe. */
export function planPosition(plan: CutPlan): Positions {
  const k = Math.min(1, Math.max(0, plan.swipes / SWIPES_TO_CUT));
  const at = (r: Region) => plan.from[r] + (plan.to[r] - plan.from[r]) * k;
  return { front: at('front'), left: at('left'), right: at('right'), back: at('back') };
}

/** Regions the plan is moving, with whether each is getting shorter. */
export function movingRegions(plan: CutPlan): Array<{ region: Region; shorter: boolean }> {
  return REGIONS.filter((r) => Math.abs(plan.to[r] - plan.from[r]) > 1e-6).map((region) => ({
    region,
    shorter: plan.to[region] > plan.from[region],
  }));
}
