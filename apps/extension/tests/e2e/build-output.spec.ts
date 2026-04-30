import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

test('built extension manifest keeps GLIDE architecture boundaries', async () => {
  const manifestPath = join(process.cwd(), 'dist', 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as chrome.runtime.ManifestV3;

  expect(manifest.manifest_version).toBe(3);
  expect(manifest.name).toBe('GLIDE');
  expect(manifest.description).toContain('Blake Becker');
  expect(manifest.icons).toMatchObject({ '16': 'icons/glide.png', '128': 'icons/glide.png' });
  expect(manifest.action?.default_icon).toMatchObject({ '16': 'icons/glide.png', '128': 'icons/glide.png' });
  expect(manifest.permissions).toEqual(['storage']);
  expect(manifest.content_scripts?.[0]?.matches).toEqual(['http://*/scale/*', 'https://*/scale/*']);
  expect(manifest.content_scripts?.[1]?.matches).toEqual(['http://*/scale/*', 'https://*/scale/*']);
  expect(manifest.content_scripts?.[0]).toMatchObject({ run_at: 'document_start', world: 'MAIN' });
  expect(manifest.content_scripts?.[1]).toMatchObject({ run_at: 'document_start' });
  await expect(access(join(process.cwd(), 'dist', 'icons', 'glide.png'))).resolves.toBeUndefined();
});