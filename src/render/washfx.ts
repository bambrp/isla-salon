import type { Graphics } from 'pixi.js';
import { DEG, HEAD, clamp, lerp, mulberry32, project, smoothstep } from './geometry';
import { FRONT_SECTOR, reachAt, type CutLengths } from './hair';
import { DIAL, TAP, SHELF_PRODUCTS, SPRAY_TARGET, bottleHeight } from './sinkLayout';
import { dialColour, tapAngle } from './backdrop';
import { drawSprayer, sprayerPose, type SprayerPose } from './sprayer';
import { INK } from './style';
import { isShampoo, streamFor, waterLook, type Applying, type Product, type WashLevels } from './wash';

/**
 * The washing layer: water stream, splashes, drips, steam and chill, foam and cream on the hair, scent
 * particles, and the sparkle of clean conditioned hair. It also draws the parts of the sink that move, the
 * dial's lever and the ring round the chosen bottle. Everything here is drawing and particle bookkeeping;
 * the rules for how the hair responds live in wash.ts.
 */

// ---------------------------------------------------------------------------------------------------
// Foam and cream on the hair
// ---------------------------------------------------------------------------------------------------

export interface Bubble {
  /** Where on the head it sits: azimuth round the head and height relative to its centre. */
  az: number;
  y: number;
  r: number;
  /** The lather level at which this bubble appears (0 to 1), so lather builds up bubble by bubble. */
  threshold: number;
}

export const BUBBLE_COUNT = 96;

/**
 * Scatter bubbles over the hair for a given cut. They keep off the face (the front is crowned only above the
 * forehead) and stop above where the hair ends, so a short cut is lathered high and a long one all the way down.
 */
export function foamLayout(lengths: CutLengths, seed: number): Bubble[] {
  const rand = mulberry32(seed * 104729 + 7);
  const top = -(HEAD.ry + 6);
  const out: Bubble[] = [];
  for (let i = 0; i < BUBBLE_COUNT; i++) {
    const az = (rand() * 2 - 1) * Math.PI;
    const reach = reachAt(az, lengths);
    const inFront = Math.abs(az) < FRONT_SECTOR;
    // Front: only the crown and forehead, clear of the brows. Elsewhere: down to just above the ends, at most to the shoulders.
    const low = inFront ? -46 : Math.min(reach - 12, 170);
    const bottom = Math.max(top + 14, low);
    const y = lerp(top + 4, bottom, Math.pow(rand(), 1.25));
    out.push({ az, y, r: 6 + rand() * 7, threshold: (i + rand()) / BUBBLE_COUNT });
  }
  return out;
}

/** The pale colour of the lather for each shampoo, and of the particles that drift off it. */
export const SCENT = {
  mint: { foam: 0xd2fbea, rim: 0x6fe3b8, accent: 0x2ecc71, accent2: 0x9ff5cf },
  citrus: { foam: 0xfff0a6, rim: 0xffc23a, accent: 0xff9f1c, accent2: 0xffe066 },
  tropical: { foam: 0xffd3ea, rim: 0xff86c0, accent: 0xff5fa2, accent2: 0xffd84a },
} as const;

function onHead(b: Bubble, phi: number): { x: number; y: number; d: number } {
  const top = HEAD.ry + 10;
  const k = b.y < 0 ? Math.sqrt(Math.max(0, 1 - (b.y / top) ** 2)) : 1;
  const p = project((HEAD.rx + 9) * k * Math.sin(b.az), b.y, (HEAD.rz + 9) * k * Math.cos(b.az), phi);
  return { x: p.sx, y: p.sy, d: p.d };
}

/** Lather, bubble by bubble, only on the near side of the head. `scent` picks the colour. */
function drawFoam(g: Graphics, bubbles: Bubble[], level: number, phi: number, scent: keyof typeof SCENT, time: number): void {
  if (level <= 0.01) return;
  const col = SCENT[scent];
  const shown = bubbles
    .filter((b) => level > b.threshold)
    .map((b) => ({ b, ...onHead(b, phi) }))
    .filter((p) => p.d > -14)
    .sort((a, c) => a.d - c.d);
  for (const { b, x, y } of shown) {
    const grow = smoothstep(b.threshold, b.threshold + 0.2, level);
    const r = b.r * (0.55 + 0.45 * level) * grow;
    const bob = Math.sin(time * 2.2 + b.az * 5) * 0.6;
    g.circle(x, y + bob, r).fill(col.foam).stroke({ width: 1.6, color: INK });
    g.circle(x - r * 0.35, y + bob - r * 0.35, Math.max(1, r * 0.22)).fill(0xffffff);
    // A thin tinted rim inside the outline gives each scent its own edge colour.
    g.circle(x, y + bob, Math.max(1, r - 2.2)).stroke({ width: 1, color: col.rim, alpha: 0.7 });
  }
}

// ---------------------------------------------------------------------------------------------------
// Particles
// ---------------------------------------------------------------------------------------------------

type Shape = 'drop' | 'splash' | 'steam' | 'chill' | 'leaf' | 'zest' | 'flower' | 'star' | 'drip';

interface Particle {
  shape: Shape;
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  age: number;
  life: number;
  size: number;
  grow: number;
  rot: number;
  spin: number;
  colour: number;
  colour2: number;
}

/** A blob of product squirted on top of her head, sinking into the hair. `t` runs 0 (just squirted) to 1 (gone). */
export interface Blob {
  t: number;
  colour: number;
}

export interface FxContext {
  /** True while her hair is shiny, which sparkles. */
  shine: boolean;
  applying: Applying;
  /** The product on the hair (it decides the lather's scent and colour); the bottle chosen on the shelf is `selected`. */
  product: Product;
  selected: Product;
  /** How hard the hair is being rubbed, 0 to 1. */
  rub: number;
  /** The squirt sinking in, if there is one. */
  blob: Blob | null;
  pressure: number;
  temperature: number;
  levels: WashLevels;
  phi: number;
  /** Screen positions where hair ends on the near side, for drips. */
  tips: ReadonlyArray<{ x: number; y: number }>;
  bubbles: Bubble[];
  /** Where a swiping finger is on her head, which the shower head follows; null when nobody is swiping. */
  aimGoal: { x: number; y: number } | null;
  /** Which wall control a finger is on, which shows its scale. */
  dragging: 'dial' | 'tap' | null;
}

const MAX_PARTICLES = 240;

export class WashFx {
  private parts: Particle[] = [];
  private rand = mulberry32(99);
  private carry = { splash: 0, drip: 0, steam: 0, chill: 0, accent: 0 };
  time = 0;
  /** Where the shower is aimed now. It chases the finger, and eases back to her crown when the swipe ends. */
  aim = { x: SPRAY_TARGET.x, y: SPRAY_TARGET.y };

  /** True while the shower head is away from its resting place, so the scene keeps animating until it is back. */
  aimMoving(): boolean {
    return Math.abs(this.aim.x - SPRAY_TARGET.x) > 0.3 || Math.abs(this.aim.y - SPRAY_TARGET.y) > 0.3;
  }

  pose(): SprayerPose {
    return sprayerPose(this.aim.x, this.aim.y);
  }

  private chase(dt: number, goal: { x: number; y: number } | null): void {
    const to = goal ?? SPRAY_TARGET;
    const k = 1 - Math.exp(-dt * (goal ? 16 : 7));
    this.aim.x += (to.x - this.aim.x) * k;
    this.aim.y += (to.y - this.aim.y) * k;
    if (!goal && !this.aimMoving()) {
      this.aim.x = SPRAY_TARGET.x;
      this.aim.y = SPRAY_TARGET.y;
    }
  }

  /** True while any particle is still in the air, so the scene knows to keep animating. */
  active(): boolean {
    return this.parts.length > 0;
  }

  clear(): void {
    this.parts = [];
  }

  private emit(p: Omit<Particle, 'age'>): void {
    if (this.parts.length >= MAX_PARTICLES) return;
    this.parts.push({ ...p, age: 0 });
  }

  /** How many particles to spawn this step for a rate per second, carrying the fraction over. */
  private due(key: keyof WashFx['carry'], rate: number, dt: number): number {
    this.carry[key] += rate * dt;
    const n = Math.floor(this.carry[key]);
    this.carry[key] -= n;
    return n;
  }

  update(dt: number, c: FxContext): void {
    this.time += dt;
    const r = this.rand;
    const look = waterLook(c.temperature);
    const water = c.applying === 'water';
    this.chase(dt, c.aimGoal);

    // Age, move and retire what is already flying.
    for (const p of this.parts) {
      p.age += dt;
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
      p.size += p.grow * dt;
    }
    this.parts = this.parts.filter((p) => p.age < p.life);

    if (water) {
      const stream = streamFor(c.pressure);
      for (let i = this.due('splash', 18 + 60 * c.pressure, dt); i > 0; i--) {
        this.emit({
          shape: 'splash',
          x: this.aim.x + (r() - 0.5) * 30,
          y: this.aim.y + (r() - 0.5) * 8,
          vx: (r() - 0.5) * (90 + 120 * c.pressure),
          vy: -(50 + r() * (90 + 120 * c.pressure)),
          gravity: 620,
          life: 0.4 + r() * 0.2,
          size: 1.8 + r() * 1.4 * (0.6 + stream.width / 4),
          grow: 0,
          rot: 0,
          spin: 0,
          colour: look.tint,
          colour2: 0xffffff,
        });
      }
      if (look.steam > 0.02) {
        for (let i = this.due('steam', 10 * look.steam, dt); i > 0; i--) {
          this.emit({
            shape: 'steam',
            x: HEAD.cx + (r() - 0.5) * 100,
            y: HEAD.cy - HEAD.ry - 4 + r() * 14,
            vx: (r() - 0.5) * 14,
            vy: -(26 + r() * 22),
            gravity: 0,
            life: 1.5 + r() * 0.5,
            size: 9 + r() * 5,
            grow: 16,
            rot: 0,
            spin: 0,
            colour: 0xffffff,
            colour2: 0xffd9d9,
          });
        }
      }
      if (look.chill > 0.02) {
        for (let i = this.due('chill', 12 * look.chill, dt); i > 0; i--) {
          const a = r() * Math.PI * 2;
          const rad = 80 + r() * 50;
          this.emit({
            shape: 'chill',
            x: HEAD.cx + Math.cos(a) * rad,
            y: HEAD.cy - 20 + Math.sin(a) * rad * 0.8,
            vx: 0,
            vy: 6,
            gravity: 0,
            life: 0.7 + r() * 0.4,
            size: 4 + r() * 4,
            grow: 0,
            rot: r() * 1.2,
            spin: (r() - 0.5) * 3,
            colour: 0xcdeaff,
            colour2: 0xffffff,
          });
        }
      }
    }

    // Water runs off the ends of wet hair.
    if (c.levels.wet > 0.3 && c.tips.length) {
      const rate = (water ? 9 : 3) * c.levels.wet;
      for (let i = this.due('drip', rate, dt); i > 0; i--) {
        const tip = c.tips[Math.floor(r() * c.tips.length)];
        this.emit({
          shape: 'drip',
          x: tip.x,
          y: tip.y + 2,
          vx: 0,
          vy: 10,
          gravity: 760,
          life: 0.75,
          size: 2.4,
          grow: 0,
          rot: 0,
          spin: 0,
          colour: look.tint,
          colour2: 0xffffff,
        });
      }
    }

    // Scented bits drift up off the hair while a product goes on.
    if (c.applying === 'product') {
      for (let i = this.due('accent', 6 + 18 * c.rub, dt); i > 0; i--) {
        const shampoo = isShampoo(c.product);
        const scent = shampoo ? SCENT[c.product as keyof typeof SCENT] : undefined;
        this.emit({
          shape: !shampoo ? 'star' : c.product === 'mint' ? 'leaf' : c.product === 'citrus' ? 'zest' : 'flower',
          x: HEAD.cx + (r() - 0.5) * 120,
          y: HEAD.cy - HEAD.ry + 10 + r() * 40,
          vx: (r() - 0.5) * 30,
          vy: -(40 + r() * 40),
          gravity: 0,
          life: 1.1 + r() * 0.5,
          size: 6 + r() * 4,
          grow: 0,
          rot: r() * Math.PI * 2,
          spin: (r() - 0.5) * 4,
          colour: scent ? scent.accent : 0xc9a7ff,
          colour2: scent ? scent.accent2 : 0xffffff,
        });
      }
    }
  }

  // -------------------------------------------------------------------------------------------------
  // Drawing
  // -------------------------------------------------------------------------------------------------

  /** Everything that sits over the hair, and the moving parts of the sink. Cleared and redrawn each frame. */
  draw(g: Graphics, c: FxContext): void {
    g.clear();
    drawSprayer(g, this.pose());
    const scent = isShampoo(c.product) ? (c.product as keyof typeof SCENT) : 'mint';
    // Lather keeps the colour of the shampoo it came from, so the last shampoo used decides it.
    drawFoam(g, c.bubbles, c.levels.foam, c.phi, this.lastScent(scent, c), this.time);

    const look = waterLook(c.temperature);
    const water = c.applying === 'water';
    const fade = this.ramp(water);
    this.tint(g, look, fade);
    if (water) this.stream(g, c, look.tint);
    this.particles(g);
    if (c.shine) this.sparkle(g, c.phi);

    if (c.blob) this.blob(g, c.blob);
    this.sinkControls(g, c);
  }

  /**
   * The squirt: a glossy blob of product pops out on her crown, sits a moment, then sinks into the hair over one
   * second, flattening and spreading as it goes.
   */
  private blob(g: Graphics, b: Blob): void {
    const t = clamp(b.t, 0, 1);
    const pop = smoothstep(0, 0.2, t);
    const sink = smoothstep(0.4, 1, t);
    // A little overshoot as it lands, then it settles.
    const bounce = 1 + 0.18 * Math.sin(Math.min(1, t / 0.3) * Math.PI) * (1 - sink);
    const w = (20 + 14 * sink) * pop * bounce;
    const h = 15 * pop * (1 - sink) * bounce;
    if (w < 1 || h < 0.5) return;
    const x = HEAD.cx;
    const y = HEAD.cy - HEAD.ry + 2 - h * 0.4;
    const alpha = 1 - 0.85 * sink * sink;
    g.ellipse(x, y + h * 0.7, w * 1.05, h * 0.55 + 1).fill({ color: INK, alpha: 0.25 * alpha });
    g.ellipse(x, y, w, h).fill({ color: b.colour, alpha }).stroke({ width: 3, color: INK, alpha });
    g.ellipse(x, y + h * 0.35, w * 0.8, h * 0.45).fill({ color: 0x000000, alpha: 0.1 * alpha });
    g.ellipse(x - w * 0.35, y - h * 0.35, w * 0.3, h * 0.25).fill({ color: 0xffffff, alpha: 0.75 * alpha });
    // Two drips on the way in.
    if (t > 0.1 && t < 0.7) {
      const fall = smoothstep(0.1, 0.7, t);
      g.circle(x + w * 0.45, y + h + fall * 14, 2.6 * (1 - fall * 0.5)).fill({ color: b.colour, alpha: 0.9 * (1 - fall) }).stroke({ width: 1.5, color: INK, alpha: 0.7 * (1 - fall) });
    }
  }

  private shown = 0;
  /** Eases 0 to 1 while the water runs, so the tint fades in and out rather than snapping. */
  private ramp(on: boolean): number {
    this.shown = clamp(this.shown + (on ? 0.12 : -0.08), 0, 1);
    return this.shown;
  }

  private scentMemory: keyof typeof SCENT = 'mint';
  private lastScent(selected: keyof typeof SCENT, c: FxContext): keyof typeof SCENT {
    if (c.applying === 'product' && isShampoo(c.product)) this.scentMemory = selected;
    return this.scentMemory;
  }

  /** A faint wash of icy blue or warm pink over the head while the water runs. */
  private tint(g: Graphics, look: ReturnType<typeof waterLook>, fade: number): void {
    const cold = look.chill * fade;
    const hot = look.steam * fade;
    if (cold > 0.02) g.ellipse(HEAD.cx, HEAD.cy + 10, 120, 150).fill({ color: 0x7fc4ff, alpha: 0.16 * cold });
    if (hot > 0.02) g.ellipse(HEAD.cx, HEAD.cy + 10, 120, 150).fill({ color: 0xff8f7a, alpha: 0.12 * hot });
  }

  /** The water from the sprayer: streaks sliding down a fan, more and faster with pressure. */
  private stream(g: Graphics, c: FxContext, tint: number): void {
    const s = streamFor(c.pressure);
    const nozzle = this.pose();
    const dx = nozzle.aimX - nozzle.x;
    const dy = nozzle.aimY - nozzle.y;
    const len = Math.hypot(dx, dy);
    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;
    const ny = ux;
    const cycle = len / s.speed;
    for (let k = 0; k < s.streaks; k++) {
      const lane = (k / (s.streaks - 1 || 1)) * 2 - 1;
      const phase = (this.time / cycle + (k * 0.618) % 1) % 1;
      const head = phase * len;
      const tail = Math.max(0, head - (14 + 14 * c.pressure));
      const fan = (t: number) => lane * s.spread * (t / len);
      const x0 = nozzle.x + ux * tail + nx * fan(tail);
      const y0 = nozzle.y + uy * tail + ny * fan(tail);
      const x1 = nozzle.x + ux * head + nx * fan(head);
      const y1 = nozzle.y + uy * head + ny * fan(head);
      g.moveTo(x0, y0).lineTo(x1, y1).stroke({ width: s.width + 2, color: INK, cap: 'round', alpha: 0.9 });
      g.moveTo(x0, y0).lineTo(x1, y1).stroke({ width: s.width, color: tint, cap: 'round' });
    }
  }

  private particles(g: Graphics): void {
    for (const p of this.parts) {
      const t = p.age / p.life;
      switch (p.shape) {
        case 'splash':
        case 'drip':
          g.circle(p.x, p.y, p.size).fill({ color: p.colour, alpha: 1 - t * 0.6 }).stroke({ width: 1.2, color: INK, alpha: 1 - t });
          break;
        case 'steam':
          g.circle(p.x, p.y, p.size).fill({ color: p.colour, alpha: 0.42 * (1 - t) }).stroke({ width: 1.2, color: p.colour2, alpha: 0.5 * (1 - t) });
          break;
        case 'chill':
          this.star(g, p.x, p.y, p.size * (0.6 + 0.4 * Math.sin(t * Math.PI)), p.rot, p.colour, 1 - Math.abs(t * 2 - 1) * 0.5, true);
          break;
        case 'star':
          this.star(g, p.x, p.y, p.size, p.rot, p.colour, 1 - t * t, false);
          break;
        case 'leaf':
          this.leaf(g, p, t);
          break;
        case 'zest':
          this.zest(g, p, t);
          break;
        case 'flower':
          this.flower(g, p, t);
          break;
      }
    }
  }

  private star(g: Graphics, x: number, y: number, size: number, rot: number, colour: number, alpha: number, thin: boolean): void {
    const pts: number[] = [];
    for (let i = 0; i < 8; i++) {
      const a = rot + (i * Math.PI) / 4;
      const r = i % 2 === 0 ? size : size * (thin ? 0.18 : 0.32);
      pts.push(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    g.poly(pts).fill({ color: colour, alpha }).stroke({ width: 1.1, color: INK, alpha: alpha * 0.9, join: 'round' });
  }

  private leaf(g: Graphics, p: Particle, t: number): void {
    const a = 1 - t * t;
    const c = Math.cos(p.rot);
    const s = Math.sin(p.rot);
    const l = p.size * 1.5;
    const w = p.size * 0.6;
    const pt = (u: number, v: number): [number, number] => [p.x + u * c - v * s, p.y + u * s + v * c];
    g.poly([...pt(-l, 0), ...pt(-l * 0.2, -w), ...pt(l, 0), ...pt(-l * 0.2, w)])
      .fill({ color: p.colour, alpha: a })
      .stroke({ width: 1.2, color: INK, alpha: a, join: 'round' });
    g.moveTo(...pt(-l * 0.8, 0)).lineTo(...pt(l * 0.7, 0)).stroke({ width: 1, color: p.colour2, alpha: a });
  }

  private zest(g: Graphics, p: Particle, t: number): void {
    const a = 1 - t * t;
    g.circle(p.x, p.y, p.size * 0.8).fill({ color: p.colour, alpha: a }).stroke({ width: 1.2, color: INK, alpha: a });
    for (let i = 0; i < 3; i++) {
      const ang = p.rot + (i * Math.PI) / 3;
      g.moveTo(p.x - Math.cos(ang) * p.size * 0.7, p.y - Math.sin(ang) * p.size * 0.7)
        .lineTo(p.x + Math.cos(ang) * p.size * 0.7, p.y + Math.sin(ang) * p.size * 0.7)
        .stroke({ width: 1, color: p.colour2, alpha: a });
    }
  }

  private flower(g: Graphics, p: Particle, t: number): void {
    const a = 1 - t * t;
    for (let i = 0; i < 5; i++) {
      const ang = p.rot + (i * 2 * Math.PI) / 5;
      g.circle(p.x + Math.cos(ang) * p.size * 0.55, p.y + Math.sin(ang) * p.size * 0.55, p.size * 0.42)
        .fill({ color: p.colour, alpha: a })
        .stroke({ width: 1, color: INK, alpha: a });
    }
    g.circle(p.x, p.y, p.size * 0.3).fill({ color: p.colour2, alpha: a }).stroke({ width: 1, color: INK, alpha: a });
  }

  /** Twinkles on the hair once it has been washed, conditioned and rinsed. */
  /** Just the shine's sparkles, for the stages after the sink, where nothing else of the washing shows. */
  drawShine(g: Graphics, phi: number): void {
    g.clear();
    this.sparkle(g, phi);
  }

  private sparkle(g: Graphics, phi: number): void {
    const spots: Array<[number, number, number]> = [
      [-48 * DEG, -64, 0],
      [14 * DEG, -78, 1.3],
      [58 * DEG, -40, 2.1],
      [-24 * DEG, -22, 3.4],
      [170 * DEG, -52, 0.7],
      [-120 * DEG, -34, 2.8],
    ];
    for (const [az, y, offset] of spots) {
      const top = HEAD.ry + 10;
      const k = Math.sqrt(Math.max(0, 1 - (y / top) ** 2));
      const p = project((HEAD.rx + 9) * k * Math.sin(az), y, (HEAD.rz + 9) * k * Math.cos(az), phi);
      if (p.d < 6) continue;
      const pulse = Math.max(0, Math.sin(this.time * 3 + offset * 2));
      if (pulse < 0.05) continue;
      this.star(g, p.sx, p.sy, 3 + 8 * pulse, Math.PI / 4, 0xffffff, 0.4 + 0.6 * pulse, false);
    }
  }

  /** The dial's lever and scale marker, the ring round the chosen bottle, and the scale shown while dragging. */
  private sinkControls(g: Graphics, c: FxContext): void {
    // The chosen bottle gets a bobbing ring so it is clear what Apply will use.
    const b = SHELF_PRODUCTS[c.selected];
    const h = bottleHeight(b.tall);
    const bob = Math.sin(this.time * 4) * 1.5;
    g.roundRect(b.x - 21, b.baseY - h - 21 + bob, 42, h + 27, 11).stroke({ width: 6, color: INK });
    g.roundRect(b.x - 21, b.baseY - h - 21 + bob, 42, h + 27, 11).stroke({ width: 3, color: 0xffffff });

    // Lever: points from the centre round the scale, cold on the left to hot on the right.
    const t = clamp(c.temperature, 0, 1);
    const ang = (-125 + 250 * t - 90) * DEG;
    const lx = DIAL.x + Math.cos(ang) * (DIAL.r - 4.5);
    const ly = DIAL.y + Math.sin(ang) * (DIAL.r - 4.5);
    g.circle(DIAL.x, DIAL.y, DIAL.r - 7.5).fill(0xf4f8fb).stroke({ width: 4.5, color: INK });
    g.moveTo(DIAL.x, DIAL.y).lineTo(lx, ly).stroke({ width: 15, color: INK, cap: 'round' });
    g.moveTo(DIAL.x, DIAL.y).lineTo(lx, ly).stroke({ width: 8.25, color: dialColour(t), cap: 'round' });
    g.circle(DIAL.x, DIAL.y, 6.75).fill(0xffd84a).stroke({ width: 3, color: INK });

    // The tap's cross handle: lowest setting is off.
    const ta = tapAngle(c.pressure);
    for (const arm of [0, 1]) {
      const a = ta + (arm * Math.PI) / 2;
      const dx = Math.cos(a) * (TAP.r - 3);
      const dy = Math.sin(a) * (TAP.r - 3);
      g.moveTo(TAP.x - dx, TAP.y - dy).lineTo(TAP.x + dx, TAP.y + dy).stroke({ width: 10, color: INK, cap: 'round' });
      g.moveTo(TAP.x - dx, TAP.y - dy).lineTo(TAP.x + dx, TAP.y + dy).stroke({ width: 5.5, color: arm === 0 ? 0xeaf6ff : 0xc9d6df, cap: 'round' });
    }
    g.circle(TAP.x, TAP.y, 5).fill(c.pressure > 0 ? 0x5ec8ff : 0xff4d4d).stroke({ width: 2, color: INK });

    if (c.dragging === 'tap') {
      const x = TAP.x - 62;
      const top = TAP.y - 70;
      const bottom = TAP.y + 70;
      g.roundRect(x - 11, top - 8, 22, bottom - top + 16, 11).fill(0xffffff).stroke({ width: 3, color: INK });
      const steps = 10;
      for (let i = 0; i < steps; i++) {
        const y0 = lerp(bottom, top, i / steps);
        const y1 = lerp(bottom, top, (i + 1) / steps);
        g.rect(x - 5, y1, 10, y0 - y1 + 0.5).fill(i === 0 ? 0xdfe6ea : mixColour(0xd8f3ff, 0x2d98da, i / steps));
      }
      g.circle(x, bottom + 2, 3).fill(0xff4d4d);
      g.circle(x, lerp(bottom, top, clamp(c.pressure, 0, 1)), 9).fill(0xffffff).stroke({ width: 3, color: INK });
    }

    if (c.dragging === 'dial') {
      const x = DIAL.x - 66;
      const top = DIAL.y - 70;
      const bottom = DIAL.y + 70;
      g.roundRect(x - 11, top - 8, 22, bottom - top + 16, 11).fill(0xffffff).stroke({ width: 3, color: INK });
      const steps = 14;
      for (let i = 0; i < steps; i++) {
        const y0 = lerp(bottom, top, i / steps);
        const y1 = lerp(bottom, top, (i + 1) / steps);
        g.rect(x - 5, y1, 10, y0 - y1 + 0.5).fill(dialColour((i + 0.5) / steps));
      }
      const my = lerp(bottom, top, t);
      g.circle(x, my, 9).fill(0xffffff).stroke({ width: 3, color: INK });
    }
  }
}

/** A blend of two 0xRRGGBB colours, k from 0 (all a) to 1 (all b). */
function mixColour(a: number, b: number, k: number): number {
  const ch = (shift: number) => Math.round(((a >> shift) & 255) * (1 - k) + ((b >> shift) & 255) * k);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}
