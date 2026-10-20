/**
 * Hair colour model: parsing, conversion, mixing, and the rules that turn a HairColour into paint.
 *
 * Pure functions only (no drawing, no store), so every rule here is unit-tested. The renderer and the
 * colour chooser both build on this file.
 *
 * In a split, "left" and "right" are as you see Isla from the front: Left is the half of the picture on the
 * screen-left, Right the half on the screen-right. Azimuth is measured from straight ahead, positive towards
 * the screen-right of the front view, so the Left colour paints negative azimuths and the Right colour positive ones. Turn her round and the colours stay on the same parts of her head. The
 * 'left' view shows the Left colour face on, and the 'right' view the Right.
 */

export type ColourMode = 'single' | 'split' | 'ombre';

export interface HairColour {
  mode: ColourMode;
  /** Single: the colour. Split: the Left half, as seen from the front. Ombre: the roots. */
  a: string;
  /** Split: the Right half, as seen from the front. Ombre: the tips. Unused in single mode, but kept so switching modes loses nothing. */
  b: string;
}

export const DEFAULT_HAIR = '#ffd84a';

// ---------------------------------------------------------------------------------------------------
// Parsing and conversion
// ---------------------------------------------------------------------------------------------------

const HEX3 = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i;
const HEX6 = /^#?([0-9a-f]{6})$/i;

/** '#abc', 'ABC' or '#AABBCC' become '#aabbcc'; anything else is null. */
export function normaliseHex(input: string): string | null {
  const s = input.trim();
  const short = HEX3.exec(s);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toLowerCase();
  const long = HEX6.exec(s);
  return long ? `#${long[1]}`.toLowerCase() : null;
}

/** 0xRRGGBB for a hex string; an unreadable string falls back to the default hair colour rather than crashing a redraw. */
export function hexToInt(hex: string): number {
  return parseInt((normaliseHex(hex) ?? DEFAULT_HAIR).slice(1), 16);
}

export function intToHex(n: number): string {
  return `#${(n & 0xffffff).toString(16).padStart(6, '0')}`;
}

export function sameColour(a: string, b: string): boolean {
  const x = normaliseHex(a);
  const y = normaliseHex(b);
  return x !== null && x === y;
}

export interface Hsl {
  /** 0 to 360 */
  h: number;
  /** 0 to 100 */
  s: number;
  /** 0 to 100 */
  l: number;
}

export function hexToHsl(hex: string): Hsl {
  const n = hexToInt(hex);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d > 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: s * 100, l: l * 100 };
}

export function hslToHex(h: number, s: number, l: number): string {
  const S = Math.min(100, Math.max(0, s)) / 100;
  const L = Math.min(100, Math.max(0, l)) / 100;
  const H = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * L - 1)) * S;
  const x = c * (1 - Math.abs(((H / 60) % 2) - 1));
  const m = L - c / 2;
  let rgb: [number, number, number];
  if (H < 60) rgb = [c, x, 0];
  else if (H < 120) rgb = [x, c, 0];
  else if (H < 180) rgb = [0, c, x];
  else if (H < 240) rgb = [0, x, c];
  else if (H < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  const [r, g, b] = rgb.map((v) => Math.round((v + m) * 255));
  return intToHex((r << 16) | (g << 8) | b);
}

// ---------------------------------------------------------------------------------------------------
// Mixing in OKLab / OKLCH, so blends between two colours stay clean instead of going muddy
// ---------------------------------------------------------------------------------------------------

type Lab = [number, number, number];

function toLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function fromLinear(v: number): number {
  const c = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
  return Math.min(255, Math.max(0, Math.round(c * 255)));
}

function toLab(n: number): Lab {
  const r = toLinear((n >> 16) & 255);
  const g = toLinear((n >> 8) & 255);
  const b = toLinear(n & 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function fromLab([L, a, b]: Lab): number {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const r = fromLinear(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
  const g = fromLinear(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
  const bl = fromLinear(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);
  return (r << 16) | (g << 8) | bl;
}

/** Below this chroma a colour is treated as grey, with no hue of its own. */
const NEUTRAL = 0.02;

/** How vivid a colour is (OKLab chroma): 0 for greys, about 0.1 to 0.3 for strong colours. */
export function colourChroma(n: number): number {
  const [, a, b] = toLab(n);
  return Math.hypot(a, b);
}

/**
 * Blend two 0xRRGGBB colours; t = 0 gives x exactly and t = 1 gives y exactly.
 *
 * The blend goes round the hue circle by the shorter way, keeping lightness and vividness on a straight line
 * between the two. A straight line through colour space dips into grey between opposite colours (blonde to
 * purple turns a murky mauve); this way it passes through orange and pink instead, which suits the cartoon style.
 */
export function mixColours(x: number, y: number, t: number): number {
  if (t <= 0) return x;
  if (t >= 1) return y;
  const p = toLab(x);
  const q = toLab(y);
  const cp = Math.hypot(p[1], p[2]);
  const cq = Math.hypot(q[1], q[2]);
  let hp = Math.atan2(p[2], p[1]);
  let hq = Math.atan2(q[2], q[1]);
  // A grey has no hue, so it borrows the other colour's and the blend simply gains or loses colour.
  if (cp < NEUTRAL) hp = hq;
  else if (cq < NEUTRAL) hq = hp;
  let dh = hq - hp;
  while (dh > Math.PI) dh -= 2 * Math.PI;
  while (dh < -Math.PI) dh += 2 * Math.PI;
  const c = cp + (cq - cp) * t;
  const h = hp + dh * t;
  return fromLab([p[0] + (q[0] - p[0]) * t, c * Math.cos(h), c * Math.sin(h)]);
}

/** How different two colours look: straight-line distance in OKLab (about 0.02 is just noticeable, 0.3 is very different). */
export function colourDistance(x: number, y: number): number {
  const p = toLab(x);
  const q = toLab(y);
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

// ---------------------------------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------------------------------

/** The quick-pick colours: a few natural shades, then the vibrant ones the cartoon style loves. */
export const HAIR_SWATCHES: ReadonlyArray<{ name: string; hex: string }> = [
  { name: 'Sunny blonde', hex: '#ffd84a' },
  { name: 'Platinum', hex: '#f3ecc8' },
  { name: 'Ginger', hex: '#ff8a2b' },
  { name: 'Red', hex: '#ff3b4e' },
  { name: 'Auburn', hex: '#b5441f' },
  { name: 'Brown', hex: '#7a4a2a' },
  { name: 'Black', hex: '#3b3050' },
  { name: 'Pink', hex: '#ff6fb1' },
  { name: 'Purple', hex: '#9b5de5' },
  { name: 'Blue', hex: '#3a86ff' },
  { name: 'Mint', hex: '#2ed3a5' },
];

// ---------------------------------------------------------------------------------------------------
// Changing the colour
// ---------------------------------------------------------------------------------------------------

const PARTNERS = ['#ff6fb1', '#3a86ff'];

/** A colour that clearly contrasts with a, used to fill the second slot so a new mode shows an effect straight away. */
export function partnerColour(a: string): string {
  const base = hexToInt(a);
  return PARTNERS.reduce((best, c) =>
    colourDistance(base, hexToInt(c)) > colourDistance(base, hexToInt(best)) ? c : best,
  );
}

/**
 * Switch mode. Going to split or ombre while both colours are still the same would look like nothing happened,
 * so the second colour is set to a contrasting one. Going back to single keeps b, so nothing is lost.
 */
export function withMode(c: HairColour, mode: ColourMode): HairColour {
  if (c.mode === mode) return c;
  const b = mode !== 'single' && sameColour(c.a, c.b) ? partnerColour(c.a) : c.b;
  return { mode, a: c.a, b };
}

/** Set one colour slot. Invalid or unchanged input returns the same object. */
export function withColour(c: HairColour, slot: 'a' | 'b', hex: string): HairColour {
  const n = normaliseHex(hex);
  if (!n || n === c[slot]) return c;
  return { ...c, [slot]: n };
}

// ---------------------------------------------------------------------------------------------------
// Paint: what the renderer asks for
// ---------------------------------------------------------------------------------------------------

/** A stretch of a lock, from u0 to u1 (0 at the crown, 1 at the tip), painted one flat colour. */
export interface Band {
  u0: number;
  u1: number;
  colour: number;
}

/** Colour steps between roots and tips. Flat steps, not a smooth blend, to keep the cel-shaded look. */
export const OMBRE_STEPS = 5;
/** Fraction of the way down each lock before the colour starts to change, so the roots stay root-coloured. */
export const OMBRE_START = 0.3;

/** The bands of an ombre from roots a to tips b: OMBRE_STEPS + 1 flat colours that tile [0, 1] exactly. */
export function ombreBands(a: number, b: number): Band[] {
  const edges = [0];
  for (let k = 0; k < OMBRE_STEPS; k++) edges.push(OMBRE_START + (1 - OMBRE_START) * ((k + 0.5) / OMBRE_STEPS));
  edges.push(1);
  return edges.slice(0, -1).map((u0, k) => ({ u0, u1: edges[k + 1], colour: mixColours(a, b, k / OMBRE_STEPS) }));
}

export interface HairPaint {
  /** Bands for the lock rooted at azimuth a0 (0 = straight ahead, negative = the Left half as seen from the front). */
  bands(a0: number): Band[];
  /** Root colour on a side of the head, by the sign of its azimuth (-1 = Left, +1 = Right); the eyebrows follow this. */
  root(side: -1 | 1): number;
  /** Base colour of the highlight at a head azimuth. */
  sheen(az: number): number;
}

/**
 * What the hair looks like, as two lists of bands: one for the Left half of the head and one for the Right.
 * Every mode boils down to this, which is what lets any look fade into any other.
 */
export interface PaintSides {
  left: Band[];
  right: Band[];
}

export function paintSides(c: HairColour): PaintSides {
  const a = hexToInt(c.a);
  const b = hexToInt(c.b);
  const whole = (colour: number): Band[] => [{ u0: 0, u1: 1, colour }];

  if (c.mode === 'ombre') {
    const bands = ombreBands(a, b);
    return { left: bands, right: bands };
  }
  if (c.mode === 'split') return { left: whole(a), right: whole(b) };
  const only = whole(a);
  return { left: only, right: only };
}

export function paintFromSides(s: PaintSides): HairPaint {
  const side = (sign: number): Band[] => (sign < 0 ? s.left : s.right);
  return {
    bands: (a0) => side(a0),
    root: (sign) => side(sign)[0].colour,
    sheen: (az) => side(az)[0].colour,
  };
}

export function hairPaint(c: HairColour): HairPaint {
  return paintFromSides(paintSides(c));
}

// ---------------------------------------------------------------------------------------------------
// Fading from one look to another
// ---------------------------------------------------------------------------------------------------

function colourAt(bands: Band[], u: number): number {
  for (const band of bands) if (u < band.u1) return band.colour;
  return bands[bands.length - 1].colour;
}

/**
 * Bands partway between two band lists (t = 0 is exactly `from`, t = 1 exactly `to`). The result is cut wherever
 * either list is cut, each piece mixing the two colours found there, so a single colour can fade into an ombre,
 * or a split into either. Neighbouring pieces that end up the same colour are joined back together, which keeps a
 * fade between two plain colours as one flat band.
 */
export function blendBands(from: Band[], to: Band[], t: number): Band[] {
  if (t <= 0) return from;
  if (t >= 1) return to;
  const cuts = new Set<number>([0, 1]);
  for (const band of [...from, ...to]) {
    cuts.add(band.u0);
    cuts.add(band.u1);
  }
  const edges = [...cuts].sort((x, y) => x - y);

  const out: Band[] = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const u0 = edges[i];
    const u1 = edges[i + 1];
    if (u1 - u0 < 1e-9) continue;
    const mid = (u0 + u1) / 2;
    const x = colourAt(from, mid);
    const y = colourAt(to, mid);
    const colour = x === y ? x : mixColours(x, y, t);
    const last = out[out.length - 1];
    if (last && last.colour === colour) last.u1 = u1;
    else out.push({ u0, u1, colour });
  }
  return out;
}

export function blendSides(from: PaintSides, to: PaintSides, t: number): PaintSides {
  if (t <= 0) return from;
  if (t >= 1) return to;
  return { left: blendBands(from.left, to.left, t), right: blendBands(from.right, to.right, t) };
}

function sameBands(a: Band[], b: Band[]): boolean {
  return a === b || (a.length === b.length && a.every((x, i) => x.u0 === b[i].u0 && x.u1 === b[i].u1 && x.colour === b[i].colour));
}

export function sameSides(a: PaintSides, b: PaintSides): boolean {
  return sameBands(a.left, b.left) && sameBands(a.right, b.right);
}
