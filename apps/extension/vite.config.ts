import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { crx, type ManifestV3Export } from '@crxjs/vite-plugin';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { defineConfig as defineVitestConfig } from 'vitest/config';

import { createManifest } from './src/manifest.base';
import manifest from './src/manifest';

const manifestOverridePath = resolve(fileURLToPath(new URL('.', import.meta.url)), 'src', 'manifest.local.json');

async function loadManifest(): Promise<ManifestV3Export> {
  try {
    const overrideSource = await readFile(manifestOverridePath, 'utf8');
    const override = JSON.parse(overrideSource) as { matches?: unknown };

    if (!Array.isArray(override.matches) || override.matches.some((value) => typeof value !== 'string' || value.length === 0)) {
      throw new Error('apps/extension/src/manifest.local.json must contain a non-empty string array in the matches property.');
    }

    return createManifest(override.matches) as ManifestV3Export;
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
      return manifest as ManifestV3Export;
    }

    throw error;
  }
}

export default defineConfig(
  defineVitestConfig(async () => {
    const resolvedManifest = await loadManifest();

    return {
      plugins: [crx({ manifest: resolvedManifest })],
      build: {
        emptyOutDir: true,
        outDir: 'dist',
        sourcemap: true,
        target: 'es2022',
      },
      resolve: {
        alias: {
          '@blakebecker/glide-shared': fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url)),
        },
      },
      test: {
        environment: 'jsdom',
        environmentOptions: {
          jsdom: {
            url: 'http://localhost/',
          },
        },
        globals: true,
        include: ['tests/**/*.test.ts'],
        restoreMocks: true,
        testTimeout: 10000,
      },
    };
  }),
);
