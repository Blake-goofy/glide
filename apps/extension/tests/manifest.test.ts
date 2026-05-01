import { describe, expect, it } from 'vitest';

import manifest from '../src/manifest';

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

  it('matches SCALE pages without hardcoding environment hostnames', () => {
    const expectedMatches = [
      'http://*/scale/*',
      'https://*/scale/*',
      'http://*/adfs/*',
      'https://*/adfs/*',
      'http://*/WarehouseMobile*',
      'https://*/WarehouseMobile*',
      'http://*/warehousemobile*',
      'https://*/warehousemobile*',
    ];

    expect(manifest.content_scripts?.[0]?.matches).toEqual(expectedMatches);
    expect(manifest.content_scripts?.[1]?.matches).toEqual(expectedMatches);
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
});
