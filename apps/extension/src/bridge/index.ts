import {
  glideProtocol,
  isGlideContentMessage,
  normalizeScaleHeaderName,
  scaleRequestHeaderNames,
  type GlideBridgeMessage,
  type GlideContentMessage,
  type ScaleRequestContext,
  type UserActionProcedureName,
  type UserActionResponse,
} from '@blakebecker/glide-shared';

declare global {
  interface Window {
    __glideBridgeLoaded?: boolean;
    toastr?: {
      error?: (...args: unknown[]) => void;
      options?: Record<string, unknown>;
      success?: (...args: unknown[]) => void;
    };
  }

  interface XMLHttpRequest {
    __glideRequestHeaders?: Record<string, string>;
  }
}

const requestContext: ScaleRequestContext = {};
const toastStyleId = 'glide-toast-style';

function captureHeader(name: string, value: string): void {
  const normalizedName = normalizeScaleHeaderName(name);

  if (normalizedName) {
    requestContext[normalizedName] = value;
  }
}

function captureHeaders(headers: HeadersInit | undefined): void {
  if (!headers) {
    return;
  }

  new Headers(headers).forEach((value, name) => {
    captureHeader(name, value);
  });
}

function buildScaleHeaders(context: ScaleRequestContext): Headers {
  const headers = new Headers();

  for (const headerName of scaleRequestHeaderNames) {
    const value = context[headerName];

    if (value) {
      headers.set(headerName, value);
    }
  }

  return headers;
}

function postToContent(message: GlideBridgeMessage): void {
  window.dispatchEvent(new CustomEvent(glideProtocol.bridgeToContentEvent, { detail: message }));
}

async function callUserAction(action: UserActionProcedureName, changeValue = 'INIT', internalId = getMachineName() || 'INIT'): Promise<UserActionResponse> {
  const url = new URL('/UserAction/ExecProc', window.location.origin);
  url.searchParams.set('action', action);
  url.searchParams.set('internalID', internalId);
  url.searchParams.set('changeValue', changeValue);

  const response = await window.fetch(url.toString(), {
    credentials: 'include',
    headers: buildScaleHeaders(requestContext),
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error(`SCALE ${action} failed with HTTP ${response.status}`);
  }

  return (await response.json()) as UserActionResponse;
}

async function handleContentMessage(message: GlideContentMessage): Promise<void> {
  try {
    if (message.type === 'glide.requestContext') {
      postToContent({
        id: message.id,
        ok: true,
        payload: { ...requestContext },
        source: glideProtocol.sourceBridge,
        type: 'glide.requestContext.result',
      });
      return;
    }

    if (message.type === 'glide.getSessionInfo') {
      postToContent({
        id: message.id,
        ok: true,
        payload: await callUserAction('GetSessionInfo', message.payload?.changeValue),
        source: glideProtocol.sourceBridge,
        type: 'glide.getSessionInfo.result',
      });
      return;
    }

    if (message.type === 'glide.userAction') {
      postToContent({
        id: message.id,
        ok: true,
        payload: await callUserAction(message.payload.action, message.payload.changeValue, message.payload.internalId),
        source: glideProtocol.sourceBridge,
        type: 'glide.userAction.result',
      });
      return;
    }

    if (message.type === 'glide.toast') {
      postToContent({
        id: message.id,
        ok: true,
        payload: {
          shown: showScaleToast(message.payload.message, message.payload.kind),
        },
        source: glideProtocol.sourceBridge,
        type: 'glide.toast.result',
      });
    }
  } catch (error) {
    postToContent({
      error: error instanceof Error ? error.message : String(error),
      id: message.id,
      ok: false,
      source: glideProtocol.sourceBridge,
      type: 'glide.error',
    });
  }
}

function showScaleToast(message: string, kind: 'error' | 'success'): boolean {
  const toastKind = kind === 'error' ? 'error' : 'success';
  const toastr = window.toastr;
  const method = toastKind === 'error' ? toastr?.error : toastr?.success;

  if (!message || typeof method !== 'function' || !toastr) {
    return false;
  }

  ensureToastrStyles();
  toastr.options = {
    ...toastr.options,
    closeButton: true,
    extendedTimeOut: toastr.options?.extendedTimeOut ?? 1000,
    newestOnTop: true,
    positionClass: 'toast-top-center',
    preventDuplicates: false,
    timeOut: toastr.options?.timeOut ?? 5000,
  };
  method.call(toastr, message);
  return true;
}

function ensureToastrStyles(): void {
  if (document.getElementById(toastStyleId)) {
    return;
  }

  const style = document.createElement('style');
  style.id = toastStyleId;
  style.textContent = `
    #toast-container.toast-top-center {
      left: 50% !important;
      right: auto !important;
      top: 16px !important;
      transform: translateX(-50%) !important;
      width: min(560px, calc(100vw - 32px)) !important;
    }
    #toast-container.toast-top-center > .toast {
      box-sizing: border-box !important;
      margin: 0 0 8px 0 !important;
      text-align: left !important;
      width: 100% !important;
    }
  `;
  document.head.append(style);
}

function getMachineName(): string {
  try {
    return window.localStorage.getItem('MachineName')?.trim() ?? '';
  } catch {
    return '';
  }
}

function patchFetch(): void {
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (input instanceof Request) {
      captureHeaders(input.headers);
    }

    captureHeaders(init?.headers);
    return originalFetch(input, init);
  };
}

function patchXmlHttpRequest(): void {
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

  XMLHttpRequest.prototype.open = function open(
    this: XMLHttpRequest,
    method: string,
    url: string | URL,
    async = true,
    username?: string | null,
    password?: string | null,
  ): void {
    this.__glideRequestHeaders = {};
    const openRequest = originalOpen.bind(this) as (
      requestMethod: string,
      requestUrl: string | URL,
      requestAsync?: boolean,
      requestUsername?: string | null,
      requestPassword?: string | null,
    ) => void;
    openRequest(method, url, typeof async === 'boolean' ? async : true, username, password);
  } as XMLHttpRequest['open'];

  XMLHttpRequest.prototype.setRequestHeader = function setRequestHeader(this: XMLHttpRequest, name: string, value: string): void {
    captureHeader(name, value);
    this.__glideRequestHeaders = {
      ...this.__glideRequestHeaders,
      [name]: value,
    };
    originalSetRequestHeader.call(this, name, value);
  };
}

function handleWindowMessage(event: Event): void {
  const message = (event as CustomEvent<unknown>).detail;

  if (isGlideContentMessage(message)) {
    void handleContentMessage(message);
  }
}

if (!window.__glideBridgeLoaded) {
  window.__glideBridgeLoaded = true;
  patchFetch();
  patchXmlHttpRequest();
  window.addEventListener(glideProtocol.contentToBridgeEvent, handleWindowMessage);
  window.dispatchEvent(new CustomEvent(glideProtocol.bridgeReadyEvent));
}

export {};
