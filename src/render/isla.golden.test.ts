import { Graphics, GraphicsContext, buildContextBatches } from 'pixi.js';
import { expect, it } from 'vitest';
import golden from './isla.golden.json';
import { drawCharacter } from './character';
import { buildLocks } from './hair';
import { initialState, ISLA } from '../state';
import { hairPaint } from './colour';

/** A small string hash (FNV-1a), enough to notice any change in the triangles. */
function fnv(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16);
}

/*
 * Version 2.0 made the face drawing depend on character features. Isla's features are the defaults, so she must draw exactly
 * the triangles she drew in version 1; the golden file holds a hash of them for two cuts, two moods and twelve views.
 */
it('draws Isla exactly as version 1 did', async () => {
  const out: Record<string, string> = {};
  const state = initialState(ISLA);
  const lens = [{ front: 'short3', left: 'shoulders', right: 'shoulders', back: 'shoulders' }, { front: 'short1', left: 'bob', right: 'short2', back: 'back' }];
  for (let li = 0; li < lens.length; li++)
    for (const mood of [{ tone: 0, annoyed: 0, clench: 0 }, { tone: -0.7, annoyed: 0.6, clench: 0.8 }])
      for (let d = 0; d < 360; d += 30) {
        const g = new Graphics();
        const locks = buildLocks(lens[li] as never, 6);
        drawCharacter(g, state, (d * Math.PI) / 180, locks, hairPaint(state.hair.colour) as never, 0, mood);
        const gpu = { batches: [] as unknown[], geometryData: { vertices: [] as number[], indices: [] as number[], uvs: [] as number[] } };
        buildContextBatches((g as unknown as { context: GraphicsContext }).context, gpu as never);
        out[`${li}-${mood.tone}-${d}`] = fnv(gpu.geometryData.vertices.map((v) => v.toFixed(3)).join(','));
      }
  // To refresh the golden file after a deliberate change to how she is drawn: run with VITE_UPDATE_GOLDEN=1 and copy the line printed.
  if (import.meta.env.VITE_UPDATE_GOLDEN) {
    console.log('GOLDEN ' + JSON.stringify(out));
    return;
  }
  expect(out).toEqual(golden);
});
