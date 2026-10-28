import { Graphics, GraphicsContext, buildContextBatches } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import {
  BROW_HEIGHTS, DEFAULT_FEATURES, EYE_COLOURS, FACE_SHAPES, SKIN_TONES, browLift, browLineY, browTop, browWidth,
  cleanFeatures, facePoints, noseScale, noseStandOut, NOSE_SCALE_MAX, BROW_WIDTH_MAX, type Brows,
} from './features';
import { drawCharacter } from './render/character';
import { buildLocks } from './render/hair';
import { hairPaint } from './render/colour';
import { DEG } from './render/geometry';
import { initialState, makeCharacter, ISLA } from './state';

function vertices(g: Graphics): number[] {
  const gpu = { batches: [] as unknown[], geometryData: { vertices: [] as number[], indices: [] as number[], uvs: [] as number[] } };
  buildContextBatches((g as unknown as { context: GraphicsContext }).context, gpu as never);
  return gpu.geometryData.vertices;
}

const BROW_SETS: Brows[] = [];
for (const height of BROW_HEIGHTS)
  for (const thickness of [0, 0.5, 1])
    for (const arch of [0, 0.5, 1])
      for (const spacing of [0, 0.5, 1]) BROW_SETS.push({ height, thickness, arch, spacing });

describe('feature data', () => {
  it('has nine distinct skin tones, palest first, and Isla keeps her exact colour', () => {
    expect(SKIN_TONES).toHaveLength(9);
    expect(new Set(SKIN_TONES.map((t) => t.hex)).size).toBe(9);
    const lum = (h: number) => 0.3 * (h >> 16) + 0.59 * ((h >> 8) & 255) + 0.11 * (h & 255);
    // Pink and rosy are deliberately about as light as pale, so only check the run from slight tan down (rosy is pinker, not darker).
    const deep = SKIN_TONES.slice(4).map((t) => lum(t.hex));
    expect([...deep].sort((a, b) => b - a)).toEqual(deep);
    expect(SKIN_TONES.find((t) => t.id === 'pale')!.hex).toBe(ISLA.skin);
  });
  it('has four eye colours', () => {
    expect(EYE_COLOURS.map((e) => e.id)).toEqual(['blue', 'green', 'hazel', 'brown']);
    expect(EYE_COLOURS[0].hex).toBe(ISLA.eyes);
  });
  it('holds stray values in range', () => {
    const f = cleanFeatures({ nose: NaN, adamsApple: 1 as never, brows: { thickness: 9, arch: -3, height: 'x' as never, spacing: Infinity }, face: 'pear' as never });
    expect(f).toEqual({ nose: 0, adamsApple: true, brows: { thickness: 1, arch: 0, height: 'mid', spacing: 0 }, face: 'oval' });
  });
  it('makes Isla from the defaults', () => {
    expect(ISLA.nose).toBe(DEFAULT_FEATURES.nose);
    expect(ISLA.face).toBe('oval');
    expect(browLift(ISLA.brows)).toBe(0);
    expect(noseScale(0.5)).toBeCloseTo(1);
  });
});

describe('brows', () => {
  it('sit higher for high than mid than low, and arch lifts the middle', () => {
    const y = (height: Brows['height']) => browLineY({ ...DEFAULT_FEATURES.brows, height }, 0);
    expect(y('high')).toBeLessThan(y('mid'));
    expect(y('mid')).toBeLessThan(y('low'));
    const flat = browLineY({ ...DEFAULT_FEATURES.brows, arch: 0 }, 0.5);
    const arched = browLineY({ ...DEFAULT_FEATURES.brows, arch: 1 }, 0.5);
    expect(arched).toBeLessThan(flat);
  });
  it('stay clear of the eye along the middle of the brow, at any setting', () => {
    for (const b of BROW_SETS)
      for (let k = 5; k <= 11; k++) expect(browLineY(b, k / 16) + browWidth(b) / 2).toBeLessThanOrEqual(-13.5 + 1e-6);
  });
  it('ask the hair to give room only when higher than Isla\'s', () => {
    expect(browLift({ ...DEFAULT_FEATURES.brows, height: 'low' })).toBe(0);
    expect(browLift({ ...DEFAULT_FEATURES.brows, height: 'high', arch: 1, thickness: 1 })).toBeGreaterThan(0);
  });
});

describe('face shapes', () => {
  it('keep the top of the face the same as the oval so the hair fits every one', () => {
    const oval = facePoints('oval', 70, 88);
    for (const shape of FACE_SHAPES) {
      const p = facePoints(shape, 70, 88);
      expect(p).toHaveLength(oval.length);
      for (let i = 0; i < p.length; i += 2) if (oval[i + 1] <= 0) { expect(p[i]).toBeCloseTo(oval[i]); expect(p[i + 1]).toBeCloseTo(oval[i + 1]); }
    }
  });
  it('are all finite with no repeated neighbours', () => {
    for (const shape of FACE_SHAPES)
      for (const hw of [30, 50, 78]) {
        const p = facePoints(shape, hw, 88);
        expect(p.every(Number.isFinite)).toBe(true);
        for (let i = 2; i < p.length; i += 2) expect(p[i] === p[i - 2] && p[i + 1] === p[i - 1]).toBe(false);
      }
  });
  it('stay soft: no shape reaches further than 10 per cent beyond the oval', () => {
    for (const shape of FACE_SHAPES) for (const v of facePoints(shape, 70, 88).filter((_, i) => i % 2 === 0)) expect(Math.abs(v)).toBeLessThan(70 * 1.1);
  });
});

describe('hair and brows', () => {
  it('hair never reaches the brows or eyes, for every brow setting and every uniform cut', () => {
    const problems: string[] = [];
    const cuts = [0, 1, 2, 3, 4, 5, 6, 7];
    for (const b of BROW_SETS) {
      const lift = browLift(b);
      const top = browTop(b);
      for (const p of cuts) {
        for (const lock of buildLocks({ front: p, left: p, right: p, back: p }, 6, undefined, lift)) {
          if (Math.abs(lock.a0) >= 0.9) continue;
          for (const s of lock.samples) {
            if (s.y < top - 1) continue;
            if (Math.abs(s.a) - s.hw < 40 * DEG) problems.push(`${b.height}/${b.arch}/${b.thickness} cut ${p} lock ${lock.index} y=${s.y.toFixed(1)} top=${top.toFixed(1)}`);
          }
        }
      }
    }
    expect(problems.slice(0, 5)).toEqual([]);
  });
});

describe('drawing every feature', () => {
  it('sends only finite vertices for all shapes, brow settings, noses, tones and views', () => {
    let bad = 0, drawn = 0;
    const locks = buildLocks({ front: 4, left: 2, right: 2, back: 1 }, 3);
    for (const face of FACE_SHAPES)
      for (const b of [BROW_SETS[0], BROW_SETS[13], BROW_SETS[26], BROW_SETS[40], BROW_SETS[53]])
        for (const nose of [0, 0.5, 1])
          for (const adamsApple of [false, true])
            for (const skin of [SKIN_TONES[0].hex, SKIN_TONES[8].hex])
              for (let d = 0; d < 360; d += 45) {
                const c = makeCharacter({ id: 't', name: 'T', face, nose, adamsApple, skin, brows: b });
                const g = new Graphics();
                drawCharacter(g, initialState(c), d * DEG, locks, hairPaint(initialState(c).hair.colour) as never, d % 90 === 0 ? 0 : 0.5, { tone: -0.5, annoyed: 0.5, clench: 0.6 });
                const v = vertices(g);
                drawn++;
                for (const x of v) if (!Number.isFinite(x)) bad++;
              }
    expect(drawn).toBeGreaterThan(1000);
    expect(bad).toBe(0);
  }, 120000);
});

describe('hot and cold colouring', () => {
  it('only ever changes skin colours: never whites, ink, irises, blush or brows', async () => {
    const { PALETTE, INK } = await import('./render/style');
    const { browColour } = await import('./render/character');
    const fills = (tone: number): Array<[number, number]> => {
      const state = initialState(makeCharacter({ id: 't', name: 'T', adamsApple: true }));
      const g = new Graphics();
      drawCharacter(g, state, 0.4, buildLocks({ front: 4, left: 4, right: 4, back: 4 }, 6), hairPaint(state.hair.colour) as never, 0, { tone, annoyed: 0, clench: 0 });
      const out: Array<[number, number]> = [];
      for (const ins of (g as unknown as { context: { instructions: Array<{ action: string; data: { style: { color: number; alpha: number } } }> } }).context.instructions)
        if (ins.action === 'fill' || ins.action === 'stroke') out.push([ins.data.style.color, ins.data.style.alpha]);
      return out;
    };
    const calm = fills(0);
    const protectedColours = new Set<number>([0xffffff, INK, PALETTE.blush, ISLA.eyes, browColour(ISLA.hair)]);
    for (const tone of [-1, -0.5, 0.5, 1]) {
      const warm = fills(tone);
      expect(warm).toHaveLength(calm.length);
      let changed = 0;
      for (let i = 0; i < calm.length; i++) {
        if (calm[i][0] === warm[i][0] && calm[i][1] === warm[i][1]) continue;
        changed++;
        expect(protectedColours.has(calm[i][0]), `fill ${i} colour ${calm[i][0].toString(16)} changed at tone ${tone}`).toBe(false);
        expect(calm[i][1]).toBe(warm[i][1]);
      }
      expect(changed).toBeGreaterThan(0);
    }
  });
});

describe('largest nose and thickest brow', () => {
  it('make the largest nose 75 per cent bigger and the thickest brow 75 per cent thicker, with the middle and the small end unchanged', () => {
    expect(noseScale(1)).toBeCloseTo(1.35 * 1.75);
    expect(noseScale(1)).toBe(NOSE_SCALE_MAX);
    expect(noseScale(0.5)).toBeCloseTo(1);
    expect(noseScale(0)).toBeCloseTo(0.65);
    expect(noseStandOut(0.5)).toBe(0);
    expect(noseStandOut(0)).toBeCloseTo(-5);
    expect(noseStandOut(1)).toBeCloseTo(5 * 1.75);
    const mid = { ...DEFAULT_FEATURES.brows };
    expect(browWidth({ ...mid, thickness: 1 })).toBeCloseTo(5.5 * 1.75);
    expect(browWidth({ ...mid, thickness: 1 })).toBe(BROW_WIDTH_MAX);
    expect(browWidth({ ...mid, thickness: 0.5 })).toBeCloseTo(4);
    expect(browWidth({ ...mid, thickness: 0 })).toBeCloseTo(2.5);
  });
  it('grow steadily with no jump at the middle', () => {
    let pn = -1, pw = -1;
    for (let i = 0; i <= 100; i++) {
      const n = noseScale(i / 100), w = browWidth({ ...DEFAULT_FEATURES.brows, thickness: i / 100 });
      expect(n).toBeGreaterThan(pn);
      expect(w).toBeGreaterThan(pw);
      if (i > 0) { expect(n - pn).toBeLessThan(0.05); expect(w - pw).toBeLessThan(0.12); }
      pn = n; pw = w;
    }
  });
  it('leaves everyone in the cast looking as they did', async () => {
    const { CAST } = await import('./cast');
    const oldNose: Record<string, number> = { mateo: 0.6, leo: 0.6, tom: 0.7 };
    const oldThick: Record<string, number> = { amara: 0.6, kenji: 0.55, mateo: 0.65, priya: 0.6, leo: 0.55, noor: 0.7, tom: 0.7 };
    for (const m of CAST) {
      const c = m.character;
      const on = oldNose[c.id] ?? c.nose;
      expect(noseScale(c.nose)).toBeCloseTo(0.65 + 0.7 * on, 1);
      const ot = oldThick[c.id] ?? c.brows.thickness;
      expect(browWidth(c.brows)).toBeCloseTo(2.5 + 3 * ot, 1);
    }
  });
});

describe('brow spacing', () => {
  const B = (spacing: number, thickness = 0.5): Brows => ({ ...DEFAULT_FEATURES.brows, spacing, thickness });
  it('moves only the inner end: the outer end never moves', async () => {
    const { browStartDeg, browSpanDeg, BROW_OUTER_DEG } = await import('./features');
    for (const th of [0, 0.5, 1])
      for (let i = 0; i <= 20; i++) expect(browStartDeg(B(i / 20, th)) + browSpanDeg(B(i / 20, th))).toBeCloseTo(BROW_OUTER_DEG);
  });
  it('touches at the closest setting, sits where it did in the middle, and is wide apart at the far end', async () => {
    const { browStartDeg, browWidth } = await import('./features');
    for (const th of [0, 0.5, 1]) {
      const w = browWidth(B(0, th));
      // Each inner edge is half a brow from the centre line, so the gap between the brows' inner edges is zero.
      const innerEdge = 77 * Math.sin((browStartDeg(B(0, th)) * Math.PI) / 180) - w / 2;
      expect(Math.abs(innerEdge)).toBeLessThan(0.05);
    }
    expect(browStartDeg(B(0.5))).toBeCloseTo(12);
    expect(browStartDeg(B(1))).toBeCloseTo(20);
    let prev = -1;
    for (let i = 0; i <= 100; i++) { const a = browStartDeg(B(i / 100)); expect(a).toBeGreaterThan(prev); prev = a; }
  });
  it('leaves everyone in the cast with their inner end where it was', async () => {
    const { CAST } = await import('./cast');
    const { browStartDeg } = await import('./features');
    const old: Record<string, number> = { amara: 0.5, kenji: 0.55, mateo: 0.4, priya: 0.5, leo: 0.6, noor: 0.45, tom: 0.35, grace: 0.55 };
    for (const m of CAST) if (old[m.character.id] !== undefined) expect(browStartDeg(m.character.brows)).toBeCloseTo(12 + (old[m.character.id] - 0.5) * 10, 0);
  });
});
