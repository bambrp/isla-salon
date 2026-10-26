/**
 * How the hair is styled, as numbers the hair builder can use and the scene can tween between.
 *
 * Curl runs from 0 (straight) to 3 (tight curls). Flat is the product look, running from 0 (none) to 1 (fully
 * applied); it is a number so that changing to or from it passes smoothly through the plain look in between.
 */
export interface Look {
  curl: number;
  flat: number;
}

export type CurlLevel = 0 | 1 | 2 | 3;
export type StyleProduct = 'none' | 'flat';

export const NO_LOOK: Look = { curl: 0, flat: 0 };

export const CURL_LABELS: Record<CurlLevel, string> = { 0: 'Straight', 1: 'Waves', 2: 'Curls', 3: 'Tight curls' };

export function lookOf(curl: CurlLevel, product: StyleProduct): Look {
  return { curl, flat: product === 'flat' ? 1 : 0 };
}

export function sameLook(a: Look, b: Look): boolean {
  return a.curl === b.curl && a.flat === b.flat;
}
