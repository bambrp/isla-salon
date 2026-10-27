import { describe, expect, it } from 'vitest';
import {
  HAIR_SWATCHES,
  OMBRE_START,
  OMBRE_STEPS,
  blendBands,
  blendSides,
  colourChroma,
  colourDistance,
  hairPaint,
  hexToHsl,
  hexToInt,
  hslToHex,
  intToHex,
  mixColours,
  normaliseHex,
  ombreBands,
  paintFromSides,
  paintSides,
  partnerColour,
  sameColour,
  sameSides,
  withColour,
  withMode,
  type Band,
  type HairColour,
} from './colour';

const single = (a: string, b = a): HairColour => ({ mode: 'single', a, b });

describe('hex parsing', () => {
  it('normalises short, long, upper-case and hash-less forms', () => {
    expect(normaliseHex('#ABC')).toBe('#aabbcc');
    expect(normaliseHex('abc')).toBe('#aabbcc');
    expect(normaliseHex('#FFD84A')).toBe('#ffd84a');
    expect(normaliseHex('  ffd84a ')).toBe('#ffd84a');
  });

  it('rejects anything that is not a colour', () => {
    for (const bad of ['', '#', '#12', '#12345', '#1234567', 'red', '#ggg', 'rgb(1,2,3)']) {
      expect(normaliseHex(bad)).toBeNull();
    }
  });

  it('round-trips between hex and an integer, and falls back safely on junk', () => {
    expect(hexToInt('#ffd84a')).toBe(0xffd84a);
    expect(intToHex(0xffd84a)).toBe('#ffd84a');
    expect(intToHex(0x000fff)).toBe('#000fff');
    expect(hexToInt('not a colour')).toBe(hexToInt('#ffd84a'));
  });

  it('compares colours ignoring case, hash and short form', () => {
    expect(sameColour('#FFF', 'ffffff')).toBe(true);
    expect(sameColour('#ffd84a', '#ffd84b')).toBe(false);
    expect(sameColour('nope', 'nope')).toBe(false);
  });
});

describe('HSL', () => {
  it('converts the primaries', () => {
    expect(hslToHex(0, 100, 50)).toBe('#ff0000');
    expect(hslToHex(120, 100, 50)).toBe('#00ff00');
    expect(hslToHex(240, 100, 50)).toBe('#0000ff');
    expect(hslToHex(0, 0, 100)).toBe('#ffffff');
    expect(hslToHex(0, 0, 0)).toBe('#000000');
  });

  it('wraps hue and clamps saturation and lightness', () => {
    expect(hslToHex(360, 100, 50)).toBe(hslToHex(0, 100, 50));
    expect(hslToHex(-120, 100, 50)).toBe(hslToHex(240, 100, 50));
    expect(hslToHex(10, 500, 50)).toBe(hslToHex(10, 100, 50));
    expect(hslToHex(10, 50, 500)).toBe('#ffffff');
  });

  it('round-trips every swatch to within one step per channel', () => {
    for (const { hex } of HAIR_SWATCHES) {
      const { h, s, l } = hexToHsl(hex);
      const back = hexToInt(hslToHex(h, s, l));
      const orig = hexToInt(hex);
      for (const shift of [16, 8, 0]) {
        expect(Math.abs(((back >> shift) & 255) - ((orig >> shift) & 255))).toBeLessThanOrEqual(1);
      }
    }
  });

  it('reports greys as zero saturation', () => {
    expect(hexToHsl('#808080').s).toBe(0);
  });
});

describe('mixing', () => {
  it('returns the end colours exactly at t = 0 and t = 1', () => {
    expect(mixColours(0xffd84a, 0x3a86ff, 0)).toBe(0xffd84a);
    expect(mixColours(0xffd84a, 0x3a86ff, 1)).toBe(0x3a86ff);
  });

  it('mixing a colour with itself changes nothing', () => {
    for (const t of [0.2, 0.5, 0.8]) {
      const mixed = mixColours(0x9b5de5, 0x9b5de5, t);
      for (const shift of [16, 8, 0]) {
        expect(Math.abs(((mixed >> shift) & 255) - ((0x9b5de5 >> shift) & 255))).toBeLessThanOrEqual(1);
      }
    }
  });

  it('moves steadily away from the first colour and towards the second', () => {
    const a = 0xffd84a;
    const b = 0x9b5de5;
    let prevFromA = 0;
    let prevToB = Infinity;
    for (let i = 1; i <= 9; i++) {
      const m = mixColours(a, b, i / 10);
      const fromA = colourDistance(a, m);
      const toB = colourDistance(m, b);
      expect(fromA).toBeGreaterThan(prevFromA);
      expect(toB).toBeLessThan(prevToB);
      prevFromA = fromA;
      prevToB = toB;
    }
  });

  it('stays vivid between opposite colours instead of dipping into grey', () => {
    // Blonde and purple are close to opposite: a straight line between them would pass through a dull mauve.
    const a = 0xffd84a;
    const b = 0x9b5de5;
    const floor = Math.min(colourChroma(a), colourChroma(b));
    for (const t of [0.2, 0.4, 0.5, 0.6, 0.8]) {
      expect(colourChroma(mixColours(a, b, t))).toBeGreaterThan(floor * 0.85);
    }
  });

  it('blending towards a grey simply fades the colour out, keeping its hue', () => {
    const red = 0xff3b4e;
    const grey = 0x808080;
    const mid = mixColours(red, grey, 0.5);
    expect(colourChroma(mid)).toBeLessThan(colourChroma(red));
    expect(colourChroma(mid)).toBeGreaterThan(colourChroma(grey));
    // still reddish: red channel clearly above blue
    expect(((mid >> 16) & 255) - (mid & 255)).toBeGreaterThan(20);
  });

  it('never produces a channel outside 0 to 255, for any pair of swatches at any step', () => {
    for (const x of HAIR_SWATCHES) {
      for (const y of HAIR_SWATCHES) {
        for (let i = 0; i <= 10; i++) {
          const m = mixColours(hexToInt(x.hex), hexToInt(y.hex), i / 10);
          expect(m).toBeGreaterThanOrEqual(0);
          expect(m).toBeLessThanOrEqual(0xffffff);
          expect(Number.isInteger(m)).toBe(true);
        }
      }
    }
  });

  it('measures black against white as far apart and a colour against itself as zero', () => {
    expect(colourDistance(0x000000, 0xffffff)).toBeGreaterThan(0.9);
    expect(colourDistance(0xff6fb1, 0xff6fb1)).toBe(0);
  });
});

describe('swatches', () => {
  it('has valid, unique, clearly different colours with names', () => {
    const names = new Set<string>();
    for (const sw of HAIR_SWATCHES) {
      expect(normaliseHex(sw.hex)).toBe(sw.hex);
      expect(sw.name.length).toBeGreaterThan(0);
      names.add(sw.name);
    }
    expect(names.size).toBe(HAIR_SWATCHES.length);
    for (let i = 0; i < HAIR_SWATCHES.length; i++) {
      for (let j = i + 1; j < HAIR_SWATCHES.length; j++) {
        const d = colourDistance(hexToInt(HAIR_SWATCHES[i].hex), hexToInt(HAIR_SWATCHES[j].hex));
        expect(d, `${HAIR_SWATCHES[i].name} vs ${HAIR_SWATCHES[j].name}`).toBeGreaterThan(0.05);
      }
    }
  });

  it("includes Isla's starting colour", () => {
    expect(HAIR_SWATCHES.some((s) => s.hex === '#ffd84a')).toBe(true);
  });

  it('fills 17 slots, leaving one cell in three rows of six for the mix-your-own button', () => {
    expect(HAIR_SWATCHES).toHaveLength(17);
  });
});

describe('changing colour', () => {
  it('gives the second slot a clearly different colour when switching to split or ombre', () => {
    for (const { hex } of HAIR_SWATCHES) {
      for (const mode of ['split', 'ombre'] as const) {
        const next = withMode(single(hex), mode);
        expect(next.mode).toBe(mode);
        expect(next.a).toBe(hex);
        expect(colourDistance(hexToInt(next.a), hexToInt(next.b)), `${hex} -> ${mode}`).toBeGreaterThan(0.12);
      }
    }
  });

  it('keeps a second colour the player already chose', () => {
    const next = withMode(single('#ffd84a', '#9b5de5'), 'split');
    expect(next.b).toBe('#9b5de5');
  });

  it('keeps both colours when going back to a single colour, so switching loses nothing', () => {
    const split = withMode(single('#ffd84a'), 'split');
    const back = withMode(split, 'single');
    expect(back).toEqual({ mode: 'single', a: '#ffd84a', b: split.b });
    expect(withMode(back, 'ombre').b).toBe(split.b);
  });

  it('returns the same object when the mode is unchanged', () => {
    const c = single('#ffd84a');
    expect(withMode(c, 'single')).toBe(c);
  });

  it('partner colours are always pink or blue', () => {
    expect(['#ff6fb1', '#3a86ff']).toContain(partnerColour('#2ed3a5'));
    expect(partnerColour('#ff6fb1')).toBe('#3a86ff');
    expect(partnerColour('#3a86ff')).toBe('#ff6fb1');
  });

  it('sets a slot, normalising the input, and ignores invalid or unchanged colours', () => {
    const c = single('#ffd84a');
    expect(withColour(c, 'a', '#F00').a).toBe('#ff0000');
    expect(withColour(c, 'b', '3a86ff').b).toBe('#3a86ff');
    expect(withColour(c, 'a', 'banana')).toBe(c);
    expect(withColour(c, 'a', '#FFD84A')).toBe(c);
  });
});

describe('paint', () => {
  const split: HairColour = { mode: 'split', a: '#ff0000', b: '#0000ff' };

  it("single colour: every lock and both brows use colour a", () => {
    const p = hairPaint(single('#ff0000'));
    expect(p.bands(1)).toEqual([{ u0: 0, u1: 1, colour: 0xff0000 }]);
    expect(p.bands(-2.5)).toEqual(p.bands(1));
    expect(p.root(1)).toBe(0xff0000);
    expect(p.root(-1)).toBe(0xff0000);
  });

  it('split: a is the Left half as seen from the front (negative azimuth), b the Right, and the brows follow', () => {
    const p = hairPaint(split);
    expect(p.bands(-0.13)[0].colour).toBe(0xff0000);
    expect(p.bands(-Math.PI / 2)[0].colour).toBe(0xff0000);
    expect(p.bands(0.13)[0].colour).toBe(0x0000ff);
    expect(p.bands(Math.PI)[0].colour).toBe(0x0000ff);
    expect(p.root(-1)).toBe(0xff0000);
    expect(p.root(1)).toBe(0x0000ff);
    expect(p.sheen(-0.5)).toBe(0xff0000);
    expect(p.sheen(0.5)).toBe(0x0000ff);
  });

  it('split: colours depend only on which side a lock is rooted, so every lock has exactly one colour', () => {
    const p = hairPaint(split);
    for (let deg = -180; deg <= 180; deg += 7.5) {
      if (deg === 0) continue;
      const bands = p.bands((deg * Math.PI) / 180);
      expect(bands).toHaveLength(1);
      expect(bands[0].colour).toBe(deg < 0 ? 0xff0000 : 0x0000ff);
    }
  });

  it('puts the Left colour on the screen-left in the front view and the screen-right from behind', () => {
    // A lock rooted at azimuth az sits at screen x proportional to sin(az - phi) for a view turned by phi.
    const p = hairPaint(split);
    const screenX = (az: number, phi: number) => Math.sin(az - phi);
    for (const deg of [-150, -90, -60, -30, 30, 60, 90, 150]) {
      const az = (deg * Math.PI) / 180;
      const isLeftColour = p.bands(az)[0].colour === 0xff0000;
      if (Math.abs(deg) < 90) expect(screenX(az, 0) < 0).toBe(isLeftColour); // front view: the Left colour is on the screen-left
      if (Math.abs(deg) > 90) expect(screenX(az, Math.PI) > 0).toBe(isLeftColour); // back view: it is on the screen-right
    }
  });

  it('ombre: roots are a, tips are b, and the brows and highlight use the roots', () => {
    const p = hairPaint({ mode: 'ombre', a: '#ffd84a', b: '#9b5de5' });
    const bands = p.bands(0.3);
    expect(bands[0].colour).toBe(0xffd84a);
    expect(bands[bands.length - 1].colour).toBe(0x9b5de5);
    expect(p.root(1)).toBe(0xffd84a);
    expect(p.root(-1)).toBe(0xffd84a);
    expect(p.sheen(2)).toBe(0xffd84a);
    // the same bands for every lock: the blend follows each lock's own length
    expect(p.bands(-2)).toBe(bands);
  });
});

describe('ombre bands', () => {
  const bands = ombreBands(0xffd84a, 0x9b5de5);

  it('has one more band than steps', () => {
    expect(bands).toHaveLength(OMBRE_STEPS + 1);
  });

  it('tiles 0 to 1 exactly, with no gaps or overlaps, in order', () => {
    expect(bands[0].u0).toBe(0);
    expect(bands[bands.length - 1].u1).toBe(1);
    for (let i = 1; i < bands.length; i++) expect(bands[i].u0).toBe(bands[i - 1].u1);
    for (const b of bands) expect(b.u1).toBeGreaterThan(b.u0);
  });

  it('keeps the roots their own colour for the top of each lock', () => {
    expect(bands[0].u1).toBeGreaterThan(OMBRE_START);
    expect(bands[0].colour).toBe(0xffd84a);
  });

  it('steps at a similar pace from roots to tips, so no step is a jump and none is invisible', () => {
    const steps = bands.slice(1).map((b, i) => colourDistance(bands[i].colour, b.colour));
    const mean = steps.reduce((x, y) => x + y, 0) / steps.length;
    for (const s of steps) {
      expect(s).toBeGreaterThan(mean * 0.6);
      expect(s).toBeLessThan(mean * 1.4);
    }
  });

  it('makes a blend between identical colours a single visible colour', () => {
    const same = ombreBands(0xff6fb1, 0xff6fb1);
    for (const b of same) expect(colourDistance(b.colour, 0xff6fb1)).toBeLessThan(0.01);
  });
});

describe('paint sides', () => {
  it('hairPaint is exactly paintFromSides of paintSides', () => {
    for (const c of [
      single('#ff0000'),
      { mode: 'split', a: '#ff0000', b: '#0000ff' } as HairColour,
      { mode: 'ombre', a: '#ffd84a', b: '#9b5de5' } as HairColour,
    ]) {
      const direct = hairPaint(c);
      const viaSides = paintFromSides(paintSides(c));
      for (const az of [-3, -1, -0.1, 0.1, 1, 3]) expect(direct.bands(az)).toEqual(viaSides.bands(az));
      expect(direct.root(-1)).toBe(viaSides.root(-1));
      expect(direct.sheen(2)).toBe(viaSides.sheen(2));
    }
  });

  it('sameSides spots an invisible change but not a visible one', () => {
    // in single mode the hidden second colour changes nothing you can see
    expect(sameSides(paintSides(single('#ff0000', '#0000ff')), paintSides(single('#ff0000', '#00ff00')))).toBe(true);
    expect(sameSides(paintSides(single('#ff0000')), paintSides(single('#ff0001')))).toBe(false);
  });
});

describe('fading between looks', () => {
  const red = 0xff0000;
  const blue = 0x0000ff;
  const plain = (colour: number): Band[] => [{ u0: 0, u1: 1, colour }];
  const tiles = (bands: Band[]) => {
    expect(bands[0].u0).toBe(0);
    expect(bands[bands.length - 1].u1).toBe(1);
    for (let i = 1; i < bands.length; i++) expect(bands[i].u0).toBe(bands[i - 1].u1);
    for (const b of bands) expect(b.u1).toBeGreaterThan(b.u0);
  };

  it('is exactly the start at 0 and exactly the end at 1', () => {
    const from = plain(red);
    const to = ombreBands(0xffd84a, 0x9b5de5);
    expect(blendBands(from, to, 0)).toBe(from);
    expect(blendBands(from, to, 1)).toBe(to);
    expect(blendBands(from, to, -1)).toBe(from);
    expect(blendBands(from, to, 2)).toBe(to);
  });

  it('keeps a fade between two plain colours as one flat band, passing between the two', () => {
    const mid = blendBands(plain(red), plain(blue), 0.5);
    expect(mid).toHaveLength(1);
    expect(mid[0]).toMatchObject({ u0: 0, u1: 1 });
    const d = colourDistance(red, blue);
    expect(colourDistance(mid[0].colour, red)).toBeGreaterThan(d * 0.3);
    expect(colourDistance(mid[0].colour, blue)).toBeGreaterThan(d * 0.3);
  });

  it('moves steadily: a later point in the fade is always closer to the end than an earlier one', () => {
    let prev = Infinity;
    for (let t = 0.1; t < 1; t += 0.1) {
      const d = colourDistance(blendBands(plain(red), plain(blue), t)[0].colour, blue);
      expect(d).toBeLessThan(prev);
      prev = d;
    }
  });

  it('tiles 0 to 1 exactly for every pairing of looks, at every point in the fade', () => {
    const looks = [
      paintSides(single('#ffd84a')),
      paintSides({ mode: 'split', a: '#ff6fb1', b: '#3a86ff' }),
      paintSides({ mode: 'ombre', a: '#7a4a2a', b: '#ff6fb1' }),
    ];
    for (const from of looks) {
      for (const to of looks) {
        for (const t of [0.05, 0.25, 0.5, 0.75, 0.95]) {
          const s = blendSides(from, to, t);
          tiles(s.left);
          tiles(s.right);
          for (const bands of [s.left, s.right]) {
            expect(bands.length).toBeLessThanOrEqual(OMBRE_STEPS + 1);
            for (const b of bands) expect(Number.isInteger(b.colour) && b.colour >= 0 && b.colour <= 0xffffff).toBe(true);
          }
        }
      }
    }
  });

  it('fades a single colour into an ombre by growing the tips band by band', () => {
    const from = plain(0xffd84a);
    const to = ombreBands(0xffd84a, 0x9b5de5);
    const mid = blendBands(from, to, 0.5);
    // roots barely change, tips have moved about half way
    expect(colourDistance(mid[0].colour, 0xffd84a)).toBeLessThan(0.01);
    const tipsEnd = colourDistance(to[to.length - 1].colour, 0xffd84a);
    expect(colourDistance(mid[mid.length - 1].colour, 0xffd84a)).toBeGreaterThan(tipsEnd * 0.35);
    expect(colourDistance(mid[mid.length - 1].colour, 0xffd84a)).toBeLessThan(tipsEnd * 0.65);
  });

  it('blends each side of a split on its own, so a split can become a single colour without crossing over', () => {
    const from = paintSides({ mode: 'split', a: '#ff0000', b: '#0000ff' });
    const to = paintSides(single('#ff0000'));
    const mid = blendSides(from, to, 0.5);
    expect(mid.left[0].colour).toBe(0xff0000); // the red half is red throughout
    expect(mid.right[0].colour).not.toBe(0x0000ff); // the blue half is on its way to red
    expect(mid.right[0].colour).not.toBe(0xff0000);
  });
});
