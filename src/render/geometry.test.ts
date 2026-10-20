import { describe, expect, it } from 'vitest';
import { DEG, HEAD, facing, mulberry32, project, smoothstep, surface, torsoScale, viewAngle } from './geometry';

describe('projection', () => {
  it('puts the face straight ahead in the front view', () => {
    const p = project(0, 0, HEAD.rz, 0);
    expect(p.sx).toBeCloseTo(HEAD.cx);
    expect(p.d).toBeGreaterThan(0);
  });

  it('turns the face to screen-left in the left view and screen-right in the right view', () => {
    expect(project(0, 0, HEAD.rz, viewAngle('left')).sx).toBeLessThan(HEAD.cx - 60);
    expect(project(0, 0, HEAD.rz, viewAngle('right')).sx).toBeGreaterThan(HEAD.cx + 60);
  });

  it('hides the face in the back view', () => {
    expect(project(0, 0, HEAD.rz, viewAngle('back')).d).toBeLessThan(0);
  });

  it("shows the character's left side (+x) to the viewer in the left view", () => {
    expect(project(HEAD.rx, 0, 0, viewAngle('left')).d).toBeGreaterThan(0);
    expect(project(-HEAD.rx, 0, 0, viewAngle('left')).d).toBeLessThan(0);
  });

  it('keeps x and z lengths: a full turn returns to the start', () => {
    const a = project(30, -10, 40, 0);
    const b = project(30, -10, 40, 2 * Math.PI);
    expect(b.sx).toBeCloseTo(a.sx);
    expect(b.d).toBeCloseTo(a.d);
  });
});

describe('head surface', () => {
  it('lies on the ellipsoid', () => {
    const p = surface(30 * DEG, 20);
    const v = (p.x / HEAD.rx) ** 2 + (p.y / HEAD.ry) ** 2 + (p.z / HEAD.rz) ** 2;
    expect(v).toBeCloseTo(1, 5);
  });

  it('faces the viewer at the front and away at the back', () => {
    expect(facing(surface(0, 0), 0)).toBeCloseTo(1, 3);
    expect(facing(surface(Math.PI, 0), 0)).toBeCloseTo(-1, 3);
  });
});

describe('helpers', () => {
  it('torso is widest front-on and narrowest side-on', () => {
    expect(torsoScale(0)).toBeCloseTo(1);
    expect(torsoScale(Math.PI / 2)).toBeLessThan(0.6);
  });

  it('smoothstep clamps and is monotonic', () => {
    expect(smoothstep(0, 1, -1)).toBe(0);
    expect(smoothstep(0, 1, 2)).toBe(1);
    expect(smoothstep(0, 1, 0.6)).toBeGreaterThan(smoothstep(0, 1, 0.4));
  });

  it('mulberry32 is deterministic', () => {
    const a = mulberry32(6);
    const b = mulberry32(6);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});
