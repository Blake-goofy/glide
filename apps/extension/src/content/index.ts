import { createMessageId, glideProtocol, type GlideBridgeMessage, type GlideContentMessage } from '@blakebecker/glide-shared';

import { handleGlideSettingsBridgeMessage, initGlideSettingsUi } from '../features/glide-settings';

declare global {
  interface Window {
    __glideContentLoaded?: boolean;
  }
}

function dispatchToBridge(message: GlideContentMessage): void {
  window.dispatchEvent(new CustomEvent(glideProtocol.contentToBridgeEvent, { detail: message }));
}

function handleBridgeMessage(event: Event): void {
  const customEvent = event as CustomEvent<GlideBridgeMessage>;
  const message = customEvent.detail;

  if (!message || message.source !== glideProtocol.sourceBridge) {
    return;
  }

  handleGlideSettingsBridgeMessage(message);
  document.documentElement.dataset.glideBridgeLastMessage = message.type;
}

function requestInitialContext(): void {
  dispatchToBridge({
    id: createMessageId('content'),
    source: glideProtocol.sourceContent,
    type: 'glide.requestContext',
  });
}

if (!window.__glideContentLoaded) {
  window.__glideContentLoaded = true;
  window.addEventListener(glideProtocol.bridgeToContentEvent, handleBridgeMessage);
  window.addEventListener(glideProtocol.bridgeReadyEvent, requestInitialContext, { once: true });
  initGlideSettingsUi();
  document.documentElement.dataset.glideContentLoaded = 'true';
}

export {};
