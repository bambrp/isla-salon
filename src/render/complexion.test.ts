import { describe, expect, it } from 'vitest';
import { CALM, MOOD_FADE_SECONDS, MOOD_RISE_SECONDS, isCalm, moodTarget, stepMood, tintedSkin, type Mood } from './complexion';

const run = (m: Mood, seconds: number, target: Mood): Mood => {
  let out = m;
  const dt = 1 / 60;
  for (let t = 0; t < seconds - 1e-9; t += dt) out = stepMood(out, dt, target);
  return out;
};

describe('the face the water works towards', () => {
  it('stays as she is while the water is off, and for warm water', () => {
    expect(moodTarget(false, 1)).toEqual(CALM);
    expect(moodTarget(false, 0)).toEqual(CALM);
    expect(moodTarget(true, 0.5)).toEqual(CALM);
  });

  it('turns pink above warm, more so the hotter it gets', () => {
    const a = moodTarget(true, 0.65).tone;
    const b = moodTarget(true, 0.8).tone;
    const c = moodTarget(true, 1).tone;
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThanOrEqual(b);
  });

  it('is only annoyed at the hottest', () => {
    expect(moodTarget(true, 0.8).annoyed).toBe(0);
    expect(moodTarget(true, 1).annoyed).toBe(1);
  });

  it('turns blue for cold water, the colder the bluer', () => {
    expect(moodTarget(true, 0.4).tone).toBeCloseTo(-0.0, 1);
    expect(moodTarget(true, 0.2).tone).toBeLessThan(0);
    expect(moodTarget(true, 0).tone).toBe(-1);
    expect(moodTarget(true, 0).annoyed).toBe(0);
  });
});

describe('the fade', () => {
  it('comes up in about a second while the water runs', () => {
    const m = run(CALM, MOOD_RISE_SECONDS, { tone: 1, annoyed: 1, clench: 0 });
    expect(m.tone).toBeCloseTo(1, 1);
    expect(run(CALM, 0.5, { tone: 1, annoyed: 0, clench: 0 }).tone).toBeCloseTo(0.5, 1);
  });

  it('fades back over three seconds once the water stops, not sooner', () => {
    const full: Mood = { tone: 1, annoyed: 1, clench: 0 };
    expect(run(full, 1.5, CALM).tone).toBeCloseTo(0.5, 1);
    expect(isCalm(run(full, MOOD_FADE_SECONDS + 0.05, CALM))).toBe(true);
    expect(isCalm(run(full, MOOD_FADE_SECONDS - 0.3, CALM))).toBe(false);
  });

  it('fades slowly too when the water is merely made gentler', () => {
    const m = run({ tone: 1, annoyed: 1, clench: 0 }, 1, { tone: 0.4, annoyed: 0, clench: 0 });
    expect(m.tone).toBeGreaterThan(0.6);
  });

  it('goes back through her own colour when it swings from pink to blue', () => {
    const m = run({ tone: 0.6, annoyed: 0, clench: 0 }, 0.5, { tone: -1, annoyed: 0, clench: 0 });
    expect(m.tone).toBeGreaterThan(0);
    expect(m.tone).toBeLessThan(0.6);
  });

  it('never overshoots', () => {
    for (const m of [run(CALM, 5, { tone: 0.7, annoyed: 0.2, clench: 0 }), run({ tone: 1, annoyed: 1, clench: 0 }, 7, CALM)]) {
      expect(Math.abs(m.tone)).toBeLessThanOrEqual(1);
      expect(m.annoyed).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('the skin colour', () => {
  const skin = 0xffd6b0;
  const channels = (c: number) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];

  it('is her own at rest', () => {
    expect(tintedSkin(skin, 0)).toBe(skin);
  });

  it('is pinker when hot, and bluer when cold', () => {
    const [r0, g0, b0] = channels(skin);
    const [r1, g1, b1] = channels(tintedSkin(skin, 1));
    expect(g1).toBeLessThan(g0);
    expect(b1).toBeLessThan(b0);
    expect(r1).toBeGreaterThanOrEqual(r0 - 1);
    const [r2, , b2] = channels(tintedSkin(skin, -1));
    expect(b2).toBeGreaterThan(r2);
    expect(r2).toBeLessThan(r0);
  });

  it('changes smoothly with the tone', () => {
    expect(tintedSkin(skin, 0.5)).not.toBe(tintedSkin(skin, 1));
    expect(tintedSkin(skin, 0.5)).not.toBe(skin);
  });
});

describe('clenched teeth against the cold', () => {
  it('clench only at the very coldest setting, not for merely cool water', () => {
    expect(moodTarget(true, 0).clench).toBe(1);
    expect(moodTarget(true, 0.06).clench).toBeGreaterThan(0);
    expect(moodTarget(true, 0.06).clench).toBeLessThan(1);
    expect(moodTarget(true, 0.2).clench).toBe(0);
    expect(moodTarget(true, 0.8).clench).toBe(0);
  });
  it('no clench with the water off, and it comes up in a second and fades in three', () => {
    expect(moodTarget(false, 0).clench).toBe(0);
    const cold = moodTarget(true, 0);
    let m: Mood = CALM;
    for (let i = 0; i < 10; i++) m = stepMood(m, 0.1, cold);
    expect(m.clench).toBeCloseTo(1, 1);
    for (let i = 0; i < 15; i++) m = stepMood(m, 0.1, CALM);
    expect(m.clench).toBeCloseTo(0.5, 1);
    for (let i = 0; i < 20; i++) m = stepMood(m, 0.1, CALM);
    expect(isCalm(m)).toBe(true);
  });
});
