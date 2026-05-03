import { describe, expect, it } from 'vitest';

import manifest from '../src/manifest';

function expectScopedHostMatches(matches: string[] | undefined): void {
  expect(matches).toBeDefined();
  expect(matches).toEqual(
    expect.arrayContaining([
      expect.stringMatching(/^https:\/\/[^/*]+\/scale\/\*$/),
      expect.stringMatching(/^https:\/\/[^/*]+\/WarehouseMobile\*$/),
      expect.stringMatching(/^https:\/\/[^/*]+\/warehousemobile\*$/),
      expect.stringMatching(/^https:\/\/[^/*]+\/adfs\/\*$/),
    ]),
  );

  for (const match of matches ?? []) {
    expect(match).toMatch(/^https:\/\/[^/*]+\/(?:scale\/\*|adfs\/\*|WarehouseMobile\*|warehousemobile\*)$/);
  }
}

describe('extension manifest', () => {
  it('uses GLIDE naming and MV3', () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.name).toBe('GLIDE');
    expect(manifest.description).toBe('SCALE workflow enhancements by Blake Becker.');
  });

  it('uses the GLIDE icon for the extension and browser action', () => {
    const expectedIcons = {
      16: 'icons/glide.png',
      32: 'icons/glide.png',
      48: 'icons/glide.png',
      128: 'icons/glide.png',
    };

    expect(manifest.icons).toEqual(expectedIcons);
    expect(manifest.action?.default_icon).toEqual(expectedIcons);
  });

  it('scopes content scripts to explicit HTTPS hosts and supported app paths', () => {
    const bridgeMatches = manifest.content_scripts?.[0]?.matches;
    const contentMatches = manifest.content_scripts?.[1]?.matches;

    expectScopedHostMatches(bridgeMatches);
    expect(contentMatches).toEqual(bridgeMatches);
  });
  it('loads bridge in the main world before the isolated content script', () => {
    expect(manifest.content_scripts?.[0]).toMatchObject({
      js: ['src/bridge/index.ts'],
      run_at: 'document_start',
      world: 'MAIN',
    });

    expect(manifest.content_scripts?.[1]).toMatchObject({
      js: ['src/content/index.ts'],
      run_at: 'document_start',
    });
  });

  it('declares a managed policy schema for extension-managed settings', () => {
    expect(manifest.permissions).toContain('storage');
    expect(manifest.storage).toEqual({
      managed_schema: 'managed-policy.schema.json',
    });
  });
});
