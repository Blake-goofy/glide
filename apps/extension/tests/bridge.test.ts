import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { glideProtocol, type GlideBridgeMessage } from '@blakebecker/glide-shared';

let fetchMock: ReturnType<typeof vi.fn>;

function nextBridgeMessage(): Promise<GlideBridgeMessage> {
  return new Promise((resolve) => {
    window.addEventListener(
      glideProtocol.bridgeToContentEvent,
      (event) => {
        resolve((event as CustomEvent<GlideBridgeMessage>).detail);
      },
      { once: true },
    );
  });
}

async function loadBridge(): Promise<void> {
  vi.resetModules();
  await import('../src/bridge/index');
}

describe('main-world bridge', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', 'http://localhost/WarehouseMobile/');
    fetchMock = vi.fn(async () => ({
      json: async () => ({ MessageCode: 'OK_SESSIONINFO01' }),
      ok: true,
      status: 200,
    }));
    vi.stubGlobal(
      'fetch',
      fetchMock,
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete window.__glideBridgeLoaded;
  });

  it('captures SCALE request headers from page fetch calls', async () => {
    await loadBridge();

    await window.fetch('/scale/bootstrap', {
      headers: {
        authorization: 'Bearer token',
        environment: 'qa',
        sessionid: 'session-1',
        warehouse: '02',
      },
    });

    const messagePromise = nextBridgeMessage();
    window.dispatchEvent(
      new CustomEvent(glideProtocol.contentToBridgeEvent, {
        detail: {
          id: 'request-1',
          source: glideProtocol.sourceContent,
          type: 'glide.requestContext',
        },
      }),
    );

    await expect(messagePromise).resolves.toMatchObject({
      id: 'request-1',
      ok: true,
      payload: {
        authorization: 'Bearer token',
        environment: 'qa',
        sessionid: 'session-1',
        warehouse: '02',
      },
      type: 'glide.requestContext.result',
    });
  });

  it('calls GetSessionInfo with captured SCALE headers', async () => {
    await loadBridge();

    await window.fetch('/scale/bootstrap', {
      headers: {
        authorization: 'Bearer token',
        environment: 'qa',
        sessionid: 'session-1',
        username: 'bbecker',
        warehouse: '02',
      },
    });

    const messagePromise = nextBridgeMessage();
    window.dispatchEvent(
      new CustomEvent(glideProtocol.contentToBridgeEvent, {
        detail: {
          id: 'session-1',
          payload: { changeValue: 'INIT' },
          source: glideProtocol.sourceContent,
          type: 'glide.getSessionInfo',
        },
      }),
    );

    await expect(messagePromise).resolves.toMatchObject({
      id: 'session-1',
      ok: true,
      payload: { MessageCode: 'OK_SESSIONINFO01' },
      type: 'glide.getSessionInfo.result',
    });

    const sessionCall = fetchMock.mock.calls.find(([input]) => String(input).includes('/UserAction/ExecProc'));
    expect(sessionCall).toBeDefined();
    expect(String(sessionCall?.[0])).toContain('action=GetSessionInfo');
    expect(sessionCall?.[1]).toMatchObject({ credentials: 'include', method: 'GET' });
    expect(new Headers(sessionCall?.[1]?.headers).get('authorization')).toBe('Bearer token');
  });
});
