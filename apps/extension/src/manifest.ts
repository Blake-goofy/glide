const scalePageMatches = ['http://localhost/*', 'https://localhost/*'];
const extensionIcons = {
  16: 'icons/glide.png',
  32: 'icons/glide.png',
  48: 'icons/glide.png',
  128: 'icons/glide.png',
};

const manifest = {
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
  content_scripts: [
    {
      matches: ['http://*/scale/*', 'https://*/scale/*'],
      js: ['src/bridge/index.ts'],
      run_at: 'document_start',
      world: 'MAIN',
    },
    {
      matches: ['http://*/scale/*', 'https://*/scale/*'],
      js: ['src/content/index.ts'],
      run_at: 'document_start',
    },
  ],
} satisfies chrome.runtime.ManifestV3;

export default manifest;
