import { Graphics, GraphicsContext, buildContextBatches } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { drawBackdrop } from './backdrop';
import { withoutRepeats } from './hair';

/** Build the triangles Pixi would send to the graphics card, and report any vertex that is not a finite number. */
function scan(g: Graphics): { bad: number; total: number; sample: number[][] } {
  const ctx = (g as unknown as { context: GraphicsContext }).context;
  const gpu = { batches: [] as unknown[], geometryData: { vertices: [] as number[], indices: [] as number[], uvs: [] as number[] } };
  buildContextBatches(ctx, gpu as never);
  let bad = 0, total = 0;
  const sample: number[][] = [];
  const v = gpu.geometryData.vertices;
  for (let i = 0; i + 1 < v.length; i += 2) {
    total++;
    if (!Number.isFinite(v[i]) || !Number.isFinite(v[i + 1])) { bad++; if (sample.length < 5) sample.push([i / 2, v[i], v[i + 1]]); }
  }
  return { bad, total, sample };
}

/*
 * Phone graphics chips draw a broken (NaN) vertex as a line to the picture's corner, while desktop chips skip it, so
 * the stray-lines bug only showed on phones. This builds the same triangles Pixi sends and checks every one is a number.
 */
describe('geometry sent to the graphics card', () => {
  for (const scene of ['sink', 'mirror'] as const) {
    it(`backdrop ${scene} has only finite vertices`, () => {
      const g = new Graphics();
      drawBackdrop(g, scene);
      const r = scan(g);
      expect(r.bad).toBe(0);
    });
  }
});

describe('withoutRepeats', () => {
  it('drops a repeated point, and a last point that repeats the first', () => {
    expect(withoutRepeats([0, 0, 0, 0, 5, 0, 5, 5, 0, 0])).toEqual([0, 0, 5, 0, 5, 5]);
  });
  it('drops points that are not finite', () => {
    expect(withoutRepeats([0, 0, NaN, 1, 4, 4, 8, 0])).toEqual([0, 0, 4, 4, 8, 0]);
  });
});
