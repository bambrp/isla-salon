import { describe, expect, it } from 'vitest';
import { colourDistance, hairPaint, ombreBands, paintSides, type HairColour } from './colour';
import { COLOUR_FADE_SECONDS, ColourFade } from './colourFade';

const single = (a: string, b = a): HairColour => ({ mode: 'single', a, b });
const split: HairColour = { mode: 'split', a: '#ff6fb1', b: '#3a86ff' };
const ombre: HairColour = { mode: 'ombre', a: '#ffd84a', b: '#9b5de5' };

/** The colour of the roots on one side, as it would be drawn right now. */
const roots = (f: ColourFade, side: -1 | 1) => f.paint().root(side);

describe('ColourFade', () => {
  it('fades over one second', () => {
    expect(COLOUR_FADE_SECONDS).toBe(1);
  });

  it('starts settled on its first colour, with nothing to fade', () => {
    const f = new ColourFade(single('#ffd84a'));
    expect(f.progress).toBe(1);
    expect(f.paint().bands(1)).toEqual(hairPaint(single('#ffd84a')).bands(1));
  });

  it('starts a fade when the look changes, from exactly the old look', () => {
    const f = new ColourFade(single('#ffd84a'));
    expect(f.retarget(single('#3a86ff'))).toBe(true);
    expect(f.progress).toBe(0);
    expect(roots(f, 1)).toBe(0xffd84a);
  });

  it('ends exactly on the new look, with no leftover blend bands', () => {
    const f = new ColourFade(single('#ffd84a'));
    f.retarget(ombre);
    f.progress = 1;
    expect(f.current()).toEqual(paintSides(ombre));
    f.retarget(split);
    f.progress = 1;
    expect(f.current()).toEqual(paintSides(split));
    expect(f.paint().bands(0.5)).toHaveLength(1);
  });

  it('passes through colours between the two on the way', () => {
    const f = new ColourFade(single('#ff0000'));
    f.retarget(single('#0000ff'));
    f.progress = 0.5;
    const mid = roots(f, 1);
    expect(colourDistance(mid, 0xff0000)).toBeGreaterThan(0.1);
    expect(colourDistance(mid, 0x0000ff)).toBeGreaterThan(0.1);
  });

  it('ignores a change nobody can see', () => {
    const f = new ColourFade(single('#ffd84a', '#ff0000'));
    expect(f.retarget(single('#ffd84a', '#00ff00'))).toBe(false);
    expect(f.progress).toBe(1);
  });

  it('does not restart for the same look again, even mid-fade', () => {
    const f = new ColourFade(single('#ffd84a'));
    f.retarget(single('#3a86ff'));
    f.progress = 0.4;
    expect(f.retarget(single('#3a86ff'))).toBe(false);
    expect(f.progress).toBe(0.4);
  });

  it('a change part-way through starts from the colour on screen, so nothing jumps', () => {
    const f = new ColourFade(single('#ffd84a'));
    f.retarget(single('#3a86ff'));
    f.progress = 0.6;
    const before = roots(f, 1);
    expect(f.retarget(single('#ff3b4e'))).toBe(true);
    expect(f.progress).toBe(0);
    expect(roots(f, 1)).toBe(before);
    // and it carries on towards the newest colour
    f.progress = 1;
    expect(roots(f, 1)).toBe(0xff3b4e);
  });

  it('stays the same size however many changes pile up mid-fade (dragging a slider)', () => {
    const f = new ColourFade(ombre);
    for (let i = 0; i < 300; i++) {
      f.retarget({ mode: 'ombre', a: '#ffd84a', b: `#${(0x100000 + i * 3000).toString(16).padStart(6, '0')}` });
      f.progress = 0.37;
    }
    const s = f.current();
    expect(s.left.length).toBeLessThanOrEqual(ombreBands(0, 1).length);
    expect(s.right.length).toBeLessThanOrEqual(ombreBands(0, 1).length);
  });

  it('finish() jumps straight to the target', () => {
    const f = new ColourFade(single('#ffd84a'));
    f.retarget(split);
    f.finish();
    expect(f.progress).toBe(1);
    expect(f.current()).toEqual(paintSides(split));
  });

  it('can fade between any two modes and back without errors', () => {
    const looks = [single('#ffd84a'), split, ombre];
    const f = new ColourFade(looks[0]);
    for (const to of [...looks, ...looks.slice().reverse()]) {
      f.retarget(to);
      for (const p of [0, 0.3, 0.7, 1]) {
        f.progress = p;
        const paint = f.paint();
        for (const az of [-2, -0.5, 0.5, 2]) {
          const bands = paint.bands(az);
          expect(bands[0].u0).toBe(0);
          expect(bands[bands.length - 1].u1).toBe(1);
        }
      }
    }
  });
});
