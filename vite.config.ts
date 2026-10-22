import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

/**
 * Writes dist/sw.js after the build: a service worker that keeps every file of this exact build in the browser, so the
 * game opens and plays with no network. The list of files and a hash of their contents are filled in here, so each
 * new build gets its own cache and the old one is deleted when the new worker takes over.
 */
function offlineWorker(): Plugin {
  let outDir = 'dist';
  return {
    name: 'islas-salon-offline-worker',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      const files: string[] = [];
      const walk = (dir: string): void => {
        for (const name of readdirSync(dir)) {
          const full = join(dir, name);
          if (statSync(full).isDirectory()) walk(full);
          else files.push(relative(outDir, full).split('\\').join('/'));
        }
      };
      walk(outDir);
      const precache = files.filter((f) => f !== 'sw.js' && f !== '_headers').sort();
      const hash = createHash('sha256');
      for (const f of precache) hash.update(f).update(readFileSync(join(outDir, f)));
      const version = hash.digest('hex').slice(0, 12);
      const template = readFileSync(new URL('./src/sw.template.js', import.meta.url), 'utf8');
      writeFileSync(
        join(outDir, 'sw.js'),
        template.replace('__VERSION__', version).replace('__FILES__', JSON.stringify(['./', ...precache])),
      );
    },
  };
}

export default defineConfig({
  plugins: [svelte(), offlineWorker()],
  base: './',
  build: { target: 'es2020' },
  test: { environment: 'node' },
});
