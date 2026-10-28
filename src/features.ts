/**
 * What makes one character look different from another: skin, eyes, nose, brows, face shape and the Adam's apple.
 * Pure data and rules (no drawing, no store), so every rule is unit-tested. The values that match Isla are the
 * defaults, and the drawing code is written so those values draw exactly what it drew before characters existed.
 */

export interface SkinTone {
  id: string;
  name: string;
  hex: number;
}

/** The nine skin tones, palest first. Isla is "pale" and keeps her exact original colour. */
export const SKIN_TONES: readonly SkinTone[] = [
  { id: 'very-pale', name: 'Very pale', hex: 0xffe9da },
  { id: 'pale', name: 'Pale', hex: 0xffd9b8 },
  { id: 'pink', name: 'Pink', hex: 0xffc7b8 },
  { id: 'rosy', name: 'Rosy', hex: 0xf8aa9a },
  { id: 'slight-tan', name: 'Slight tan', hex: 0xe9b88a },
  { id: 'fully-tanned', name: 'Fully tanned', hex: 0xd0975f },
  { id: 'light-brown', name: 'Light brown', hex: 0xb97b4c },
  { id: 'mid-brown', name: 'Mid-brown', hex: 0x8f5b36 },
  { id: 'dark-brown', name: 'Dark brown', hex: 0x5f3a24 },
];

export interface EyeColour {
  id: string;
  name: string;
  hex: number;
}

export const EYE_COLOURS: readonly EyeColour[] = [
  { id: 'blue', name: 'Blue', hex: 0x3a86ff },
  { id: 'green', name: 'Green', hex: 0x2fa84f },
  { id: 'hazel', name: 'Hazel', hex: 0xa5762f },
  { id: 'brown', name: 'Brown', hex: 0x6b3f1d },
];

export type FaceShape = 'oval' | 'round' | 'square' | 'triangular';
export const FACE_SHAPES: readonly FaceShape[] = ['oval', 'round', 'square', 'triangular'];

export type BrowHeight = 'high' | 'mid' | 'low';
export const BROW_HEIGHTS: readonly BrowHeight[] = ['high', 'mid', 'low'];

export interface Brows {
  /** 0 thin to 1 thick. */
  thickness: number;
  /** 0 flat to 1 strongly arched. */
  arch: number;
  height: BrowHeight;
  /** 0 close together to 1 far apart. */
  spacing: number;
}

export interface FaceFeatures {
  /** 0 small to 1 large. */
  nose: number;
  adamsApple: boolean;
  /** Whether the cheeks are rosy. */
  cheeks: boolean;
  brows: Brows;
  face: FaceShape;
}

/** Isla's features, and the starting point for any character that does not say otherwise. */
export const DEFAULT_FEATURES: FaceFeatures = {
  nose: 0.5,
  adamsApple: false,
  cheeks: true,
  brows: { thickness: 0.5, arch: 0.5, height: 'mid', spacing: 0.5 },
  face: 'oval',
};

export function clamp01(v: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));
}

/** Features with every number held in range, so a stray value can never make a broken drawing. */
export function cleanFeatures(f: FaceFeatures): FaceFeatures {
  return {
    nose: clamp01(f.nose),
    adamsApple: !!f.adamsApple,
    cheeks: f.cheeks === undefined ? true : !!f.cheeks,
    brows: {
      thickness: clamp01(f.brows.thickness),
      arch: clamp01(f.brows.arch),
      height: BROW_HEIGHTS.includes(f.brows.height) ? f.brows.height : 'mid',
      spacing: clamp01(f.brows.spacing),
    },
    face: FACE_SHAPES.includes(f.face) ? f.face : 'oval',
  };
}

// ---------------------------------------------------------------------------------------------------
// Nose
// ---------------------------------------------------------------------------------------------------

/** The largest nose is 75 per cent bigger than the largest used to be (1.35). */
export const NOSE_SCALE_MAX = 1.35 * 1.75;

/**
 * Scale of the nose drawing: 0.65 at the smallest, 1 in the middle (Isla's, so she is unchanged) and 1.35 x 1.75 at the
 * largest. The two halves of the slider are different lengths: the small half is as it always was, the large half stretches.
 */
export function noseScale(nose: number): number {
  const n = clamp01(nose);
  return n <= 0.5 ? 0.65 + 0.7 * n : 1 + (NOSE_SCALE_MAX - 1) * (n - 0.5) * 2;
}

/**
 * How much of the nose shows at view angle phi (0 front, pi/2 and 3pi/2 the two profiles, pi from behind): fully from the
 * front and in both profiles, then fading out over the few degrees past a profile while it turns behind the head.
 * Worked out from cos(phi) with a margin, never from a depth that is zero (and so a coin toss) in exact profile.
 */
export function noseShowing(phi: number): number {
  return Math.min(1, Math.max(0, (Math.cos(phi) + 0.08) / 0.08));
}

/** How far the nose stands out from the face, relative to the default (px of depth); the large end stands out 75 per cent further. */
export function noseStandOut(nose: number): number {
  const n = clamp01(nose);
  return n <= 0.5 ? (n - 0.5) * 10 : (n - 0.5) * 10 * 1.75;
}

// ---------------------------------------------------------------------------------------------------
// Brows
// ---------------------------------------------------------------------------------------------------

/** Brow ends sit at this height on the face (relative to the head centre) for the middle position. */
export const BROW_BASE_Y = -13;
const BROW_HEIGHT_OFFSET: Record<BrowHeight, number> = { high: -6, mid: 0, low: 2.5 };
/** The eye's top edge, and the gap the middle of a brow keeps above it. */
const EYE_TOP_Y = -11.5;

/** The thickest brow is 75 per cent thicker than the thickest used to be (5.5 px). */
export const BROW_WIDTH_MAX = 5.5 * 1.75;

/**
 * Width of the brow line in px: 2.5 at the thinnest, 4 in the middle (Isla's, unchanged) and 5.5 x 1.75 at the thickest.
 */
export function browWidth(b: Brows): number {
  const t = clamp01(b.thickness);
  return t <= 0.5 ? 2.5 + 3 * t : 4 + (BROW_WIDTH_MAX - 4) * (t - 0.5) * 2;
}

/** The outer end of every brow stays here (degrees round the head from straight ahead), whatever the spacing. */
export const BROW_OUTER_DEG = 36;
/** The inner end sits here in the middle (Isla's, so she is unchanged) and here at the widest spacing. */
export const BROW_INNER_MID_DEG = 12;
export const BROW_INNER_MAX_DEG = 20;
/** The radius of the face where the brows sit, to turn a brow's thickness into an angle. */
const BROW_SURFACE_R = 77;

/** Azimuth (degrees) of the inner end when the two brows just touch at the centre line: their inner edges meet. */
export function browTouchDeg(b: Brows): number {
  return (Math.asin(Math.min(1, browWidth(b) / 2 / BROW_SURFACE_R)) * 180) / Math.PI;
}

/**
 * Azimuth (degrees) of the inner end of the brow. Only the inner end moves with the spacing: at 0 the two brows touch,
 * at the middle they are where Isla's are, and at 1 they are wide apart. The outer end stays at BROW_OUTER_DEG.
 */
export function browStartDeg(b: Brows): number {
  const s = clamp01(b.spacing);
  const touch = browTouchDeg(b);
  return s <= 0.5 ? touch + (BROW_INNER_MID_DEG - touch) * s * 2 : BROW_INNER_MID_DEG + (BROW_INNER_MAX_DEG - BROW_INNER_MID_DEG) * (s - 0.5) * 2;
}

/** How far round the head (degrees) the brow runs, from its inner end to its fixed outer end. */
export function browSpanDeg(b: Brows): number {
  return BROW_OUTER_DEG - browStartDeg(b);
}

/**
 * Height of the brow line (relative to the head centre) at t, 0 at the inner end to 1 at the outer end. The arch lifts
 * the middle; a low, flat brow is held clear of the eye beneath it.
 */
export function browLineY(b: Brows, t: number): number {
  const end = BROW_BASE_Y + BROW_HEIGHT_OFFSET[b.height];
  const raw = end - 10 * clamp01(b.arch) * Math.sin(Math.PI * t);
  const clearOfEye = EYE_TOP_Y - 2 - browWidth(b) / 2;
  const w = smooth01((t - 0.2) / 0.1) * smooth01((0.8 - t) / 0.1);
  return raw + (Math.min(raw, clearOfEye) - raw) * w;
}

function smooth01(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

/** The top edge of the brow, the highest point it reaches (relative y). */
export function browTop(b: Brows): number {
  let top = Infinity;
  for (let k = 0; k <= 16; k++) top = Math.min(top, browLineY(b, k / 16));
  return top - browWidth(b) / 2;
}

/** Isla's brow top, which the hair was always built to clear. */
const BROW_TOP_ISLA = -20;

/**
 * How much higher than Isla's the brows reach, so the fringe and swept hair can keep clear of them: 0 for Isla and for
 * any brow no higher than hers. The hair shifts its fringe limit and its sweep up by this much.
 */
export function browLift(b: Brows): number {
  const lift = BROW_TOP_ISLA - browTop(b);
  return lift > 1e-6 ? lift : 0;
}

// ---------------------------------------------------------------------------------------------------
// Face shape
// ---------------------------------------------------------------------------------------------------

export interface ShapeParams {
  /** Superellipse exponent of the lower half of the face: 2 is an ellipse, higher is squarer, lower is pointier. */
  n: number;
  /** Length of the chin relative to the oval's. */
  chin: number;
  /** How much wider the cheeks or jaw bulge than the oval, and how far down they peak (0 at the eyes, 1 at the chin). */
  bulge: number;
  peak: number;
}

/** Every shape is a softened version: it only changes the cheeks, jaw and chin, never the skull the hair sits on. */
export const SHAPES: Record<Exclude<FaceShape, 'oval'>, ShapeParams> = {
  round: { n: 2.15, chin: 0.94, bulge: 0.045, peak: 0.45 },
  square: { n: 2.9, chin: 1, bulge: 0.03, peak: 0.75 },
  triangular: { n: 1.8, chin: 1.02, bulge: 0.085, peak: 0.5 },
};

/**
 * The outline of the face as flat x,y pairs round the centre (0,0) for half-width hw and half-height ry: the top half is
 * always the oval's, the lower half takes the shape. Repeated points are never produced.
 */
export function facePoints(shape: FaceShape, hw: number, ry: number, steps = 48): number[] {
  const pts: number[] = [];
  const p = shape === 'oval' ? null : SHAPES[shape];
  for (let k = 0; k < steps; k++) {
    const a = (k / steps) * 2 * Math.PI;
    const c = Math.cos(a);
    const s = Math.sin(a);
    if (!p || s <= 0) {
      pts.push(hw * c, ry * s);
      continue;
    }
    // Lower half: a superellipse, then the cheeks bulge out around the peak height.
    const e = 2 / p.n;
    const x = Math.sign(c) * Math.pow(Math.abs(c), e);
    const y = Math.pow(s, e);
    const bump = Math.sin(Math.PI * Math.pow(y, Math.log(0.5) / Math.log(p.peak)));
    pts.push(hw * x * (1 + p.bulge * bump), ry * p.chin * y);
  }
  return pts;
}

// ---------------------------------------------------------------------------------------------------
// Rosy cheeks
// ---------------------------------------------------------------------------------------------------

/** The rose the blush leans towards. */
const BLUSH_ROSE = 0xff5c8a;
/** How much of the rose is in the blush; the rest is the character's own base skin colour. */
const BLUSH_ROSE_SHARE = 0.65;
/** How strong the blush is where it lies over the skin. */
export const BLUSH_ALPHA = 0.55;

/**
 * The colour of a character's rosy cheeks, worked out from their base skin (never the water-temperature tint): the skin
 * leaned towards a rose, so it keeps some of the skin's warmth and depth. On pale skin it is a soft pink and on dark skin
 * a deeper rose, and it shows on every tone.
 */
export function blushColour(skin: number): number {
  const ch = (shift: number) =>
    Math.round(((skin >> shift) & 255) * (1 - BLUSH_ROSE_SHARE) + ((BLUSH_ROSE >> shift) & 255) * BLUSH_ROSE_SHARE);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}
