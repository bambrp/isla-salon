import type { View } from './state';

/** The size of every photo: 4:5, the same shape as the picture of Isla, whatever size the screen is. */
export const PHOTO_WIDTH = 1080;
export const PHOTO_HEIGHT = 1350;

/** A file name such as isla-front-2026-10-21-0730.png. */
export function photoName(view: View, when: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const day = `${when.getFullYear()}-${p(when.getMonth() + 1)}-${p(when.getDate())}`;
  return `isla-${view}-${day}-${p(when.getHours())}${p(when.getMinutes())}.png`;
}

/** The parts of the browser a save needs, so the logic can be tested without one. */
export interface SaveEnv {
  navigator: Pick<Navigator, 'userAgent' | 'maxTouchPoints'> & {
    platform?: string;
    canShare?: (data: ShareData) => boolean;
    share?: (data: ShareData) => Promise<void>;
  };
  document: Pick<Document, 'createElement'> & { body: Pick<HTMLElement, 'appendChild' | 'removeChild'> };
  url: Pick<typeof URL, 'createObjectURL' | 'revokeObjectURL'>;
}

/** iPhones and iPads (including iPads that pretend to be Macs), where saving a download is unreliable. */
export function isIOS(nav: SaveEnv['navigator']): boolean {
  if (/iPad|iPhone|iPod/.test(nav.userAgent)) return true;
  return nav.platform === 'MacIntel' && nav.maxTouchPoints > 1;
}

export type SaveResult = 'shared' | 'downloaded' | 'cancelled';

/**
 * Give the player their photo. On iOS the share sheet is the dependable way to save a picture, so it is tried
 * first there; if sharing isn't available or fails, and everywhere else, the photo downloads as a file.
 */
export async function savePhoto(blob: Blob, name: string, env?: SaveEnv): Promise<SaveResult> {
  const e: SaveEnv = env ?? { navigator, document, url: URL };
  const file = new File([blob], name, { type: 'image/png' });

  if (isIOS(e.navigator) && e.navigator.share && e.navigator.canShare?.({ files: [file] })) {
    try {
      await e.navigator.share({ files: [file], title: "Isla's Salon" });
      return 'shared';
    } catch (err) {
      // Closing the share sheet is a choice, not a failure.
      if ((err as { name?: string })?.name === 'AbortError') return 'cancelled';
    }
  }

  const href = e.url.createObjectURL(blob);
  const a = e.document.createElement('a') as HTMLAnchorElement;
  a.href = href;
  a.download = name;
  a.rel = 'noopener';
  e.document.body.appendChild(a);
  a.click();
  e.document.body.removeChild(a);
  // Give the browser a moment to start the download before the address goes away.
  setTimeout(() => e.url.revokeObjectURL(href), 10000);
  return 'downloaded';
}
