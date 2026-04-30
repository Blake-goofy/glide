import type { ScaleRequestContext, UserActionResponse } from './scale.js';

export const glideProtocol = {
  bridgeReadyEvent: 'glide:bridge-ready',
  bridgeToContentEvent: 'glide:bridge-message',
  contentToBridgeEvent: 'glide:content-message',
  sourceBridge: 'glide:bridge',
  sourceContent: 'glide:content',
} as const;

export type GlideContentMessage =
  | {
      id: string;
      source: typeof glideProtocol.sourceContent;
      type: 'glide.requestContext';
    }
  | {
      id: string;
      source: typeof glideProtocol.sourceContent;
      type: 'glide.getSessionInfo';
      payload?: {
        changeValue?: string;
      };
    };

export type GlideBridgeMessage =
  | {
      id: string;
      ok: true;
      source: typeof glideProtocol.sourceBridge;
      type: 'glide.requestContext.result';
      payload: ScaleRequestContext;
    }
  | {
      id: string;
      ok: true;
      source: typeof glideProtocol.sourceBridge;
      type: 'glide.getSessionInfo.result';
      payload: UserActionResponse;
    }
  | {
      id: string;
      ok: false;
      source: typeof glideProtocol.sourceBridge;
      type: 'glide.error';
      error: string;
    };

export function createMessageId(prefix = 'glide'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function isGlideContentMessage(value: unknown): value is GlideContentMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<GlideContentMessage>;
  return candidate.source === glideProtocol.sourceContent && typeof candidate.id === 'string' && typeof candidate.type === 'string';
}
