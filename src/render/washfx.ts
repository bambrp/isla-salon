import type { Graphics } from 'pixi.js';
import { DEG, HEAD, clamp, lerp, mulberry32, project, smoothstep } from './geometry';
import { FRONT_SECTOR, reachAt, type Lengths } from './hair';
import { DIAL, SHELF_PRODUCTS, SPRAYER, SPRAY_TARGET, bottleHeight } from './sinkLayout';
import { dialColour } from './backdrop';
import { INK } from './style';
import { isShampoo, isShiny, streamFor, waterLook, type Applying, type Product, type WashLevels } from './wash';

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
export function foamLayout(lengths: Lengths, seed: number): Bubble[] {
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
const CREAM = { fill: 0xfff4fb, rim: 0xc9a7ff };

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

/** Conditioner as flat creamy blobs that sag into short drips, a different look from the round lather. */
function drawCream(g: Graphics, bubbles: Bubble[], level: number, phi: number): void {
  if (level <= 0.01) return;
  const shown = bubbles
    .filter((b) => level > b.threshold)
    .map((b) => ({ b, ...onHead(b, phi) }))
    .filter((p) => p.d > -14)
    .sort((a, c) => a.d - c.d);
  for (const { b, x, y } of shown) {
    const grow = smoothstep(b.threshold, b.threshold + 0.2, level);
    const r = b.r * (0.6 + 0.4 * level) * grow;
    const drip = r * (0.8 + 1.6 * level);
    g.roundRect(x - r * 0.35, y, r * 0.7, drip, r * 0.35).fill(CREAM.fill).stroke({ width: 1.4, color: INK });
    g.ellipse(x, y, r * 1.35, r * 0.8).fill(CREAM.fill).stroke({ width: 1.6, color: INK });
    g.ellipse(x - r * 0.3, y - r * 0.2, r * 0.45, r * 0.22).fill({ color: CREAM.rim, alpha: 0.55 });
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

export interface FxContext {
  applying: Applying;
  product: Product;
  pressure: number;
  temperature: number;
  levels: WashLevels;
  phi: number;
  /** Screen positions where hair ends on the near side, for drips. */
  tips: ReadonlyArray<{ x: number; y: number }>;
  bubbles: Bubble[];
  /** True while a finger is on the dial, which shows the scale. */
  dragging: boolean;
}

const MAX_PARTICLES = 240;

export class WashFx {
  private parts: Particle[] = [];
  private rand = mulberry32(99);
  private carry = { splash: 0, drip: 0, steam: 0, chill: 0, accent: 0 };
  time = 0;

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
          x: SPRAY_TARGET.x + (r() - 0.5) * 30,
          y: SPRAY_TARGET.y + (r() - 0.5) * 8,
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
      for (let i = this.due('accent', 16, dt); i > 0; i--) {
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
    const scent = isShampoo(c.product) ? (c.product as keyof typeof SCENT) : 'mint';
    // Lather keeps the colour of the shampoo it came from, so the last shampoo used decides it.
    drawFoam(g, c.bubbles, c.levels.foam, c.phi, this.lastScent(scent, c), this.time);
    drawCream(g, c.bubbles, c.levels.cream, c.phi);

    const look = waterLook(c.temperature);
    const water = c.applying === 'water';
    const fade = this.ramp(water);
    this.tint(g, look, fade);
    if (water) this.stream(g, c, look.tint);
    this.particles(g);
    if (isShiny(c.levels)) this.sparkle(g, c.phi);

    this.sinkControls(g, c);
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
    const dx = SPRAY_TARGET.x - SPRAYER.x;
    const dy = SPRAY_TARGET.y - SPRAYER.y;
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
      const x0 = SPRAYER.x + ux * tail + nx * fan(tail);
      const y0 = SPRAYER.y + uy * tail + ny * fan(tail);
      const x1 = SPRAYER.x + ux * head + nx * fan(head);
      const y1 = SPRAYER.y + uy * head + ny * fan(head);
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
    const b = SHELF_PRODUCTS[c.product];
    const h = bottleHeight(b.tall);
    const bob = Math.sin(this.time * 4) * 1.5;
    g.roundRect(b.x - 21, b.baseY - h - 21 + bob, 42, h + 27, 11).stroke({ width: 6, color: INK });
    g.roundRect(b.x - 21, b.baseY - h - 21 + bob, 42, h + 27, 11).stroke({ width: 3, color: 0xffffff });

    // Lever: points from the centre round the scale, cold on the left to hot on the right.
    const t = clamp(c.temperature, 0, 1);
    const ang = (-125 + 250 * t - 90) * DEG;
    const lx = DIAL.x + Math.cos(ang) * (DIAL.r - 3);
    const ly = DIAL.y + Math.sin(ang) * (DIAL.r - 3);
    g.circle(DIAL.x, DIAL.y, DIAL.r - 5).fill(0xf4f8fb).stroke({ width: 3, color: INK });
    g.moveTo(DIAL.x, DIAL.y).lineTo(lx, ly).stroke({ width: 10, color: INK, cap: 'round' });
    g.moveTo(DIAL.x, DIAL.y).lineTo(lx, ly).stroke({ width: 5.5, color: dialColour(t), cap: 'round' });
    g.circle(DIAL.x, DIAL.y, 4.5).fill(0xffd84a).stroke({ width: 2, color: INK });

    if (c.dragging) {
      const x = DIAL.x - 62;
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
