import { describe, expect, it } from 'vitest';
import {
  isShiny,
  sameLevels,
  stepWash,
  streamFor,
  temperatureBand,
  waterLook,
  LOAD_PER_SQUIRT,
  rinseSpeed,
  CONDITION_SWIPES,
  conditionSwipe,
  stepWashLoad,
  type WashInput,
  type WashLevels,
} from './wash';

const DRY: WashLevels = { wet: 0, foam: 0, cream: 0, clean: 0.4, conditioned: 0 };
const input = (over: Partial<WashInput>): WashInput => ({
  applying: null,
  product: 'mint',
  temperature: 0.5,
  pressure: 0.5,
  rub: 1,
  load: 99,
  ...over,
});

function run(l: WashLevels, seconds: number, i: WashInput): WashLevels {
  let cur = l;
  for (let k = 0; k < seconds * 60; k++) cur = stepWash(cur, 1 / 60, i);
  return cur;
}

describe('washing the hair', () => {
  it('does nothing when nothing is held', () => {
    expect(stepWash(DRY, 1, input({}))).toEqual(DRY);
  });

  it('soaks the hair with water, faster under pressure', () => {
    const soft = run(DRY, 1, input({ applying: 'water', pressure: 0 }));
    const hard = run(DRY, 1, input({ applying: 'water', pressure: 1 }));
    expect(soft.wet).toBeGreaterThan(0.2);
    expect(hard.wet).toBeGreaterThan(soft.wet);
    expect(run(DRY, 3, input({ applying: 'water' })).wet).toBe(1);
  });

  it('builds lather and cleans with shampoo, and never leaves 0 to 1', () => {
    const l = run({ ...DRY, wet: 1 }, 5, input({ applying: 'product', product: 'citrus' }));
    expect(l.foam).toBe(1);
    expect(l.clean).toBe(1);
  });

  it('lathers faster on wet hair than dry', () => {
    const dry = run(DRY, 1, input({ applying: 'product' }));
    const wet = run({ ...DRY, wet: 1 }, 1, input({ applying: 'product' }));
    expect(wet.foam).toBeGreaterThan(dry.foam);
    expect(dry.foam).toBeGreaterThan(0);
  });

  it('gives about two thirds of a full lather from one squirt, rubbed all the way in', () => {
    let l: WashLevels = { ...DRY, wet: 1 };
    let load = LOAD_PER_SQUIRT;
    for (let k = 0; k < 60 * 20; k++) {
      const r = stepWashLoad(l, 1 / 60, input({ applying: 'product', load }));
      l = r.levels;
      load = Math.max(0, load - r.used);
    }
    expect(l.foam).toBeCloseTo(0.67, 1);
    expect(load).toBeCloseTo(0, 2);
  });

  it('only lathers while she is being rubbed, and only while there is product on her', () => {
    const still = run({ ...DRY, wet: 1 }, 2, input({ applying: 'product', rub: 0 }));
    expect(still.foam).toBe(0);
    const none = run({ ...DRY, wet: 1 }, 2, input({ applying: 'product', load: 0 }));
    expect(none.foam).toBe(0);
  });

  it('lathers faster the harder she is rubbed', () => {
    const slow = run({ ...DRY, wet: 1 }, 1, input({ applying: 'product', rub: 0.3 }));
    const brisk = run({ ...DRY, wet: 1 }, 1, input({ applying: 'product', rub: 1 }));
    expect(brisk.foam).toBeGreaterThan(slow.foam);
  });

  it('rinses the lather away with water, harder water faster', () => {
    const foamy = { ...DRY, wet: 1, foam: 1 };
    const soft = run(foamy, 1, input({ applying: 'water', pressure: 0 }));
    const hard = run(foamy, 1, input({ applying: 'water', pressure: 1 }));
    expect(hard.foam).toBeLessThan(soft.foam);
    expect(run(foamy, 4, input({ applying: 'water', pressure: 0.5 })).foam).toBe(0);
  });

  it('rinses three times faster at full pressure than at the lowest setting, both for lather and for conditioner', () => {
    expect(rinseSpeed(0)).toBe(1);
    expect(rinseSpeed(1)).toBe(3);
    expect(rinseSpeed(0.5)).toBe(2);
    const wet: WashLevels = { ...DRY, wet: 1, foam: 1, cream: 1 };
    const low = stepWash(wet, 0.1, input({ applying: 'water', pressure: 0.001 }));
    const full = stepWash(wet, 0.1, input({ applying: 'water', pressure: 1 }));
    expect((1 - full.foam) / (1 - low.foam)).toBeCloseTo(3, 1);
    expect((1 - full.cream) / (1 - low.cream)).toBeCloseTo(3, 1);
  });

  it('still rinses steadily at the lowest setting', () => {
    const wet: WashLevels = { ...DRY, wet: 1, foam: 1, cream: 1 };
    const l = run(wet, 8, input({ applying: 'water', pressure: 0.001 }));
    expect(l.foam).toBe(0);
    expect(l.cream).toBe(0);
    expect(run(wet, 1, input({ applying: 'water', pressure: 0.001 })).foam).toBeGreaterThan(0.5);
  });

  it('takes longer to rinse the gentler the water', () => {
    const wet: WashLevels = { ...DRY, wet: 1, foam: 1, cream: 1 };
    let last = -1;
    for (const p of [1, 0.75, 0.5, 0.25, 0.01]) {
      const f = run(wet, 1, input({ applying: 'water', pressure: p })).foam;
      expect(f).toBeGreaterThan(last);
      last = f;
    }
  });

  it('keeps the clean after rinsing', () => {
    const l = run({ ...DRY, wet: 1, foam: 1, clean: 1 }, 6, input({ applying: 'water' }));
    expect(l.clean).toBe(1);
  });

  it('does not rub conditioner in smoothly: only swipes (conditionSwipe) move it', () => {
    const l = run({ ...DRY, wet: 1, clean: 1 }, 4, input({ applying: 'product', product: 'conditioner' }));
    expect(l.cream).toBe(0);
    expect(l.conditioned).toBe(0);
  });

  it('lightens the hair a step with each swipe of conditioner, to the lightest on the eighth', () => {
    let l: WashLevels = { ...DRY, wet: 1, clean: 1 };
    let load = LOAD_PER_SQUIRT;
    for (let k = 1; k <= CONDITION_SWIPES; k++) {
      const r = conditionSwipe(l, load);
      l = r.levels;
      load -= r.used;
      expect(l.cream).toBeCloseTo(k / CONDITION_SWIPES, 9);
      expect(l.conditioned).toBeCloseTo(k / CONDITION_SWIPES, 9);
    }
    expect(l.cream).toBe(1);
    expect(load).toBeCloseTo(0, 9);
    // The squirt is used up: more swipes change nothing.
    expect(conditionSwipe(l, load).levels).toEqual(l);
  });

  it('does nothing without conditioner waiting, and uses only what is left of a squirt', () => {
    expect(conditionSwipe(DRY, 0).levels).toBe(DRY);
    const half = conditionSwipe(DRY, LOAD_PER_SQUIRT / CONDITION_SWIPES / 2);
    expect(half.levels.cream).toBeCloseTo(1 / CONDITION_SWIPES / 2, 9);
  });

  it('keeps the lightness until the water rinses it off, and the silkiness after', () => {
    let l: WashLevels = { ...DRY, wet: 1, clean: 1, cream: 1, conditioned: 1 };
    l = run(l, 1, input({ applying: null }));
    expect(l.cream).toBe(1);
    l = run(l, 8, input({ applying: 'water' }));
    expect(l.cream).toBe(0);
    expect(l.conditioned).toBe(1);
  });


  it('keeps every level between 0 and 1 whatever happens', () => {
    let l = DRY;
    const modes: WashInput[] = [
      input({ applying: 'water', pressure: 1 }),
      input({ applying: 'product', product: 'tropical' }),
      input({ applying: 'product', product: 'conditioner' }),
      input({ applying: null }),
    ];
    for (let k = 0; k < 2000; k++) {
      l = stepWash(l, 0.05, modes[(k >> 4) % modes.length]);
      for (const v of Object.values(l)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('only shines when freshly washed, conditioned and rinsed', () => {
    expect(isShiny({ wet: 1, foam: 0, cream: 0, clean: 1, conditioned: 1 })).toBe(true);
    expect(isShiny({ wet: 1, foam: 0.5, cream: 0, clean: 1, conditioned: 1 })).toBe(false);
    expect(isShiny({ wet: 1, foam: 0, cream: 0.5, clean: 1, conditioned: 1 })).toBe(false);
    expect(isShiny({ wet: 1, foam: 0, cream: 0, clean: 0.2, conditioned: 1 })).toBe(false);
    expect(isShiny(DRY)).toBe(false);
  });

  it('compares levels', () => {
    expect(sameLevels(DRY, { ...DRY })).toBe(true);
    expect(sameLevels(DRY, { ...DRY, foam: 0.1 })).toBe(false);
  });
});

describe('the water', () => {
  it('has three temperature bands', () => {
    expect(temperatureBand(0)).toBe('cold');
    expect(temperatureBand(0.5)).toBe('warm');
    expect(temperatureBand(1)).toBe('hot');
  });

  it('chills when cold, steams when hot, and does neither when warm', () => {
    const cold = waterLook(0);
    const warm = waterLook(0.5);
    const hot = waterLook(1);
    expect(cold.chill).toBe(1);
    expect(cold.steam).toBe(0);
    expect(warm.chill).toBe(0);
    expect(warm.steam).toBe(0);
    expect(hot.steam).toBe(1);
    expect(hot.chill).toBe(0);
    expect(new Set([cold.tint, warm.tint, hot.tint]).size).toBe(3);
  });

  it('grows more chill and steam the further the dial goes', () => {
    expect(waterLook(0.1).chill).toBeGreaterThan(waterLook(0.3).chill);
    expect(waterLook(0.95).steam).toBeGreaterThan(waterLook(0.75).steam);
  });

  it('streams harder with more pressure', () => {
    const lo = streamFor(0);
    const hi = streamFor(1);
    expect(hi.streaks).toBeGreaterThan(lo.streaks);
    expect(hi.speed).toBeGreaterThan(lo.speed);
    expect(hi.width).toBeGreaterThan(lo.width);
    expect(hi.spread).toBeGreaterThan(lo.spread);
  });
});
