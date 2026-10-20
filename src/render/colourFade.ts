import {
  blendSides,
  paintFromSides,
  paintSides,
  sameSides,
  type HairColour,
  type HairPaint,
  type PaintSides,
} from './colour';

/** How long a change of hair colour takes to fade in, in seconds. */
export const COLOUR_FADE_SECONDS = 1;

/**
 * The hair colour as it appears on screen while it fades from one look to the next.
 *
 * The scene tweens `progress` from 0 to 1 and redraws with `paint()`. If the colour changes again part-way
 * (dragging a slider does this constantly), the new fade starts from whatever is showing at that moment, so
 * nothing ever jumps, and the work stays the same size however many changes pile up.
 */
export class ColourFade {
  /** 0 = still showing the previous look, 1 = fully on the new one. */
  progress = 1;
  private from: PaintSides;
  private to: PaintSides;

  constructor(colour: HairColour) {
    this.from = this.to = paintSides(colour);
  }

  /** The look on screen right now. */
  current(): PaintSides {
    if (this.progress >= 1) return this.to;
    if (this.progress <= 0) return this.from;
    return blendSides(this.from, this.to, this.progress);
  }

  paint(): HairPaint {
    return paintFromSides(this.current());
  }

  /**
   * Aim at a new colour. Returns true if the look will actually change, meaning a fade should run now; a change
   * nobody can see (such as the hidden second colour in single mode) returns false and leaves things alone.
   */
  retarget(colour: HairColour): boolean {
    const next = paintSides(colour);
    if (sameSides(next, this.to)) return false;
    this.from = this.current();
    this.to = next;
    this.progress = 0;
    return true;
  }

  /** Jump straight to the target, for people who prefer reduced motion. */
  finish(): void {
    this.from = this.to;
    this.progress = 1;
  }
}
