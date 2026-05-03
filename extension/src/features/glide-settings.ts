import type { GlideBridgeMessage, ScaleRequestContext } from '@blakebecker/glide-shared';

const settingsStorageKey = 'glideSettings';
const menuSelector = 'ul.dropdown-menu.userMenu';
const menuItemId = 'GlideSettingsMenuItem';
const modalId = 'GlideSettingsModalDialog';
const modalFormId = 'GlideSettingsModalDialogForm';
const modalBackdropId = 'GlideSettingsModalBackdrop';
const modalLabelId = 'GlideSettingsModalLabel';
const saveButtonId = 'GlideSettingsSaveButton';
const cancelButtonId = 'GlideSettingsCancelButton';
const closeButtonId = 'GlideSettingsCloseButton';
const modalOpenClassName = 'glide-settings-modal-open';
const scaleResetModalId = 'ResetSettingsModalDialog';
const settingsChangedEventName = 'glide:settings-changed';

export type GlideSettingsFeatureName = 'sessionStrip' | 'arriveAllTotes' | 'clickableRows' | 'unitsInToteNumpad' | 'adfsKeyboard' | 'darkModeBackgroundFix' | 'gridCopy';

export type GlideSettingsState = Record<GlideSettingsFeatureName, boolean>;

type GlideDepartment = 'packing' | 'slotstax' | 'decant' | 'unknown';

interface GlideSettingsFeatureDefinition {
  label: string;
  name: GlideSettingsFeatureName;
}

interface PersistedGlideSettings {
  machineName: string;
  settings: GlideSettingsState;
}

const featureDefinitions: readonly GlideSettingsFeatureDefinition[] = [
  {
    label: 'Session Strip',
    name: 'sessionStrip',
  },
  {
    label: 'Arrive All Totes',
    name: 'arriveAllTotes',
  },
  {
    label: 'Clickable Rows',
    name: 'clickableRows',
  },
  {
    label: 'Units In Tote Numpad',
    name: 'unitsInToteNumpad',
  },
  {
    label: 'ADFS Keyboard',
    name: 'adfsKeyboard',
  },
  {
    label: 'Dark Mode Background Fix',
    name: 'darkModeBackgroundFix',
  },
  {
    label: 'Grid Copy',
    name: 'gridCopy',
  },
] as const;

let settingsObserver: MutationObserver | null = null;
let settingsUiInitialized = false;
let latestMachineName = '';

export function initGlideSettingsUi(): void {
  if (settingsUiInitialized) {
    return;
  }

  settingsUiInitialized = true;
  ensureSettingsUi();

  settingsObserver = new MutationObserver((mutations) => {
    syncSettingsUiForMutations(mutations);
  });

  settingsObserver.observe(document.body ?? document.documentElement, {
    childList: true,
    subtree: true,
  });

  document.addEventListener('keydown', handleDocumentKeydown);
}

export function handleGlideSettingsBridgeMessage(message: GlideBridgeMessage): void {
  if (message.type !== 'glide.requestContext.result') {
    return;
  }

  latestMachineName = normalizeMachineName(message.payload);
}

export function getCurrentGlideSettings(): Promise<GlideSettingsState> {
  return loadSettingsState(getCurrentMachineName());
}

export function onGlideSettingsChanged(listener: (settingsState: GlideSettingsState) => void): () => void {
  const handleSettingsChanged = (event: Event): void => {
    listener((event as CustomEvent<GlideSettingsState>).detail);
  };

  window.addEventListener(settingsChangedEventName, handleSettingsChanged);
  return () => window.removeEventListener(settingsChangedEventName, handleSettingsChanged);
}

function ensureSettingsUi(): void {
  const activeDocument = globalThis.document;

  if (!activeDocument?.body) {
    return;
  }

  ensureModal();

  for (const menu of activeDocument.querySelectorAll<HTMLUListElement>(menuSelector)) {
    ensureMenuItem(menu);
  }
}

function syncSettingsUiForMutations(mutations: MutationRecord[]): void {
  const activeDocument = globalThis.document;

  if (!activeDocument?.body) {
    return;
  }

  if (!activeDocument.getElementById(modalId)) {
    ensureModal();
  }

  const menus = new Set<HTMLUListElement>();

  for (const mutation of mutations) {
    collectSettingsMenus(mutation.target, menus);

    for (const node of Array.from(mutation.addedNodes)) {
      collectSettingsMenus(node, menus);
    }
  }

  for (const menu of menus) {
    ensureMenuItem(menu);
  }
}

function collectSettingsMenus(node: Node | null, menus: Set<HTMLUListElement>): void {
  if (!(node instanceof Element)) {
    return;
  }

  if (node instanceof HTMLUListElement && node.matches(menuSelector)) {
    menus.add(node);
  }

  const parentMenu = node.closest<HTMLUListElement>(menuSelector);

  if (parentMenu) {
    menus.add(parentMenu);
  }

  node.querySelectorAll<HTMLUListElement>(menuSelector).forEach((menu) => menus.add(menu));
}

function ensureMenuItem(menu: HTMLUListElement): void {
  if (menu.querySelector(`#${menuItemId}`)) {
    return;
  }

  const listItem = document.createElement('li');
  const anchor = document.createElement('a');
  const insertionPoint = Array.from(menu.children).find((child) => child.querySelector('.dropdown-divider')) ?? null;

  anchor.className = 'dropdown-item';
  anchor.href = '#';
  anchor.id = menuItemId;
  anchor.textContent = 'Glide Settings';
  anchor.addEventListener('click', (event) => {
    event.preventDefault();
    void openGlideSettingsModal();
  });

  listItem.append(anchor);

  if (insertionPoint) {
    menu.insertBefore(listItem, insertionPoint);
    return;
  }

  menu.append(listItem);
}

function ensureModal(): void {
  const activeDocument = globalThis.document;

  if (!activeDocument?.body || activeDocument.getElementById(modalId)) {
    return;
  }

  const scaleModalTemplate = activeDocument.getElementById(scaleResetModalId);
  const modal =
    scaleModalTemplate instanceof HTMLDivElement
      ? (scaleModalTemplate.cloneNode(true) as HTMLDivElement)
      : buildFallbackModal(activeDocument);

  modal.id = modalId;
  modal.classList.remove('show');
  modal.setAttribute('aria-hidden', 'true');
  modal.setAttribute('aria-labelledby', modalLabelId);
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('data-bs-backdrop', 'static');
  modal.setAttribute('role', 'dialog');
  modal.style.display = 'none';
  modal.tabIndex = -1;

  const dialog = ensureModalShell(activeDocument, modal, 'modal-dialog');
  const content = ensureModalShell(activeDocument, dialog, 'modal-content');

  const form = modal.querySelector('form') ?? activeDocument.createElement('form');
  form.className = 'form-horizontal';
  form.id = modalFormId;
  form.setAttribute('novalidate', 'novalidate');
  form.setAttribute('data-controltype', 'form');

  const header = ensureModalSection(form, 'div', 'modal-header', 'modalDialogHeader');
  const closeButton = ensureCloseButton(activeDocument, header);
  closeButton.id = closeButtonId;
  const title = ensureModalTitle(activeDocument, header);
  title.id = modalLabelId;
  title.textContent = 'Glide Settings';

  const body = ensureModalSection(form, 'div', 'modal-body', 'modalDialogBody');
  body.innerHTML = `
    <div>
      <label class="modal-informationtext">Choose which GLIDE enhancements should be available on this workstation.</label>
    </div>
    ${featureDefinitions
      .map(
        (feature) => `
          <div class="modal-text">
            <input checked="checked" class="glide-settings-checkbox" id="${getCheckboxId(feature.name)}" name="${feature.name}" type="checkbox" value="true"><input name="${feature.name}" type="hidden" value="">
            <label class="modal-checkboxlabel" for="${getCheckboxId(feature.name)}">${feature.label}</label>
          </div>
        `,
      )
      .join('')}
  `;

  const footer = ensureModalSection(form, 'div', 'modal-footer', 'modalDialogFooter');
  footer.innerHTML = `
    <button id="${saveButtonId}" class="btn btn-default" type="submit">Save</button>
    <button id="${cancelButtonId}" class="btn btn-default" type="button">Cancel</button>
  `;

  if (!form.parentElement) {
    content.replaceChildren(form);
  }

  const backdrop = activeDocument.createElement('div');
  backdrop.id = modalBackdropId;
  backdrop.className = 'modal-backdrop fade';
  backdrop.style.display = 'none';

  activeDocument.body.append(modal, backdrop);

  modal.querySelector<HTMLFormElement>(`#${modalFormId}`)?.addEventListener('submit', (event) => {
    void handleSaveSettings(event);
  });
  modal.querySelector<HTMLButtonElement>(`#${cancelButtonId}`)?.addEventListener('click', closeGlideSettingsModal);
  modal.querySelector<HTMLButtonElement>(`#${closeButtonId}`)?.addEventListener('click', closeGlideSettingsModal);
}

async function openGlideSettingsModal(): Promise<void> {
  const activeDocument = globalThis.document;
  const modal = activeDocument?.getElementById(modalId);
  const backdrop = activeDocument?.getElementById(modalBackdropId);

  if (!activeDocument?.body || !(modal instanceof HTMLDivElement) || !(backdrop instanceof HTMLDivElement)) {
    return;
  }

  syncCheckboxes(await loadSettingsState(getCurrentMachineName()));
  applyModalLayering(activeDocument, modal, backdrop);
  modal.classList.add('show');
  modal.style.display = 'block';
  modal.setAttribute('aria-hidden', 'false');
  backdrop.classList.add('show');
  backdrop.style.display = 'block';
  activeDocument.body.classList.add(modalOpenClassName);
}

function closeGlideSettingsModal(): void {
  const activeDocument = globalThis.document;
  const modal = activeDocument?.getElementById(modalId);
  const backdrop = activeDocument?.getElementById(modalBackdropId);

  if (!activeDocument?.body || !(modal instanceof HTMLDivElement) || !(backdrop instanceof HTMLDivElement)) {
    return;
  }

  modal.classList.remove('show');
  modal.style.display = 'none';
  modal.setAttribute('aria-hidden', 'true');
  backdrop.classList.remove('show');
  backdrop.style.display = 'none';
  activeDocument.body.classList.remove(modalOpenClassName);
}

async function handleSaveSettings(event: Event): Promise<void> {
  event.preventDefault();
  const settings = readCheckboxState();

  await saveSettingsState({
    machineName: getCurrentMachineName(),
    settings,
  });
  dispatchSettingsChanged(settings);
  closeGlideSettingsModal();
}

function handleDocumentKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    closeGlideSettingsModal();
  }
}

function syncCheckboxes(settingsState: GlideSettingsState): void {
  const activeDocument = globalThis.document;

  for (const feature of featureDefinitions) {
    const checkbox = activeDocument?.getElementById(getCheckboxId(feature.name));

    if (checkbox instanceof HTMLInputElement) {
      checkbox.checked = settingsState[feature.name];
    }
  }
}

function readCheckboxState(): GlideSettingsState {
  const activeDocument = globalThis.document;
  const settingsState = getDefaultSettingsState(getCurrentMachineName());

  for (const feature of featureDefinitions) {
    const checkbox = activeDocument?.getElementById(getCheckboxId(feature.name));

    if (checkbox instanceof HTMLInputElement) {
      settingsState[feature.name] = checkbox.checked;
    }
  }

  return settingsState;
}

async function loadSettingsState(machineName: string): Promise<GlideSettingsState> {
  const storageArea = getStorageArea();
  const defaultSettingsState = getDefaultSettingsState(machineName);

  if (!storageArea) {
    return defaultSettingsState;
  }

  return new Promise((resolve) => {
    storageArea.get(settingsStorageKey, (items) => {
      if (chrome.runtime?.lastError) {
        resolve(defaultSettingsState);
        return;
      }

      const persistedSettings = normalizePersistedSettings(items?.[settingsStorageKey], machineName);

      if (!machineName && persistedSettings.machineName) {
        resolve(persistedSettings.settings);
        return;
      }

      if (persistedSettings.machineName !== machineName) {
        void saveSettingsState({
          machineName,
          settings: defaultSettingsState,
        });
        resolve(defaultSettingsState);
        return;
      }

      resolve(persistedSettings.settings);
    });
  });
}

async function saveSettingsState(value: PersistedGlideSettings): Promise<void> {
  const storageArea = getStorageArea();

  if (!storageArea) {
    return;
  }

  await new Promise<void>((resolve) => {
    storageArea.set({ [settingsStorageKey]: value }, () => {
      resolve();
    });
  });
}

function normalizePersistedSettings(value: unknown, machineName: string): PersistedGlideSettings {
  const settingsState = getDefaultSettingsState(machineName);

  if (!value || typeof value !== 'object') {
    return {
      machineName,
      settings: settingsState,
    };
  }

  const storedSettings = value as Partial<PersistedGlideSettings> & Record<string, unknown>;
  const storedFeatureFlags =
    storedSettings.settings && typeof storedSettings.settings === 'object'
      ? (storedSettings.settings as Record<string, unknown>)
      : storedSettings;

  for (const feature of featureDefinitions) {
    const storedValue = storedFeatureFlags[feature.name];

    if (typeof storedValue === 'boolean') {
      settingsState[feature.name] = storedValue;
    }
  }

  return {
    machineName: typeof storedSettings.machineName === 'string' ? storedSettings.machineName : machineName,
    settings: settingsState,
  };
}

function getCheckboxId(featureName: GlideSettingsFeatureName): string {
  return `GlideSettingsFeature-${featureName}`;
}

function getCurrentMachineName(): string {
  const cachedMachineName = readCachedMachineName();

  return cachedMachineName || latestMachineName;
}

function getDefaultSettingsState(machineName: string): GlideSettingsState {
  const department = inferDepartmentFromMachineName(machineName);
  const enableAdfsKeyboardByDefault = department === 'slotstax' || department === 'decant' || isAdfsPageContext();

  return {
    adfsKeyboard: enableAdfsKeyboardByDefault,
    arriveAllTotes: true,
    clickableRows: true,
    darkModeBackgroundFix: true,
    gridCopy: true,
    sessionStrip: true,
    unitsInToteNumpad: true,
  };
}

function isAdfsPageContext(): boolean {
  const pathname = globalThis.location?.pathname;

  return typeof pathname === 'string' && /^\/adfs(\/|$)/i.test(pathname);
}

function inferDepartmentFromMachineName(machineName: string): GlideDepartment {
  const normalizedMachineName = machineName.trim().toLowerCase();

  if (normalizedMachineName.startsWith('packing station ')) {
    return 'packing';
  }

  if (normalizedMachineName.startsWith('slotstax station ')) {
    return 'slotstax';
  }

  if (normalizedMachineName.startsWith('decant station ')) {
    return 'decant';
  }

  return 'unknown';
}

function normalizeMachineName(context: ScaleRequestContext): string {
  return context.machinename?.trim() ?? '';
}

function readCachedMachineName(): string {
  try {
    return globalThis.localStorage?.getItem('MachineName')?.trim() ?? '';
  } catch {
    return '';
  }
}

function applyModalLayering(activeDocument: Document, modal: HTMLDivElement, backdrop: HTMLDivElement): void {
  const modalZIndex = getModalZIndex(activeDocument);

  backdrop.style.zIndex = String(modalZIndex - 10);
  modal.style.zIndex = String(modalZIndex);
}

function getModalZIndex(activeDocument: Document): number {
  const templateModalZIndex = parseZIndex(activeDocument.getElementById(scaleResetModalId));
  const highestPageZIndex = getHighestPageChromeZIndex(activeDocument);

  return Math.max(templateModalZIndex, highestPageZIndex + 20, 1050);
}

function getHighestPageChromeZIndex(activeDocument: Document): number {
  const chromeSelectors = ['.navbar', '.navbar-fixed-top', '.navbar-fixed-bottom', '.nav-header', 'header', '[role="navigation"]'];
  let highestZIndex = 0;

  for (const element of activeDocument.querySelectorAll<HTMLElement>(chromeSelectors.join(','))) {
    highestZIndex = Math.max(highestZIndex, parseZIndex(element));
  }

  return highestZIndex;
}

function parseZIndex(element: Element | null): number {
  if (!(element instanceof HTMLElement)) {
    return 0;
  }

  const zIndex = globalThis.getComputedStyle(element).zIndex;
  const parsedZIndex = Number.parseInt(zIndex, 10);

  return Number.isFinite(parsedZIndex) ? parsedZIndex : 0;
}

function getStorageArea(): chrome.storage.LocalStorageArea | undefined {
  return globalThis.chrome?.storage?.local;
}

function dispatchSettingsChanged(settingsState: GlideSettingsState): void {
  window.dispatchEvent(new CustomEvent(settingsChangedEventName, { detail: settingsState }));
}

function buildFallbackModal(activeDocument: Document): HTMLDivElement {
  const modal = activeDocument.createElement('div');
  modal.className = 'modal fade';
  modal.innerHTML = `
    <div class="modal-dialog">
      <div class="modal-content"></div>
    </div>
  `;
  return modal;
}

function ensureModalShell(activeDocument: Document, parent: HTMLDivElement, className: string): HTMLDivElement {
  const existingChild = findDirectChildByClass(parent, className);

  if (existingChild) {
    existingChild.className = className;
    return existingChild;
  }

  const shell = activeDocument.createElement('div');
  shell.className = className;

  while (parent.firstChild) {
    shell.append(parent.firstChild);
  }

  parent.append(shell);
  return shell;
}

function findDirectChildByClass(parent: HTMLDivElement, className: string): HTMLDivElement | null {
  for (const child of Array.from(parent.children)) {
    if (child instanceof HTMLDivElement && child.classList.contains(className)) {
      return child;
    }
  }

  return null;
}

function ensureModalSection(parent: Element, tagName: 'div', className: string, controlType: string): HTMLDivElement {
  const existingSection = parent.querySelector<HTMLDivElement>(`.${className}`);

  if (existingSection) {
    existingSection.className = className;
    existingSection.setAttribute('data-controltype', controlType);
    return existingSection;
  }

  const section = parent.ownerDocument.createElement(tagName);
  section.className = className;
  section.setAttribute('data-controltype', controlType);
  parent.append(section);
  return section;
}

function ensureCloseButton(activeDocument: Document, header: HTMLDivElement): HTMLButtonElement {
  const existingButton = header.querySelector<HTMLButtonElement>('button.close');

  if (existingButton) {
    existingButton.type = 'button';
    existingButton.setAttribute('aria-hidden', 'true');
    existingButton.textContent = '×';
    return existingButton;
  }

  const closeButton = activeDocument.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'close';
  closeButton.setAttribute('aria-hidden', 'true');
  closeButton.textContent = '×';
  header.prepend(closeButton);
  return closeButton;
}

function ensureModalTitle(activeDocument: Document, header: HTMLDivElement): HTMLHeadingElement {
  const existingTitle = header.querySelector<HTMLHeadingElement>('.modal-title');

  if (existingTitle) {
    return existingTitle;
  }

  const title = activeDocument.createElement('h4');
  title.className = 'modal-title';
  header.append(title);
  return title;
}