import { get } from 'svelte/store';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEG, HEAD } from './geometry';
import { FRONT_SECTOR, reachAt, type Lengths } from './hair';
import { TAP, TAP_HIT, controlAt, DIAL_HIT, BOTTLE_HIT, BOTTLE_SCALE, DIAL, SHELF_BOARD, SHELF_PRODUCTS, bottleHeight, onDial, productAt } from './sinkLayout';
import { BUBBLE_COUNT, foamLayout } from './washfx';
import { tapAngle } from './backdrop';
import {
  commitWash,
  initialState,
  salon,
  selectProduct,
  setPressure,
  setStage,
  squirtProduct,
  setTemperature,
  waterRunning,
  washLevels,
} from '../state';

const ALL = (l: Lengths['front']): Lengths => ({ front: l, left: l, right: l, back: l });

describe('lather layout', () => {
  it('is deterministic for a seed and has the same count whatever the cut', () => {
    expect(foamLayout(ALL('bob'), 6)).toEqual(foamLayout(ALL('bob'), 6));
    expect(foamLayout(ALL('back'), 6)).toHaveLength(BUBBLE_COUNT);
    expect(foamLayout(ALL('short3'), 6)).toHaveLength(BUBBLE_COUNT);
  });

  it('keeps off her face: at the front it only sits above the brows', () => {
    for (const len of ['back', 'bob', 'short3'] as const) {
      for (const b of foamLayout(ALL(len), 6)) {
        if (Math.abs(b.az) < FRONT_SECTOR) expect(b.y).toBeLessThanOrEqual(-40);
      }
    }
  });

  it('stays on the hair: never below where it ends, nor above the crown', () => {
    const lengths: Lengths = { front: 'short3', left: 'bob', right: 'short2', back: 'shoulders' };
    for (const b of foamLayout(lengths, 6)) {
      expect(b.y).toBeGreaterThanOrEqual(-(HEAD.ry + 6));
      if (Math.abs(b.az) >= FRONT_SECTOR) expect(b.y).toBeLessThanOrEqual(Math.max(reachAt(b.az, lengths) - 12, -HEAD.ry + 8) + 1e-9);
    }
  });

  it('builds up bubble by bubble: thresholds cover 0 to 1', () => {
    const t = foamLayout(ALL('bob'), 6).map((b) => b.threshold);
    expect(Math.min(...t)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...t)).toBeLessThan(1.01);
    expect(t.filter((v) => v < 0.5).length).toBeGreaterThan(BUBBLE_COUNT / 3);
  });

  it('puts lather on every side of the head', () => {
    const azs = foamLayout(ALL('shoulders'), 6).map((b) => b.az);
    expect(azs.some((a) => Math.abs(a) < 45 * DEG)).toBe(true);
    expect(azs.some((a) => a > 60 * DEG && a < 120 * DEG)).toBe(true);
    expect(azs.some((a) => a < -60 * DEG && a > -120 * DEG)).toBe(true);
    expect(azs.some((a) => Math.abs(a) > 150 * DEG)).toBe(true);
  });
});

describe('the sink scene', () => {
  it('picks the bottle under a tap, and nothing elsewhere', () => {
    for (const [name, b] of Object.entries(SHELF_PRODUCTS)) expect(productAt(b.x, b.baseY - 20)).toBe(name);
    expect(productAt(200, 250)).toBeUndefined();
    expect(productAt(SHELF_PRODUCTS.mint.x, SHELF_PRODUCTS.mint.baseY + 40)).toBeUndefined();
  });

  it('has no overlapping bottle targets', () => {
    const items = Object.values(SHELF_PRODUCTS);
    for (const a of items) {
      for (const b of items) {
        if (a !== b && a.baseY === b.baseY) expect(Math.abs(a.x - b.x)).toBeGreaterThan(30);
      }
    }
  });

  it('draws the bottles 1.5 times bigger, side by side on the shelf without touching their neighbours', () => {
    expect(BOTTLE_SCALE).toBe(1.5);
    expect(bottleHeight(1)).toBeCloseTo(51);
    const row = [SHELF_PRODUCTS.mint, SHELF_PRODUCTS.citrus, SHELF_PRODUCTS.tropical];
    for (let i = 1; i < row.length; i++) expect(row[i].x - row[i - 1].x).toBeGreaterThan(18 * BOTTLE_SCALE);
    for (const b of Object.values(SHELF_PRODUCTS)) {
      expect(b.x - 9 * BOTTLE_SCALE).toBeGreaterThan(SHELF_BOARD.x);
      expect(b.x + 9 * BOTTLE_SCALE).toBeLessThan(SHELF_BOARD.x + SHELF_BOARD.width);
      expect(BOTTLE_HIT.halfW).toBeGreaterThanOrEqual(9 * BOTTLE_SCALE);
    }
  });

  it('keeps the shelf clear of her head', () => {
    expect(SHELF_BOARD.x + SHELF_BOARD.width).toBeLessThan(HEAD.cx - HEAD.rx);
  });

  it('draws the dial 50% bigger than before (radius 24 became 36), with the target grown to match', () => {
    expect(DIAL.r).toBe(24 * 1.5);
    expect(DIAL_HIT).toBe(38 * 1.5);
    expect(DIAL.x + DIAL.r + 9).toBeLessThan(400);
  });

  it('has a pressure tap above the dial, clear of her head, whose target never swallows the dial\'s centre', () => {
    expect(TAP.y + TAP.r + 6).toBeLessThan(DIAL.y - DIAL.r - 9);
    expect(TAP.x - TAP_HIT).toBeGreaterThan(HEAD.cx + HEAD.rx);
    expect(controlAt(TAP.x, TAP.y)).toBe('tap');
    expect(controlAt(DIAL.x, DIAL.y)).toBe('dial');
    expect(controlAt(200, 450)).toBeUndefined();
    // Where the two targets overlap, the nearer centre wins.
    for (let y = TAP.y; y <= DIAL.y; y += 2) {
      const x = (TAP.x + DIAL.x) / 2;
      const dt = Math.hypot(x - TAP.x, y - TAP.y);
      const dd = Math.hypot(x - DIAL.x, y - DIAL.y);
      if (dt <= TAP_HIT && dd <= DIAL_HIT) expect(controlAt(x, y)).toBe(dt <= dd ? 'tap' : 'dial');
    }
  });

  it('turns the tap handle from off (down and left) round to full (down and right)', () => {
    expect(tapAngle(0)).toBeCloseTo((135 * Math.PI) / 180);
    expect(tapAngle(1)).toBeCloseTo((405 * Math.PI) / 180);
    expect(tapAngle(0.5)).toBeGreaterThan(tapAngle(0));
  });

  it('finds the dial with a generous target', () => {
    expect(onDial(DIAL.x, DIAL.y)).toBe(true);
    expect(onDial(DIAL.x + 30, DIAL.y)).toBe(true);
    expect(onDial(DIAL.x + 60, DIAL.y)).toBe(false);
    expect(onDial(200, 300)).toBe(false);
  });

  it('keeps the dial clear of the bottles and the head', () => {
    for (const b of Object.values(SHELF_PRODUCTS)) expect(Math.abs(DIAL.x - b.x)).toBeGreaterThan(100);
    expect(DIAL.x - DIAL_HIT).toBeGreaterThan(HEAD.cx + HEAD.rx);
  });
});

describe('the pressure tap in the store', () => {
  beforeEach(() => salon.set(initialState()));

  it('starts off, so no water runs until the tap is turned on', () => {
    expect(get(salon).wash.pressure).toBe(0);
    expect(waterRunning(get(salon))).toBe(false);
  });

  it('runs the water the moment the tap goes above off, with no button, and stops it when turned back to off', () => {
    setPressure(0.1);
    expect(waterRunning(get(salon))).toBe(true);
    setPressure(1);
    expect(waterRunning(get(salon))).toBe(true);
    setPressure(0);
    expect(waterRunning(get(salon))).toBe(false);
  });

  it('keeps running until it is turned off, whatever else changes', () => {
    setPressure(0.4);
    setTemperature(0.9);
    selectProduct('citrus');
    squirtProduct();
    setPressure(0.2);
    expect(waterRunning(get(salon))).toBe(true);
  });

  it('turns the tap off when she leaves the sink, and it stays off when she comes back', () => {
    setPressure(0.6);
    setStage('colour');
    expect(get(salon).wash.pressure).toBe(0);
    expect(waterRunning(get(salon))).toBe(false);
    setStage('wash');
    expect(waterRunning(get(salon))).toBe(false);
  });

  it('does not run water away from the sink even if the tap value were left up', () => {
    setPressure(0.5);
    expect(waterRunning({ ...get(salon), stage: 'cut' })).toBe(false);
  });

  it('counts each squirt of product', () => {
    expect(get(salon).wash.squirts).toBe(0);
    squirtProduct();
    squirtProduct();
    expect(get(salon).wash.squirts).toBe(2);
  });
});

describe('washing controls in the store', () => {
  beforeEach(() => salon.set(initialState()));

  it('starts at warm, tap off, mint, nothing running, hair dry', () => {
    const s = get(salon);
    expect(s.wash).toEqual({ temperature: 0.5, pressure: 0, product: 'mint', squirts: 0 });
    expect(washLevels(s)).toEqual({ wet: 0, foam: 0, cream: 0, clean: 0.4, conditioned: 0 });
  });

  it('keeps the dial and pressure within 0 to 1', () => {
    setTemperature(3);
    expect(get(salon).wash.temperature).toBe(1);
    setTemperature(-2);
    expect(get(salon).wash.temperature).toBe(0);
    setPressure(9);
    expect(get(salon).wash.pressure).toBe(1);
  });

  it('selects products and ignores repeats', () => {
    selectProduct('conditioner');
    const before = get(salon);
    selectProduct('conditioner');
    expect(get(salon)).toBe(before);
    expect(before.wash.product).toBe('conditioner');
  });

  it('stores the wash levels once and leaves the state alone if they are unchanged', () => {
    commitWash({ wet: 1, foam: 0.5, cream: 0, clean: 0.7, conditioned: 0.2 });
    expect(washLevels(get(salon))).toEqual({ wet: 1, foam: 0.5, cream: 0, clean: 0.7, conditioned: 0.2 });
    const before = get(salon);
    commitWash(washLevels(before));
    expect(get(salon)).toBe(before);
  });


});

describe('the shower head', () => {
  it('rests aimed at her crown, and moves along with a finger further sideways than up and down', async () => {
    const { sprayerPose } = await import('./sprayer');
    const { SPRAY_TARGET, SPRAYER } = await import('./sinkLayout');
    const rest = sprayerPose(SPRAY_TARGET.x, SPRAY_TARGET.y);
    expect(rest.x).toBe(SPRAYER.x);
    expect(rest.y).toBe(SPRAYER.y);
    const left = sprayerPose(SPRAY_TARGET.x - 60, SPRAY_TARGET.y);
    const right = sprayerPose(SPRAY_TARGET.x + 60, SPRAY_TARGET.y);
    expect(left.x).toBeLessThan(rest.x);
    expect(right.x).toBeGreaterThan(rest.x);
    expect(Math.abs(left.y - rest.y)).toBeLessThan(1e-9);
    // Always pointing at where the finger is.
    for (const p of [left, right, rest]) {
      expect(p.x + Math.cos(p.angle) * Math.hypot(p.aimX - p.x, p.aimY - p.y)).toBeCloseTo(p.aimX, 5);
    }
  });
});
