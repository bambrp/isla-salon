import type { Product } from './wash';

/**
 * Where the working parts of the sink scene sit, in design space (400 x 500). The backdrop draws them and the
 * washing layer animates and hit-tests them, so both read the numbers from here.
 */

/** The handheld sprayer's nozzle, and the spot on her crown the water is aimed at. */
export const SPRAYER = { x: 282, y: 116 } as const;
export const SPRAY_TARGET = { x: 214, y: 184 } as const;

/** The wall-mounted temperature dial. Press it and drag up for hotter, down for colder. */
export const DIAL = { x: 352, y: 318, r: 24 } as const;
/** How far the dial can be pressed from its centre and still count (a generous finger target). */
export const DIAL_HIT = 38;

/** Bottles on the wall shelves. Tapping one chooses it. */
export const SHELF_PRODUCTS: Record<Product, { x: number; baseY: number; tall: number; colour: number }> = {
  mint: { x: 20, baseY: 232, tall: 1.2, colour: 0x4fe3b5 },
  citrus: { x: 52, baseY: 232, tall: 1.2, colour: 0xffa62b },
  tropical: { x: 84, baseY: 232, tall: 1.2, colour: 0xff6fb1 },
  conditioner: { x: 52, baseY: 322, tall: 1.35, colour: 0xc9a7ff },
};

/** Half-width and height of a bottle's tap target around its centre line. */
export const BOTTLE_HIT = { halfW: 16, up: 62, down: 8 } as const;

/** The product tapped at a design-space point, if any. */
export function productAt(x: number, y: number): Product | undefined {
  let best: Product | undefined;
  let bestGap = Infinity;
  for (const [name, b] of Object.entries(SHELF_PRODUCTS) as [Product, (typeof SHELF_PRODUCTS)[Product]][]) {
    const dx = Math.abs(x - b.x);
    if (dx > BOTTLE_HIT.halfW || y < b.baseY - BOTTLE_HIT.up || y > b.baseY + BOTTLE_HIT.down) continue;
    if (dx < bestGap) {
      bestGap = dx;
      best = name;
    }
  }
  return best;
}

/** True if a design-space point is on the temperature dial. */
export function onDial(x: number, y: number): boolean {
  return Math.hypot(x - DIAL.x, y - DIAL.y) <= DIAL_HIT;
}
