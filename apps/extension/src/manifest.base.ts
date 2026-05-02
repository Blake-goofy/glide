const extensionIcons = {
  16: 'icons/glide.png',
  32: 'icons/glide.png',
  48: 'icons/glide.png',
  128: 'icons/glide.png',
};

export function createManifest(scalePageMatches: string[]): chrome.runtime.ManifestV3 {
  return {
    manifest_version: 3,
    name: 'GLIDE',
    version: '0.1.0',
    description: 'SCALE workflow enhancements by Blake Becker.',
    icons: extensionIcons,
    action: {
      default_title: 'GLIDE',
      default_icon: extensionIcons,
    },
    background: {
      service_worker: 'src/background/service-worker.ts',
      type: 'module',
    },
    permissions: ['storage'],
    storage: {
      managed_schema: 'managed-policy.schema.json',
    },
    content_scripts: [
      {
        matches: scalePageMatches,
        js: ['src/bridge/index.ts'],
        run_at: 'document_start',
        world: 'MAIN',
      },
      {
        matches: scalePageMatches,
        js: ['src/content/index.ts'],
        run_at: 'document_start',
      },
    ],
  } satisfies chrome.runtime.ManifestV3;
}