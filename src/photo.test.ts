import { describe, expect, it, vi } from 'vitest';
import { PHOTO_HEIGHT, PHOTO_WIDTH, isIOS, photoName, savePhoto, type SaveEnv } from './photo';

const blob = new Blob(['x'], { type: 'image/png' });

function env(nav: Partial<SaveEnv['navigator']> = {}) {
  const clicks: Array<{ href: string; download: string }> = [];
  const a = {
    href: '',
    download: '',
    rel: '',
    click() {
      clicks.push({ href: this.href, download: this.download });
    },
  };
  const e: SaveEnv = {
    navigator: { userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome', maxTouchPoints: 0, ...nav },
    document: { createElement: () => a as unknown as HTMLAnchorElement, body: { appendChild: vi.fn(), removeChild: vi.fn() } } as unknown as SaveEnv['document'],
    url: { createObjectURL: () => 'blob:abc', revokeObjectURL: vi.fn() },
  };
  return { e, clicks };
}

describe('photo', () => {
  it('is 4:5', () => {
    expect(PHOTO_WIDTH / PHOTO_HEIGHT).toBeCloseTo(4 / 5);
  });

  it('names the file with the view and the time', () => {
    expect(photoName('isla', 'front', 'salon', new Date(2026, 9, 21, 7, 5))).toBe('isla-front-salon-2026-10-21-0705.png');
    expect(photoName('kenji', 'left', 'beach', new Date(2026, 11, 3, 23, 59))).toBe('kenji-left-beach-2026-12-03-2359.png');
  });

  it('spots iPhones, iPads and iPads posing as Macs, but not other devices', () => {
    expect(isIOS({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', maxTouchPoints: 5 })).toBe(true);
    expect(isIOS({ userAgent: 'Mozilla/5.0 (Macintosh)', platform: 'MacIntel', maxTouchPoints: 5 })).toBe(true);
    expect(isIOS({ userAgent: 'Mozilla/5.0 (Macintosh)', platform: 'MacIntel', maxTouchPoints: 0 })).toBe(false);
    expect(isIOS({ userAgent: 'Mozilla/5.0 (Linux; Android 14)', maxTouchPoints: 5 })).toBe(false);
  });

  it('downloads on a computer or Android phone', async () => {
    const { e, clicks } = env();
    expect(await savePhoto(blob, 'a.png', e)).toBe('downloaded');
    expect(clicks).toEqual([{ href: 'blob:abc', download: 'a.png' }]);
  });

  it('uses the share sheet on iOS', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const { e, clicks } = env({ userAgent: 'iPhone', canShare: () => true, share });
    expect(await savePhoto(blob, 'a.png', e)).toBe('shared');
    expect(share).toHaveBeenCalledOnce();
    expect(clicks).toEqual([]);
  });

  it('treats closing the share sheet as cancelled, not a failure, and does not download', async () => {
    const share = vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'AbortError' }));
    const { e, clicks } = env({ userAgent: 'iPhone', canShare: () => true, share });
    expect(await savePhoto(blob, 'a.png', e)).toBe('cancelled');
    expect(clicks).toEqual([]);
  });

  it('falls back to a download if sharing breaks or is missing on iOS', async () => {
    const broken = env({ userAgent: 'iPhone', canShare: () => true, share: vi.fn().mockRejectedValue(new Error('nope')) });
    expect(await savePhoto(blob, 'a.png', broken.e)).toBe('downloaded');
    const missing = env({ userAgent: 'iPhone' });
    expect(await savePhoto(blob, 'a.png', missing.e)).toBe('downloaded');
    const cannot = env({ userAgent: 'iPhone', canShare: () => false, share: vi.fn() });
    expect(await savePhoto(blob, 'a.png', cannot.e)).toBe('downloaded');
  });
});
