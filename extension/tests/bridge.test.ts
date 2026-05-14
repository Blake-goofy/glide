import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { glideProtocol, type GlideBridgeMessage } from '@blakebecker/glide-shared';

let fetchMock: ReturnType<typeof vi.fn>;
let originalFetch: typeof window.fetch;
let originalWindowAddEventListener: typeof window.addEventListener;
let originalWindowRemoveEventListener: typeof window.removeEventListener;
let originalXmlHttpRequestOpen: XMLHttpRequest['open'];
let originalXmlHttpRequestSetRequestHeader: XMLHttpRequest['setRequestHeader'];
const registeredWindowListeners: Array<{
  listener: EventListenerOrEventListenerObject;
  options: AddEventListenerOptions | boolean | undefined;
  type: string;
}> = [];

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
    registeredWindowListeners.length = 0;

    originalFetch = window.fetch;
    originalWindowAddEventListener = window.addEventListener.bind(window);
    originalWindowRemoveEventListener = window.removeEventListener.bind(window);
    originalXmlHttpRequestOpen = XMLHttpRequest.prototype.open;
    originalXmlHttpRequestSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

    window.addEventListener = ((
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: AddEventListenerOptions | boolean,
    ) => {
      registeredWindowListeners.push({ listener, options, type });
      originalWindowAddEventListener(type, listener, options);
    }) as typeof window.addEventListener;

    window.removeEventListener = ((
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: EventListenerOptions | boolean,
    ) => {
      const listenerIndex = registeredWindowListeners.findIndex(
        (entry) => entry.type === type && entry.listener === listener && entry.options === options,
      );

      if (listenerIndex >= 0) {
        registeredWindowListeners.splice(listenerIndex, 1);
      }

      originalWindowRemoveEventListener(type, listener, options);
    }) as typeof window.removeEventListener;

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
    for (const { type, listener, options } of registeredWindowListeners) {
      originalWindowRemoveEventListener(type, listener, options);
    }

    window.addEventListener = originalWindowAddEventListener;
    window.removeEventListener = originalWindowRemoveEventListener;
    window.fetch = originalFetch;
    XMLHttpRequest.prototype.open = originalXmlHttpRequestOpen;
    XMLHttpRequest.prototype.setRequestHeader = originalXmlHttpRequestSetRequestHeader;
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

  it('waits for the first captured auth header before calling GetSessionInfo', async () => {
    await loadBridge();

    const messagePromise = nextBridgeMessage();
    window.dispatchEvent(
      new CustomEvent(glideProtocol.contentToBridgeEvent, {
        detail: {
          id: 'session-race',
          payload: { changeValue: 'INIT' },
          source: glideProtocol.sourceContent,
          type: 'glide.getSessionInfo',
        },
      }),
    );

    expect(fetchMock.mock.calls.find(([input]) => String(input).includes('/UserAction/ExecProc'))).toBeUndefined();

    await window.fetch('/scale/bootstrap', {
      headers: {
        authorization: 'Bearer delayed-token',
        environment: 'qa',
        sessionid: 'session-2',
        warehouse: '02',
      },
    });

    await expect(messagePromise).resolves.toMatchObject({
      id: 'session-race',
      ok: true,
      payload: { MessageCode: 'OK_SESSIONINFO01' },
      type: 'glide.getSessionInfo.result',
    });

    const sessionCall = fetchMock.mock.calls.find(([input]) => String(input).includes('/UserAction/ExecProc'));
    expect(sessionCall).toBeDefined();
    expect(new Headers(sessionCall?.[1]?.headers).get('authorization')).toBe('Bearer delayed-token');
  });

  it('uses the page toastr API for bridge toast messages', async () => {
    const success = vi.fn();
    window.toastr = {
      options: {},
      success,
    };

    await loadBridge();

    const messagePromise = nextBridgeMessage();
    window.dispatchEvent(
      new CustomEvent(glideProtocol.contentToBridgeEvent, {
        detail: {
          id: 'toast-1',
          payload: {
            kind: 'success',
            message: 'Totes marked as arrived.',
          },
          source: glideProtocol.sourceContent,
          type: 'glide.toast',
        },
      }),
    );

    await expect(messagePromise).resolves.toMatchObject({
      id: 'toast-1',
      ok: true,
      payload: {
        shown: true,
      },
      type: 'glide.toast.result',
    });

    expect(success).toHaveBeenCalledWith('Totes marked as arrived.');
    expect(window.toastr?.options).toMatchObject({
      closeButton: true,
      positionClass: 'toast-top-center',
    });
  });
});
