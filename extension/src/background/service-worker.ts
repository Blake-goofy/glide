import { parseManagedPolicy } from '@blakebecker/glide-shared';

chrome.runtime.onInstalled.addListener(async () => {
  const managedSettings = await chrome.storage.managed.get(null).catch(() => ({}));
  const policy = parseManagedPolicy(managedSettings);

  await chrome.storage.local.set({
    glideInstalledAt: new Date().toISOString(),
    glidePolicySnapshot: {
      diagnosticsEnabled: policy.diagnosticsEnabled,
    },
  });
});

export {};
