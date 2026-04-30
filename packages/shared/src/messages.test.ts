import { describe, expect, it } from 'vitest';

import { createMessageId, glideProtocol, isGlideContentMessage } from './messages.js';

describe('GLIDE message contracts', () => {
  it('uses namespaced DOM events', () => {
    expect(glideProtocol.contentToBridgeEvent).toBe('glide:content-message');
    expect(glideProtocol.bridgeToContentEvent).toBe('glide:bridge-message');
    expect(glideProtocol.bridgeReadyEvent).toBe('glide:bridge-ready');
  });

  it('recognizes content messages and rejects foreign messages', () => {
    expect(
      isGlideContentMessage({
        id: createMessageId('test'),
        source: glideProtocol.sourceContent,
        type: 'glide.requestContext',
      }),
    ).toBe(true);

    expect(
      isGlideContentMessage({
        id: 'foreign',
        source: 'other-extension',
        type: 'glide.requestContext',
      }),
    ).toBe(false);
  });
});
