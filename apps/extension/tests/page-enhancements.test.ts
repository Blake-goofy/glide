import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { glideProtocol, type GlideBridgeMessage, type GlideContentMessage } from '@blakebecker/glide-shared';

import { installAdfsOverlayKeyboard } from '../src/features/adfs-overlay-keyboard';
import { installClickableRows } from '../src/features/clickable-rows';
import { installDarkModeBackgroundFix } from '../src/features/dark-mode-background-fix';
import { installGridCopy } from '../src/features/grid-copy';
import { installSessionStrip } from '../src/features/session-strip';
import { installUnitsInToteNumpad } from '../src/features/units-in-tote-numpad';

describe('page enhancements', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    localStorage.clear();
    window.history.replaceState({}, '', 'http://localhost/scale/trans/ex22slotstaxpalletbuild');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('copies the first LP table column into the pallet input when a row is clicked', () => {
    document.body.innerHTML = `
      <div id="PalletColumnId"><input /></div>
      <ion-row class="table-row"><ion-col>LP-1001</ion-col><ion-col>Ready</ion-col></ion-row>
    `;

    const cleanup = installClickableRows();
    document.querySelector('ion-row')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(document.querySelector<HTMLInputElement>('#PalletColumnId input')?.value).toBe('LP-1001');
    expect(document.querySelector('ion-row')?.classList.contains('glide-clickable-row-selected')).toBe(true);

    cleanup();
  });

  it('adds a numeric keypad for the Units in Tote input', () => {
    document.body.innerHTML = `
      <ion-item><scale-input><div id="UnitsInTote"><input /></div></scale-input></ion-item>
    `;

    const cleanup = installUnitsInToteNumpad();
    document.querySelector<HTMLButtonElement>('.glide-units-in-tote-numpad__key[data-value="7"]')?.click();

    expect(document.querySelector<HTMLInputElement>('#UnitsInTote input')?.value).toBe('7');

    cleanup();
  });

  it('copies a supported grid cell immediately on middle click and uses a bridge toast', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const toastMessages = stubBridgeToasts();

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText,
      },
    });

    document.body.innerHTML = `
      <table class="ui-iggrid-table">
        <tbody>
          <tr>
            <td>LP-1001</td>
          </tr>
        </tbody>
      </table>
    `;

    const cleanup = installGridCopy();
    const cell = document.querySelector('td') as HTMLTableCellElement;
    const event = new MouseEvent('auxclick', { bubbles: true, button: 1, cancelable: true });

    cell.dispatchEvent(event);
    await flushMicrotasks();

    expect(event.defaultPrevented).toBe(true);
    expect(writeText).toHaveBeenCalledWith('LP-1001');
    expect(toastMessages).toEqual([
      {
        kind: 'success',
        message: 'Copied to clipboard.',
      },
    ]);

    cleanup();
  });

  it('shows a copy menu for right click and copies link cell text without navigating', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const toastMessages = stubBridgeToasts();
    const linkClick = vi.fn((event: Event) => {
      event.preventDefault();
    });

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText,
      },
    });

    document.body.innerHTML = `
      <table id="ListPaneDataGrid_headers" class="ui-iggrid-headertable">
        <tbody>
          <tr>
            <td><a href="/scale/item/123">Tracking 123</a></td>
          </tr>
        </tbody>
      </table>
    `;

    const cleanup = installGridCopy();
    const link = document.querySelector('a') as HTMLAnchorElement;
    const contextEvent = new MouseEvent('contextmenu', { bubbles: true, button: 2, cancelable: true, clientX: 32, clientY: 48 });

    link.addEventListener('click', linkClick);
    link.dispatchEvent(contextEvent);

    expect(contextEvent.defaultPrevented).toBe(true);
    expect(document.getElementById('glide-grid-copy-menu')).not.toBeNull();
    expect(linkClick).not.toHaveBeenCalled();

    document
      .querySelector<HTMLButtonElement>('[data-glide-grid-copy-action="copy"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    await flushMicrotasks();

    expect(writeText).toHaveBeenCalledWith('Tracking 123');
    expect(toastMessages).toEqual([
      {
        kind: 'success',
        message: 'Copied to clipboard.',
      },
    ]);

    cleanup();
  });

  it('copies a single space on touch long press instead of dropping whitespace-only cells', async () => {
    vi.useFakeTimers();

    const writeText = vi.fn().mockResolvedValue(undefined);
    const toastMessages = stubBridgeToasts();

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText,
      },
    });

    document.body.innerHTML = `
      <table class="ui-iggrid-table">
        <tbody>
          <tr>
            <td>&nbsp;</td>
          </tr>
        </tbody>
      </table>
    `;

    const cleanup = installGridCopy();
    const cell = document.querySelector('td') as HTMLTableCellElement;

    dispatchPointerEvent(cell, 'pointerdown', { clientX: 20, clientY: 24, pointerId: 7, pointerType: 'touch' });
    await vi.advanceTimersByTimeAsync(550);
    await flushMicrotasks();

    expect(writeText).toHaveBeenCalledWith(' ');
    expect(toastMessages).toEqual([
      {
        kind: 'success',
        message: 'Copied to clipboard.',
      },
    ]);

    cleanup();
  });

  it('shows the ADFS keyboard and types into the focused credential input', () => {
    document.body.innerHTML = `
      <form id="loginForm">
        <input id="userNameInput" />
        <input id="passwordInput" type="password" />
        <button id="submitButton" type="button">Sign in</button>
      </form>
    `;

    const cleanup = installAdfsOverlayKeyboard();
    const usernameInput = document.getElementById('userNameInput') as HTMLInputElement;
    usernameInput.focus();
    document.querySelector<HTMLButtonElement>('.glide-adfs-keyboard__key[data-value="q"]')?.click();

    expect(usernameInput.value).toBe('q');

    cleanup();
  });

  it('supports the old symbol keyboard layout for ADFS credentials', () => {
    document.body.innerHTML = `
      <form id="loginForm">
        <input id="userNameInput" />
        <input id="passwordInput" type="password" />
        <button id="submitButton" type="button">Sign in</button>
      </form>
    `;

    const cleanup = installAdfsOverlayKeyboard();
    const passwordInput = document.getElementById('passwordInput') as HTMLInputElement;

    passwordInput.focus();
    document.querySelector<HTMLButtonElement>('.glide-adfs-keyboard__key[data-action="toggle-mode"]')?.click();
    document.querySelector<HTMLButtonElement>('.glide-adfs-keyboard__key[data-value="!"]')?.click();

    expect(passwordInput.value).toBe('!');
    expect(document.querySelector('.glide-adfs-keyboard__key[data-action="capslock"]')).not.toBeNull();

    cleanup();
  });

  it('shows the pressed class while a key pointer is down', () => {
    document.body.innerHTML = `
      <form id="loginForm">
        <input id="userNameInput" />
        <input id="passwordInput" type="password" />
        <button id="submitButton" type="button">Sign in</button>
      </form>
    `;

    const cleanup = installAdfsOverlayKeyboard();
    const key = document.querySelector<HTMLButtonElement>('.glide-adfs-keyboard__key[data-value="q"]');

    key?.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(key?.classList.contains('glide-adfs-keyboard__key--pressing')).toBe(true);
    expect(key?.style.getPropertyValue('transform')).toBe('translateY(3px)');
    expect(key?.style.getPropertyPriority('transform')).toBe('important');

    key?.dispatchEvent(new Event('pointerup', { bubbles: true }));
    expect(key?.classList.contains('glide-adfs-keyboard__key--pressing')).toBe(false);
    expect(key?.style.getPropertyValue('transform')).toBe('');

    cleanup();
  });

  it('types and toggles layouts from pointer release without requiring click', () => {
    document.body.innerHTML = `
      <form id="loginForm">
        <input id="userNameInput" />
        <input id="passwordInput" type="password" />
        <button id="submitButton" type="button">Sign in</button>
      </form>
    `;

    const cleanup = installAdfsOverlayKeyboard();
    const usernameInput = document.getElementById('userNameInput') as HTMLInputElement;

    usernameInput.focus();
    pressPointerKey('.glide-adfs-keyboard__key[data-action="capslock"]');
    pressPointerKey('.glide-adfs-keyboard__key[data-value="Q"]');
    pressPointerKey('.glide-adfs-keyboard__key[data-action="toggle-mode"]');
    pressPointerKey('.glide-adfs-keyboard__key[data-value="!"]');

    expect(usernameInput.value).toBe('Q!');

    cleanup();
  });

  it('clears the pressed visual state when the pointer is released after activation', () => {
    document.body.innerHTML = `
      <form id="loginForm">
        <input id="userNameInput" />
        <input id="passwordInput" type="password" />
        <button id="submitButton" type="button">Sign in</button>
      </form>
    `;

    const cleanup = installAdfsOverlayKeyboard();
    const usernameInput = document.getElementById('userNameInput') as HTMLInputElement;
    const key = document.querySelector<HTMLButtonElement>('.glide-adfs-keyboard__key[data-value="q"]');

    usernameInput.focus();
    key?.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(key?.style.getPropertyValue('transform')).toBe('translateY(3px)');

    key?.dispatchEvent(new Event('pointerup', { bubbles: true }));

    expect(usernameInput.value).toBe('q');
    expect(document.querySelector<HTMLButtonElement>('.glide-adfs-keyboard__key[data-value="q"]')?.style.getPropertyValue('transform')).toBe('');

    cleanup();
  });

  it('keeps a normal ADFS key mounted across pointer interaction frames', async () => {
    document.body.innerHTML = `
      <form id="loginForm">
        <input id="userNameInput" />
        <input id="passwordInput" type="password" />
        <button id="submitButton" type="button">Sign in</button>
      </form>
    `;

    const cleanup = installAdfsOverlayKeyboard();
    const usernameInput = document.getElementById('userNameInput') as HTMLInputElement;

    await flushAnimationFrames(2);

    const key = document.querySelector<HTMLButtonElement>('.glide-adfs-keyboard__key[data-value="q"]');

    usernameInput.focus();
    key?.dispatchEvent(new Event('pointerdown', { bubbles: true }));

    await flushAnimationFrame();

    expect(document.querySelector<HTMLButtonElement>('.glide-adfs-keyboard__key[data-value="q"]')).toBe(key);

    key?.dispatchEvent(new Event('pointerup', { bubbles: true }));

    await flushAnimationFrame();

    expect(usernameInput.value).toBe('q');
    expect(document.querySelector<HTMLButtonElement>('.glide-adfs-keyboard__key[data-value="q"]')).toBe(key);
    expect(key?.style.getPropertyValue('transform')).toBe('');

    cleanup();
  });

  it('routes Session Strip initial session loading through the bridge', async () => {
    localStorage.setItem('MachineName', 'SlotStax Station 1');
    document.cookie = 'UserInformation=UserName=bbecker';
    document.body.setAttribute('data-theme', 'dark');
    document.body.innerHTML = '<div class="transheadermiddlepanel" style="background-color: rgb(12, 34, 56); color: rgb(240, 241, 242);"></div><main><div style="height: 24px;">content</div></main>';

    const bridgeRequest = new Promise<CustomEvent>((resolve) => {
      window.addEventListener(
        glideProtocol.contentToBridgeEvent,
        (event) => {
          const customEvent = event as CustomEvent;
          resolve(customEvent);
          const request = customEvent.detail as { id: string };
          const response: GlideBridgeMessage = {
            id: request.id,
            ok: true,
            payload: {
              ActivityOptionsJson: JSON.stringify([{ DEFAULT_ACTIVITY: 'Y', DESCRIPTION: 'Decant', IDENTIFIER: 'DECANT' }]),
              HasActiveSession: 'false',
              UserName: 'bbecker',
            },
            source: glideProtocol.sourceBridge,
            type: 'glide.userAction.result',
          };
          window.dispatchEvent(new CustomEvent(glideProtocol.bridgeToContentEvent, { detail: response }));
        },
        { once: true },
      );
    });

    const cleanup = installSessionStrip();
    const request = await bridgeRequest;
    await flushAnimationFrame();
    const strip = document.querySelector<HTMLElement>('.glide-session-strip');
    const main = document.querySelector<HTMLElement>('main');

    expect(request.detail).toMatchObject({
      payload: {
        action: 'GetSessionInfo',
        changeValue: 'bbecker',
      },
      source: glideProtocol.sourceContent,
      type: 'glide.userAction',
    });
    expect(strip).not.toBeNull();
    expect(strip?.style.getPropertyValue('--glide-session-strip-panel-bg')).toBe('rgb(12, 34, 56)');
    expect(document.documentElement.style.getPropertyValue('--glide-session-strip-offset')).not.toBe('');
    expect(strip?.querySelector('.glide-session-strip__field--metric-anchor')).not.toBeNull();
    expect(strip?.querySelector('.glide-session-strip__value--status')).not.toBeNull();

    strip?.querySelector<HTMLButtonElement>('button[data-action="add-user"]')?.click();
    expect(strip?.querySelector('.glide-session-strip__row--pending-input')).not.toBeNull();

    cleanup();
  });

  it('applies and restores the dark mode background fix separately from Session Strip', () => {
    document.body.setAttribute('data-theme', 'dark');
    document.body.innerHTML = '<div class="transheadermiddlepanel" style="background-color: rgb(18, 28, 38); color: rgb(240, 241, 242);"></div><main></main>';

    const cleanup = installDarkModeBackgroundFix();

    expect(document.documentElement.style.getPropertyValue('background-color')).toBe('rgb(18, 28, 38)');
    expect(document.body.style.getPropertyValue('background-color')).toBe('rgb(18, 28, 38)');

    cleanup();

    expect(document.documentElement.style.getPropertyValue('background-color')).toBe('');
    expect(document.body.style.getPropertyValue('background-color')).toBe('');
  });

  it('falls back to the IG dark accordion background and updates detail panes on insight-like pages', () => {
    document.head.innerHTML = `
      <style>
        [data-igTheme='dark'] .ui-accordion .ui-accordion-content {
          background-color: #2C2A48 !important;
        }

        [data-igTheme='dark'] .detailpanepart {
          background-color: #000000;
        }
      </style>
    `;
    document.body.setAttribute('data-theme', 'dark');
    document.body.setAttribute('data-igTheme', 'dark');
    document.body.innerHTML = '<div class="detailpanepart">details</div><main><div style="height: 24px;">insight</div></main>';

    const cleanup = installDarkModeBackgroundFix();
    const detailPane = document.querySelector<HTMLElement>('.detailpanepart');

    expect(document.documentElement.style.getPropertyValue('background-color')).toBe('rgb(44, 42, 72)');
    expect(document.body.style.getPropertyValue('background-color')).toBe('rgb(44, 42, 72)');
    expect(detailPane?.style.getPropertyValue('background-color')).toBe('rgb(44, 42, 72)');

    cleanup();

    expect(document.documentElement.style.getPropertyValue('background-color')).toBe('');
    expect(document.body.style.getPropertyValue('background-color')).toBe('');
    expect(detailPane?.style.getPropertyValue('background-color')).toBe('');
  });
});

async function flushAnimationFrame(): Promise<void> {
  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      resolve();
    });
  });
}

async function flushAnimationFrames(count: number): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    await flushAnimationFrame();
  }
}

function pressPointerKey(selector: string): void {
  const key = document.querySelector<HTMLButtonElement>(selector);

  key?.dispatchEvent(new Event('pointerdown', { bubbles: true }));
  key?.dispatchEvent(new Event('pointerup', { bubbles: true }));
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function dispatchPointerEvent(target: Element, type: string, properties: Record<string, unknown>): void {
  const event = new Event(type, { bubbles: true, cancelable: true });

  Object.assign(event, properties);
  target.dispatchEvent(event);
}

function stubBridgeToasts(): Array<{ kind: string; message: string }> {
  const messages: Array<{ kind: string; message: string }> = [];

  window.addEventListener(glideProtocol.contentToBridgeEvent, handleBridgeMessage);

  function handleBridgeMessage(event: Event): void {
    const detail = (event as CustomEvent<GlideContentMessage>).detail;

    if (!detail || detail.type !== 'glide.toast') {
      return;
    }

    messages.push(detail.payload);
    window.dispatchEvent(
      new CustomEvent(glideProtocol.bridgeToContentEvent, {
        detail: {
          id: detail.id,
          ok: true,
          payload: { shown: true },
          source: glideProtocol.sourceBridge,
          type: 'glide.toast.result',
        } satisfies GlideBridgeMessage,
      }),
    );
  }

  return messages;
}