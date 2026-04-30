import { crx } from '@crxjs/vite-plugin';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { defineConfig as defineVitestConfig } from 'vitest/config';

import manifest from './src/manifest';

export default defineConfig(
  defineVitestConfig({
    plugins: [crx({ manifest })],
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
  }),
);
