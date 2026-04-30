import { beforeEach, describe, expect, it, vi } from 'vitest';

import { glideProtocol, type GlideBridgeMessage } from '@blakebecker/glide-shared';

const userMenuMarkup = `
  <ul class="dropdown-menu userMenu show" data-bs-popper="none">
    <li class="userMenuNameArea">
      <div class="userMenuName">Blake Becker</div>
    </li>
    <li><a class="dropdown-item" id="ConfigureWorkStation" href="#">Configure Workstation</a></li>
    <li><a class="dropdown-item" id="MenuCustomizeScreen" href="#">Customize Screen</a></li>
    <li><a class="dropdown-item" id="MenuRestoreDefaultSettings" href="#">Restore Default Settings</a></li>
    <li><hr class="dropdown-divider"></li>
    <li><a class="dropdown-item" href="#">Sign Out</a></li>
  </ul>
`;

interface ChromeStorageMock {
  runtime: {
    lastError?: chrome.runtime.LastError | undefined;
  };
  storage: {
    local: {
      get: ReturnType<typeof vi.fn>;
      set: ReturnType<typeof vi.fn>;
    };
  };
}

describe('isolated content script', () => {
  beforeEach(() => {
    vi.resetModules();
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    document.documentElement.dataset.glideBridgeLastMessage = '';
    document.documentElement.dataset.glideContentLoaded = '';
    localStorage.clear();
    delete window.__glideContentLoaded;
    delete (globalThis as typeof globalThis & { chrome?: ChromeStorageMock }).chrome;
  });

  it('marks the page when loaded and records bridge message status', async () => {
    await import('../src/content/index');

    expect(document.documentElement.dataset.glideContentLoaded).toBe('true');

    const message: GlideBridgeMessage = {
      id: 'status-1',
      ok: true,
      payload: {},
      source: glideProtocol.sourceBridge,
      type: 'glide.requestContext.result',
    };

    window.dispatchEvent(new CustomEvent(glideProtocol.bridgeToContentEvent, { detail: message }));

    expect(document.documentElement.dataset.glideBridgeLastMessage).toBe('glide.requestContext.result');
  });

  it('injects Glide Settings into the SCALE user menu when the menu appears later', async () => {
    await import('../src/content/index');

    document.body.innerHTML = userMenuMarkup;
    await flushMicrotasks();

    const menuItem = document.getElementById('GlideSettingsMenuItem');
    const modal = document.getElementById('GlideSettingsModalDialog');

    expect(menuItem?.textContent).toBe('Glide Settings');
    expect(modal).not.toBeNull();
  });

  it('defaults the ADFS keyboard on when SCALE local storage says the machine is SlotStax', async () => {
    const storageGet = vi.fn((_key: string, callback: (items: Record<string, unknown>) => void) => {
      callback({});
    });
    const storageSet = vi.fn((_items: Record<string, unknown>, callback?: () => void) => {
      callback?.();
    });

    (globalThis as typeof globalThis & { chrome?: ChromeStorageMock }).chrome = {
      runtime: {},
      storage: {
        local: {
          get: storageGet,
          set: storageSet,
        },
      },
    };

    localStorage.setItem('MachineName', 'SlotStax Station 1');
    document.body.innerHTML = userMenuMarkup;

    await import('../src/content/index');
    await flushMicrotasks();

    document.getElementById('GlideSettingsMenuItem')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushMicrotasks();

    expect((document.getElementById('GlideSettingsFeature-adfsKeyboard') as HTMLInputElement).checked).toBe(true);
    expect((document.getElementById('GlideSettingsFeature-sessionStrip') as HTMLInputElement).checked).toBe(true);
    expect((document.getElementById('GlideSettingsFeature-arriveAllTotes') as HTMLInputElement).checked).toBe(true);
    expect((document.getElementById('GlideSettingsFeature-clickableRows') as HTMLInputElement).checked).toBe(true);
    expect((document.getElementById('GlideSettingsFeature-unitsInToteNumpad') as HTMLInputElement).checked).toBe(true);
  });

  it('loads and saves stub Glide feature settings through extension storage', async () => {
    const storageGet = vi.fn((_key: string, callback: (items: Record<string, unknown>) => void) => {
      callback({
        glideSettings: {
          machineName: 'SlotStax Station 2',
          settings: {
            adfsKeyboard: true,
            arriveAllTotes: true,
            clickableRows: true,
            sessionStrip: false,
            unitsInToteNumpad: false,
          },
        },
      });
    });
    const storageSet = vi.fn((_items: Record<string, unknown>, callback?: () => void) => {
      callback?.();
    });

    (globalThis as typeof globalThis & { chrome?: ChromeStorageMock }).chrome = {
      runtime: {},
      storage: {
        local: {
          get: storageGet,
          set: storageSet,
        },
      },
    };

    document.body.innerHTML = userMenuMarkup;

    await import('../src/content/index');
    await flushMicrotasks();

    const message: GlideBridgeMessage = {
      id: 'machine-1',
      ok: true,
      payload: {
        machinename: 'SlotStax Station 2',
      },
      source: glideProtocol.sourceBridge,
      type: 'glide.requestContext.result',
    };

    window.dispatchEvent(new CustomEvent(glideProtocol.bridgeToContentEvent, { detail: message }));

    document.getElementById('GlideSettingsMenuItem')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushMicrotasks();

    const modal = document.getElementById('GlideSettingsModalDialog');
    const adfsKeyboardCheckbox = document.getElementById('GlideSettingsFeature-adfsKeyboard');
    const sessionStripCheckbox = document.getElementById('GlideSettingsFeature-sessionStrip');
    const arriveAllTotesCheckbox = document.getElementById('GlideSettingsFeature-arriveAllTotes');
    const clickableRowsCheckbox = document.getElementById('GlideSettingsFeature-clickableRows');
    const unitsInToteNumpadCheckbox = document.getElementById('GlideSettingsFeature-unitsInToteNumpad');

    expect(modal?.classList.contains('show')).toBe(true);
  expect(adfsKeyboardCheckbox).toBeInstanceOf(HTMLInputElement);
    expect(sessionStripCheckbox).toBeInstanceOf(HTMLInputElement);
    expect(arriveAllTotesCheckbox).toBeInstanceOf(HTMLInputElement);
    expect(clickableRowsCheckbox).toBeInstanceOf(HTMLInputElement);
    expect(unitsInToteNumpadCheckbox).toBeInstanceOf(HTMLInputElement);

  expect((adfsKeyboardCheckbox as HTMLInputElement).checked).toBe(true);
    expect((sessionStripCheckbox as HTMLInputElement).checked).toBe(false);
    expect((arriveAllTotesCheckbox as HTMLInputElement).checked).toBe(true);
    expect((clickableRowsCheckbox as HTMLInputElement).checked).toBe(true);
    expect((unitsInToteNumpadCheckbox as HTMLInputElement).checked).toBe(false);

  (adfsKeyboardCheckbox as HTMLInputElement).checked = false;
    (sessionStripCheckbox as HTMLInputElement).checked = true;
    (arriveAllTotesCheckbox as HTMLInputElement).checked = false;
    (clickableRowsCheckbox as HTMLInputElement).checked = true;
    (unitsInToteNumpadCheckbox as HTMLInputElement).checked = true;

    document.getElementById('GlideSettingsSaveButton')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushMicrotasks();

    expect(storageGet).toHaveBeenCalledWith('glideSettings', expect.any(Function));
    expect(storageSet).toHaveBeenCalledWith(
      {
        glideSettings: {
          machineName: 'SlotStax Station 2',
          settings: {
            adfsKeyboard: false,
            arriveAllTotes: false,
            clickableRows: true,
            sessionStrip: true,
            unitsInToteNumpad: true,
          },
        },
      },
      expect.any(Function),
    );
    expect(modal?.classList.contains('show')).toBe(false);
  });

  it('resets settings to machine defaults when the machine name changes', async () => {
    const storageGet = vi.fn((_key: string, callback: (items: Record<string, unknown>) => void) => {
      callback({
        glideSettings: {
          machineName: 'Packing Station 4',
          settings: {
            adfsKeyboard: false,
            arriveAllTotes: false,
            clickableRows: false,
            sessionStrip: false,
            unitsInToteNumpad: false,
          },
        },
      });
    });
    const storageSet = vi.fn((_items: Record<string, unknown>, callback?: () => void) => {
      callback?.();
    });

    (globalThis as typeof globalThis & { chrome?: ChromeStorageMock }).chrome = {
      runtime: {},
      storage: {
        local: {
          get: storageGet,
          set: storageSet,
        },
      },
    };

    document.body.innerHTML = userMenuMarkup;

    await import('../src/content/index');
    await flushMicrotasks();

    window.dispatchEvent(
      new CustomEvent(glideProtocol.bridgeToContentEvent, {
        detail: {
          id: 'machine-2',
          ok: true,
          payload: {
            machinename: 'Decant Station 3',
          },
          source: glideProtocol.sourceBridge,
          type: 'glide.requestContext.result',
        } satisfies GlideBridgeMessage,
      }),
    );

    document.getElementById('GlideSettingsMenuItem')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushMicrotasks();

    expect((document.getElementById('GlideSettingsFeature-adfsKeyboard') as HTMLInputElement).checked).toBe(true);
    expect((document.getElementById('GlideSettingsFeature-sessionStrip') as HTMLInputElement).checked).toBe(true);
    expect((document.getElementById('GlideSettingsFeature-arriveAllTotes') as HTMLInputElement).checked).toBe(true);
    expect((document.getElementById('GlideSettingsFeature-clickableRows') as HTMLInputElement).checked).toBe(true);
    expect((document.getElementById('GlideSettingsFeature-unitsInToteNumpad') as HTMLInputElement).checked).toBe(true);

    expect(storageSet).toHaveBeenCalledWith(
      {
        glideSettings: {
          machineName: 'Decant Station 3',
          settings: {
            adfsKeyboard: true,
            arriveAllTotes: true,
            clickableRows: true,
            sessionStrip: true,
            unitsInToteNumpad: true,
          },
        },
      },
      expect.any(Function),
    );
  });
});

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}
