import type { UserActionResponse } from '@blakebecker/glide-shared';

import { callBridgeUserAction } from './bridge-client';
import { resolveScaleThemePalette } from './scale-theme';

const rootClass = 'glide-session-strip';
const rowClass = `${rootClass}__row`;
const pendingRowClass = `${rowClass}--pending-input`;
const fieldClass = `${rootClass}__field`;
const labelClass = `${rootClass}__label`;
const valueClass = `${rootClass}__value`;
const inputShellClass = `${rootClass}__input-shell`;
const actionsClass = `${rootClass}__actions`;
const buttonClass = `${rootClass}__button`;
const errorClass = `${rootClass}__error`;
const styleId = `${rootClass}-style`;
const belowHeaderClass = `${rootClass}--below-header`;
const offsetTargetClass = `${rootClass}--offset-target`;
const fixedToolbarContentTargetClass = `${rootClass}--fixed-toolbar-content-target`;
const offsetVar = `--${rootClass}-offset`;
const offsetBaseTopVar = `--${rootClass}-base-offset-top`;
const offsetBasePaddingVar = `--${rootClass}-base-padding-top`;
const offsetBaseScrollPaddingVar = `--${rootClass}-base-scroll-padding-top`;
const fixedToolbarContentPadding = '0px';
const placeholder = '--';
const eligiblePaths = ['/warehousemobile', '/scale/trans/ex22slotstaxpalletbuild', '/scale/trans/packing'];

interface ActivityOption {
  defaultActivity: string;
  description: string;
  identifier: string;
}

interface SessionRow {
  active: boolean;
  elapsedSeconds: number | null;
  error: string;
  id: number;
  inputValue: string;
  intervalId: number | null;
  loading: boolean;
  options: ActivityOption[];
  pendingInput: boolean;
  removable: boolean;
  selectedActivityType: string;
  startDateTime: string;
  userName: string;
}

export function installSessionStrip(doc: Document = document): () => void {
  if (!isEligiblePage(doc)) {
    return () => undefined;
  }

  let root: HTMLElement | null = null;
  let rootPlacementObserver: MutationObserver | null = null;
  let themeObserver: MutationObserver | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let layoutObserver: MutationObserver | null = null;
  let offsetTargets: HTMLElement[] = [];
  let layoutSyncQueued = false;
  let rootPlacementMode: 'before-content' | 'below-fixed-header' | 'below-fixed-toolbar' | 'body' = 'body';
  let fixedToolbarContentTarget: HTMLElement | null = null;
  let fixedToolbarResetVersion = 0;
  const fixedToolbarBasePadding = new WeakMap<HTMLElement, { priority: string; value: string }>();
  let nextRowId = 1;
  const rows: SessionRow[] = [];

  const createRow = (userName = '', removable = false): SessionRow => ({
    active: false,
    elapsedSeconds: null,
    error: '',
    id: nextRowId,
    inputValue: userName,
    intervalId: null,
    loading: false,
    options: [],
    pendingInput: removable,
    removable,
    selectedActivityType: '',
    startDateTime: '',
    userName,
  });

  const getRoot = (): HTMLElement => {
    ensureStyles(doc);

    if (!root) {
      root = doc.createElement('div');
      root.className = rootClass;
      root.addEventListener('click', handleRootClick);
      root.addEventListener('change', handleRootChange);
      root.addEventListener('input', handleRootInput);
      root.addEventListener('submit', handleRootSubmit);
      startThemeSync();
    }

    syncTheme();

    if (!root.isConnected && !attachRoot()) {
      observeRootPlacement();
    }

    return root;
  };

  const render = (): void => {
    const panel = doc.createElement('div');
    panel.className = `${rootClass}__panel`;

    for (const row of rows) {
      panel.append(renderRow(doc, row, allowsExtraUsers()));
    }

    getRoot().replaceChildren(panel);
    syncLayout();
  };

  const loadRow = async (row: SessionRow, requestedUserName: string): Promise<void> => {
    row.loading = true;
    row.error = '';
    render();

    try {
      const resolvedUserName = row.pendingInput ? await resolveSessionUser(requestedUserName) : normalizeUserName(requestedUserName) || getFallbackUserName();
      ensureUserNotLoaded(rows, row, resolvedUserName);
      hydrateRow(row, await callBridgeUserAction('GetSessionInfo', resolvedUserName || 'INIT'), resolvedUserName);
    } catch (error) {
      row.error = error instanceof Error ? error.message : 'Unable to load session info';
    } finally {
      row.loading = false;
      render();
    }
  };

  const toggleSession = async (row: SessionRow): Promise<void> => {
    row.loading = true;
    row.error = '';
    render();

    try {
      const changeValue = `${getRowRequestedUserName(row) || 'INIT'}|${row.selectedActivityType}`;
      const result = await callBridgeUserAction('StartStopSession', changeValue);
      const messageCode = getString(result.MessageCode ?? result.messageCode);

      if (messageCode.startsWith('ERR_')) {
        throw new Error(getString(result.Message ?? result.message) || 'Unable to update session');
      }

      hydrateRow(row, await callBridgeUserAction('GetSessionInfo', getRowRequestedUserName(row) || 'INIT'), getRowRequestedUserName(row));
    } catch (error) {
      row.error = error instanceof Error ? error.message : 'Unable to update session';
    } finally {
      row.loading = false;
      render();
    }
  };

  async function resolveSessionUser(requestedUserName: string): Promise<string> {
    const normalizedUserName = normalizeUserName(requestedUserName);

    if (!normalizedUserName) {
      throw new Error('Enter a username before loading');
    }

    const payload = await callBridgeUserAction('ResolveSessionUser', normalizedUserName);
    const messageCode = getString(payload.MessageCode ?? payload.messageCode);

    if (messageCode.startsWith('ERR_')) {
      throw new Error(getString(payload.Message ?? payload.message) || 'Unable to resolve user');
    }

    const resolvedUserName = normalizeUserName(payload.UserName ?? payload.userName);

    if (!resolvedUserName) {
      throw new Error('Unable to resolve user');
    }

    return resolvedUserName;
  }

  function handleRootClick(event: MouseEvent): void {
    const target = event.target;
    const button = target instanceof Element ? target.closest<HTMLButtonElement>('button[data-action]') : null;

    if (!button) {
      return;
    }

    const action = button.dataset.action;
    const row = rows.find((candidate) => candidate.id === Number(button.dataset.rowId));

    if (action === 'add-user') {
      const nextRow = createRow('', true);
      nextRowId += 1;
      rows.push(nextRow);
      render();
      getRoot().querySelector<HTMLInputElement>(`input[data-row-id="${nextRow.id}"]`)?.focus();
      return;
    }

    if (!row) {
      return;
    }

    if (action === 'remove-user') {
      clearRowTimer(row);
      rows.splice(rows.indexOf(row), 1);
      render();
      return;
    }

    if (action === 'load-user') {
      void loadRow(row, row.inputValue);
      return;
    }

    if (action === 'toggle-session') {
      void toggleSession(row);
    }
  }

  function handleRootSubmit(event: SubmitEvent): void {
    const form = event.target;

    if (!(form instanceof HTMLFormElement) || form.dataset.action !== 'load-user') {
      return;
    }

    event.preventDefault();
    const row = rows.find((candidate) => candidate.id === Number(form.dataset.rowId));

    if (row) {
      void loadRow(row, row.inputValue);
    }
  }

  function handleRootChange(event: Event): void {
    const select = event.target;

    if (!(select instanceof HTMLSelectElement)) {
      return;
    }

    const row = rows.find((candidate) => candidate.id === Number(select.dataset.rowId));

    if (row) {
      row.selectedActivityType = select.value;
    }
  }

  function handleRootInput(event: Event): void {
    const input = event.target;

    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    const row = rows.find((candidate) => candidate.id === Number(input.dataset.rowId));

    if (row) {
      row.inputValue = input.value;
    }
  }

  const firstRow = createRow(getFallbackUserName());
  nextRowId += 1;
  rows.push(firstRow);
  render();
  void loadRow(firstRow, firstRow.userName || 'INIT');

  return () => {
    rootPlacementObserver?.disconnect();
    themeObserver?.disconnect();
    resizeObserver?.disconnect();
    layoutObserver?.disconnect();

    for (const row of rows) {
      clearRowTimer(row);
    }

    for (const target of offsetTargets) {
      resetOffsetTarget(target);
    }

    if (fixedToolbarContentTarget) {
      resetFixedToolbarContentPadding(fixedToolbarContentTarget);
      fixedToolbarContentTarget = null;
    }

    doc.documentElement.style.removeProperty(offsetVar);
    root?.remove();
  };

  function attachRoot(): boolean {
    if (!root || !doc.body) {
      return false;
    }

    const placement = findRootPlacement();
    rootPlacementMode = placement.mode;
    root.classList.toggle(belowHeaderClass, placement.mode !== 'body');
    root.style.marginTop = placement.marginTop ?? '';

    const needsMove =
      !root.isConnected ||
      root.parentElement !== placement.parent ||
      (placement.before ? root.nextElementSibling !== placement.before : placement.parent.firstElementChild !== root);

    if (needsMove) {
      if (placement.before) {
        placement.before.insertAdjacentElement('beforebegin', root);
      } else {
        placement.parent.prepend(root);
      }
    }

    syncFixedToolbarContentPadding();

    if (typeof ResizeObserver !== 'undefined' && !resizeObserver) {
      resizeObserver = new ResizeObserver(() => {
        syncLayout();
      });
      resizeObserver.observe(root);
    }

    if (!layoutObserver) {
      layoutObserver = new MutationObserver(() => {
        syncLayout();
      });
      layoutObserver.observe(doc.documentElement, { childList: true, subtree: true });
    }

    rootPlacementObserver?.disconnect();
    rootPlacementObserver = null;
    return true;
  }

  function observeRootPlacement(): void {
    if (rootPlacementObserver) {
      return;
    }

    rootPlacementObserver = new MutationObserver(() => {
      attachRoot();
    });
    rootPlacementObserver.observe(doc.documentElement, { childList: true, subtree: true });
  }

  function findRootPlacement(): {
    before: HTMLElement | null;
    marginTop?: string;
    mode: 'before-content' | 'below-fixed-header' | 'below-fixed-toolbar' | 'body';
    parent: HTMLElement;
  } {
    const ionicShell = findIonicHeaderContentShell();

    if (ionicShell) {
      return {
        before: ionicShell.content,
        mode: 'before-content',
        parent: ionicShell.parent,
      };
    }

    const fixedToolbarShell = findFixedToolbarContentShell();

    if (fixedToolbarShell) {
      return fixedToolbarShell;
    }

    const fixedHeaderShell = findFixedHeaderContentShell();

    if (fixedHeaderShell) {
      return {
        before: fixedHeaderShell.before,
        mode: 'below-fixed-header',
        parent: fixedHeaderShell.parent,
      };
    }

    return {
      before: null,
      mode: 'body',
      parent: doc.body,
    };
  }

  function findIonicHeaderContentShell(): { content: HTMLElement; parent: HTMLElement } | null {
    let fallbackMatch: { content: HTMLElement; parent: HTMLElement } | null = null;

    for (const content of Array.from(doc.querySelectorAll<HTMLElement>('ion-content'))) {
      const parent = content.parentElement;
      let sibling = content.previousElementSibling;
      let hasHeader = false;

      if (!parent) {
        continue;
      }

      while (sibling) {
        if (sibling.tagName.toLowerCase() === 'ion-header') {
          hasHeader = true;
          break;
        }

        sibling = sibling.previousElementSibling;
      }

      if (!hasHeader) {
        continue;
      }

      const match = { content, parent };

      if (!fallbackMatch) {
        fallbackMatch = match;
      }

      const pageShell = findPlacementPageShell(parent) ?? parent;

      if (!isPlacementBranchHidden(pageShell)) {
        return match;
      }
    }

    return fallbackMatch;
  }

  function findFixedToolbarContentShell(): {
    before: HTMLElement;
    marginTop?: string;
    mode: 'below-fixed-toolbar';
    parent: HTMLElement;
  } | null {
    const toolbar = doc.querySelector<HTMLElement>('#fixedTopWrapper, .fixedtotop');

    if (!toolbar || isPlacementBranchHidden(toolbar)) {
      return null;
    }

    const form = toolbar.closest<HTMLElement>('form') ?? doc.querySelector<HTMLElement>('#TransactionScreenForm, form[data-controltype="form"]');

    if (!form?.parentElement) {
      return null;
    }

    const toolbarHeight = Math.ceil(toolbar.getBoundingClientRect().height || toolbar.offsetHeight || toolbar.scrollHeight || 0);

    return {
      before: form,
      marginTop: toolbarHeight > 0 ? `${toolbarHeight}px` : '',
      mode: 'below-fixed-toolbar',
      parent: form.parentElement,
    };
  }

  function findFixedHeaderContentShell(): { before: HTMLElement; parent: HTMLElement } | null {
    const header = doc.querySelector<HTMLElement>('#topNavigationBar, .headernavbar.fixed-top, nav.fixed-top, header.fixed-top');

    if (!header || isPlacementBranchHidden(header)) {
      return null;
    }

    let sibling = header.nextElementSibling;

    while (sibling) {
      if (sibling instanceof HTMLElement && sibling !== root && isOffsetTargetCandidate(sibling)) {
        return {
          before: sibling,
          parent: sibling.parentElement ?? doc.body,
        };
      }

      sibling = sibling.nextElementSibling;
    }

    return null;
  }

  function syncLayout(): void {
    if (!root || layoutSyncQueued) {
      return;
    }

    layoutSyncQueued = true;
    defer(() => {
      layoutSyncQueued = false;

      if (!root) {
        return;
      }

      attachRoot();

      if (!root.isConnected) {
        return;
      }

      const nextHeight = Math.ceil(root.getBoundingClientRect().height || root.offsetHeight || root.scrollHeight || 0);
      doc.documentElement.style.setProperty(offsetVar, `${nextHeight}px`);
      syncOffsetTargets();
    });
  }

  function syncOffsetTargets(): void {
    const nextTargets = findOffsetTargets();

    for (const target of offsetTargets) {
      if (!nextTargets.includes(target)) {
        resetOffsetTarget(target);
      }
    }

    for (const target of nextTargets) {
      applyOffsetTarget(target);
    }

    offsetTargets = nextTargets;
  }

  function findOffsetTargets(): HTMLElement[] {
    if (rootPlacementMode === 'before-content' || rootPlacementMode === 'below-fixed-toolbar') {
      return [];
    }

    const ionContentTargets = Array.from(doc.querySelectorAll<HTMLElement>('ion-content')).filter((element) => element !== root && !(root?.contains(element) ?? false));

    if (ionContentTargets.length > 0) {
      return ionContentTargets;
    }

    const semanticTargets = collectOffsetTargets(
      'main, [role="main"], #app, .main-content, .page-content, .content, .scrollablecontent, #scrollableContentWrapper, .fixedtotop, #fixedTopWrapper, #sidr, .sidr',
    );

    if (semanticTargets.length > 0) {
      return semanticTargets;
    }

    if (!doc.body) {
      return [];
    }

    return Array.from(doc.body.children).filter((element): element is HTMLElement => {
      if (!(element instanceof HTMLElement) || element === root) {
        return false;
      }

      const tagName = element.tagName.toLowerCase();
      return tagName !== 'script' && tagName !== 'style' && tagName !== 'link' && isOffsetTargetCandidate(element);
    }).slice(0, 1);
  }

  function collectOffsetTargets(selector: string): HTMLElement[] {
    return Array.from(doc.querySelectorAll<HTMLElement>(selector)).filter((element) => isOffsetTargetCandidate(element));
  }

  function isOffsetTargetCandidate(element: HTMLElement): boolean {
    if (element === root || (root?.contains(element) ?? false)) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    return Boolean(rect.height || element.offsetHeight || element.scrollHeight);
  }

  function applyOffsetTarget(target: HTMLElement): void {
    const activeWindow = doc.defaultView ?? window;
    const isIonContent = target.tagName.toLowerCase() === 'ion-content';
    const hostOffsetExpression = `calc(var(${offsetBaseTopVar}, 0px) + var(${offsetVar}, 0px))`;
    const hostPaddingExpression = `calc(var(${offsetBasePaddingVar}, 0px) + var(${offsetVar}, 0px))`;

    if (isIonContent && !target.style.getPropertyValue(offsetBaseTopVar)) {
      const computed = activeWindow.getComputedStyle(target);
      const baseOffsetTop = target.style.getPropertyValue('--offset-top').trim() || computed.getPropertyValue('--offset-top').trim() || '0px';
      target.style.setProperty(offsetBaseTopVar, baseOffsetTop);
    }

    if (!target.style.getPropertyValue(offsetBasePaddingVar)) {
      const computed = activeWindow.getComputedStyle(target);
      const basePaddingTop =
        (isIonContent ? target.style.getPropertyValue('--padding-top') : '').trim() ||
        (isIonContent ? computed.getPropertyValue('--padding-top') : '').trim() ||
        computed.paddingTop ||
        '0px';
      target.style.setProperty(offsetBasePaddingVar, basePaddingTop);
    }

    target.classList.add(offsetTargetClass);

    if (isIonContent) {
      target.style.setProperty('--offset-top', hostOffsetExpression);
      target.style.setProperty('--padding-top', hostPaddingExpression);

      const scrollElement = getIonContentScrollElement(target);

      if (scrollElement) {
        if (!scrollElement.style.getPropertyValue(offsetBaseScrollPaddingVar)) {
          const computedScroll = activeWindow.getComputedStyle(scrollElement);
          scrollElement.style.setProperty(offsetBaseScrollPaddingVar, computedScroll.paddingTop || '0px');
        }

        scrollElement.style.setProperty('padding-top', `calc(var(${offsetBaseScrollPaddingVar}, 0px) + var(${offsetVar}, 0px))`, 'important');
        scrollElement.style.setProperty('box-sizing', 'border-box');
      }

      return;
    }

    target.style.setProperty('padding-top', `calc(var(${offsetBasePaddingVar}, 0px) + var(${offsetVar}, 0px))`, 'important');
    target.style.setProperty('box-sizing', 'border-box');
  }

  function resetOffsetTarget(target: HTMLElement): void {
    const baseOffsetTop = target.style.getPropertyValue(offsetBaseTopVar).trim();
    const basePaddingTop = target.style.getPropertyValue(offsetBasePaddingVar).trim();

    target.classList.remove(offsetTargetClass);
    target.style.removeProperty('--offset-top');
    target.style.removeProperty('--padding-top');

    if (baseOffsetTop) {
      target.style.setProperty('top', baseOffsetTop);
    } else {
      target.style.removeProperty('top');
    }

    if (basePaddingTop) {
      target.style.setProperty('padding-top', basePaddingTop);
    } else {
      target.style.removeProperty('padding-top');
    }

    target.style.removeProperty('box-sizing');
    target.style.removeProperty(offsetBaseTopVar);
    target.style.removeProperty(offsetBasePaddingVar);

    const scrollElement = getIonContentScrollElement(target);

    if (scrollElement) {
      const baseScrollPaddingTop = scrollElement.style.getPropertyValue(offsetBaseScrollPaddingVar).trim();

      if (baseScrollPaddingTop) {
        scrollElement.style.setProperty('padding-top', baseScrollPaddingTop);
      } else {
        scrollElement.style.removeProperty('padding-top');
      }

      scrollElement.style.removeProperty('box-sizing');
      scrollElement.style.removeProperty(offsetBaseScrollPaddingVar);
    }
  }

  function getIonContentScrollElement(target: HTMLElement): HTMLElement | null {
    if (target.tagName.toLowerCase() !== 'ion-content' || !target.shadowRoot) {
      return null;
    }

    const scrollElement = target.shadowRoot.querySelector('[part="scroll"]');
    return scrollElement instanceof HTMLElement ? scrollElement : null;
  }

  function findPlacementPageShell(element: Element): HTMLElement | null {
    return element.closest<HTMLElement>('.ion-page, app-generic-menu, app-generic-view-processor, ion-app');
  }

  function isPlacementBranchHidden(element: HTMLElement): boolean {
    let current: HTMLElement | null = element;

    while (current) {
      if (current.hidden || current.getAttribute('aria-hidden') === 'true' || current.classList.contains('ion-page-hidden')) {
        return true;
      }

      current = current.parentElement;
    }

    return false;
  }

  function syncFixedToolbarContentPadding(): void {
    const nextTarget = rootPlacementMode === 'below-fixed-toolbar' ? findFixedToolbarContentPaddingTarget() : null;

    if (fixedToolbarContentTarget && fixedToolbarContentTarget !== nextTarget) {
      if (!nextTarget) {
        const currentTarget = fixedToolbarContentTarget;
        const resetVersion = ++fixedToolbarResetVersion;

        defer(() => {
          if (fixedToolbarResetVersion !== resetVersion || fixedToolbarContentTarget !== currentTarget) {
            return;
          }

          resetFixedToolbarContentPadding(currentTarget);
          fixedToolbarContentTarget = null;
        });

        return;
      }

      resetFixedToolbarContentPadding(fixedToolbarContentTarget);
    }

    fixedToolbarResetVersion += 1;

    if (nextTarget) {
      applyFixedToolbarContentPadding(nextTarget);
    }

    fixedToolbarContentTarget = nextTarget;
  }

  function findFixedToolbarContentPaddingTarget(): HTMLElement | null {
    const toolbar = doc.querySelector<HTMLElement>('#fixedTopWrapper, .fixedtotop');

    if (!toolbar || isPlacementBranchHidden(toolbar)) {
      return null;
    }

    const form = toolbar.closest<HTMLElement>('form') ?? doc.querySelector<HTMLElement>('#TransactionScreenForm, form[data-controltype="form"]');
    return form?.querySelector<HTMLElement>('#scrollableContentWrapper, .scrollablecontent') ?? null;
  }

  function applyFixedToolbarContentPadding(target: HTMLElement): void {
    const activeWindow = doc.defaultView ?? window;

    if (!fixedToolbarBasePadding.has(target)) {
      const computed = activeWindow.getComputedStyle(target);
      const basePaddingTop = target.style.getPropertyValue('padding-top').trim() || computed.paddingTop || '0px';
      const basePriority = target.style.getPropertyPriority('padding-top').trim();
      fixedToolbarBasePadding.set(target, {
        priority: basePriority,
        value: basePaddingTop,
      });
    }

    target.classList.add(fixedToolbarContentTargetClass);
    target.style.setProperty('padding-top', fixedToolbarContentPadding, 'important');
  }

  function resetFixedToolbarContentPadding(target: HTMLElement): void {
    const basePadding = fixedToolbarBasePadding.get(target);
    const basePaddingTop = basePadding?.value.trim() ?? '';
    const basePriority = basePadding?.priority.trim() ?? '';

    target.classList.remove(fixedToolbarContentTargetClass);

    if (basePaddingTop) {
      target.style.setProperty('padding-top', basePaddingTop, basePriority === 'important' ? 'important' : undefined);
    } else {
      target.style.removeProperty('padding-top');
    }

    fixedToolbarBasePadding.delete(target);
  }

  function startThemeSync(): void {
    if (themeObserver) {
      return;
    }

    themeObserver = new MutationObserver(() => {
      syncTheme();
    });
    themeObserver.observe(doc.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme', 'style', 'hidden', 'aria-hidden'],
      childList: true,
      subtree: true,
    });
  }

  function syncTheme(): void {
    if (!root) {
      return;
    }

    const palette = resolveScaleThemePalette(doc, [root]);
    root.style.setProperty(`--${rootClass}-font`, palette.fontFamily);
    root.style.setProperty(`--${rootClass}-text`, palette.text);
    root.style.setProperty(`--${rootClass}-muted`, palette.muted);
    root.style.setProperty(`--${rootClass}-placeholder`, palette.placeholder);
    root.style.setProperty(`--${rootClass}-panel-bg`, palette.panelBackground);
    root.style.setProperty(`--${rootClass}-field-bg`, palette.fieldBackground);
    root.style.setProperty(`--${rootClass}-input-bg`, palette.inputBackground);
    root.style.setProperty(`--${rootClass}-input-text`, palette.inputText);
    root.style.setProperty(`--${rootClass}-border`, palette.border);
    root.style.setProperty(`--${rootClass}-row-border`, palette.rowBorder);
    root.style.setProperty(`--${rootClass}-button-border`, palette.buttonBorder);
    root.style.setProperty(`--${rootClass}-start-bg`, palette.startButton);
    root.style.setProperty(`--${rootClass}-start-text`, palette.startButtonText);
    root.style.setProperty(`--${rootClass}-stop-bg`, palette.stopButton);
    root.style.setProperty(`--${rootClass}-stop-text`, palette.stopButtonText);
    root.style.setProperty(`--${rootClass}-secondary-bg`, palette.secondaryButton);
    root.style.setProperty(`--${rootClass}-secondary-text`, palette.secondaryButtonText);
    root.style.setProperty(`--${rootClass}-error`, palette.error);
  }
}

function renderRow(doc: Document, row: SessionRow, allowExtraUsers: boolean): HTMLElement {
  const element = doc.createElement('div');
  element.className = row.pendingInput ? `${rowClass} ${pendingRowClass}` : rowClass;
  element.dataset.rowId = String(row.id);
  element.append(
    renderUserField(doc, row),
    renderActivityField(doc, row),
    renderMetric(doc, 'Start time', row.startDateTime, 'start-time', true),
    renderMetric(doc, 'Elapsed time', formatElapsed(row.elapsedSeconds), 'elapsed-time'),
    renderActions(doc, row, allowExtraUsers),
  );

  if (row.error) {
    const error = doc.createElement('div');
    error.className = errorClass;
    error.textContent = row.error;
    element.append(error);
  }

  return element;
}

function renderUserField(doc: Document, row: SessionRow): HTMLElement {
  const field = createField(doc, 'User', `${fieldClass}--user`);

  if (row.pendingInput) {
    const form = doc.createElement('form');
    form.className = inputShellClass;
    form.dataset.action = 'load-user';
    form.dataset.rowId = String(row.id);
    const input = doc.createElement('input');
    input.autocomplete = 'off';
    input.dataset.rowId = String(row.id);
    input.dataset.role = 'username-input';
    input.disabled = row.loading;
    input.placeholder = 'Enter username';
    input.value = row.inputValue;
    form.append(input);
    field.append(form);
    return field;
  }

  const value = createValue(doc, row.userName || placeholder, !row.userName ? `${valueClass}--placeholder` : undefined);
  value.dataset.role = 'username-value';
  field.append(value);
  return field;
}

function renderActivityField(doc: Document, row: SessionRow): HTMLElement {
  const field = createField(doc, 'Activity', `${fieldClass}--activity`);

  if (row.pendingInput) {
    const button = createButton(doc, row.loading ? 'Loading...' : 'Load', 'load-user', row.id, 'secondary');
    button.disabled = row.loading;
    button.classList.add(`${buttonClass}--load`);
    field.append(button);
    return field;
  }

  const select = doc.createElement('select');
  select.dataset.rowId = String(row.id);
  select.dataset.role = 'activity-select';
  select.disabled = row.loading || row.active || row.options.length === 0;

  for (const option of row.options) {
    const optionElement = doc.createElement('option');
    optionElement.value = option.identifier;
    optionElement.textContent = option.description;
    optionElement.selected = option.identifier === row.selectedActivityType;
    select.append(optionElement);
  }

  if (row.options.length === 0) {
    const optionElement = doc.createElement('option');
    optionElement.textContent = 'No activities available';
    select.append(optionElement);
  }

  field.append(select);
  return field;
}

function renderMetric(doc: Document, label: string, value: string, role: string, anchor = false): HTMLElement {
  const field = createField(doc, label, `${fieldClass}--metric${anchor ? ` ${fieldClass}--metric-anchor` : ''}`);
  const metricValue = createValue(
    doc,
    value || placeholder,
    `${valueClass}--status${!value || value === placeholder ? ` ${valueClass}--placeholder` : ''}`,
  );
  metricValue.dataset.role = role;
  field.append(metricValue);
  return field;
}

function renderActions(doc: Document, row: SessionRow, allowExtraUsers: boolean): HTMLElement {
  const actions = doc.createElement('div');
  actions.className = actionsClass;

  const toggle = createButton(doc, row.active ? 'Stop' : 'Start', 'toggle-session', row.id, row.active ? 'stop' : 'start');
  toggle.disabled = row.loading || row.pendingInput;
  actions.append(toggle);

  if (allowExtraUsers) {
    actions.append(createButton(doc, row.removable ? 'Remove user' : 'Add user', row.removable ? 'remove-user' : 'add-user', row.id, 'secondary'));
  }

  return actions;
}

function createField(doc: Document, labelText: string, variantClass?: string): HTMLElement {
  const field = doc.createElement('div');
  field.className = variantClass ? `${fieldClass} ${variantClass}` : fieldClass;
  const label = doc.createElement('div');
  label.className = labelClass;
  label.textContent = labelText;
  field.append(label);
  return field;
}

function createValue(doc: Document, text: string, variantClass?: string): HTMLElement {
  const value = doc.createElement('div');
  value.className = variantClass ? `${valueClass} ${variantClass}` : valueClass;
  value.textContent = text;
  return value;
}

function createButton(doc: Document, text: string, action: string, rowId: number, variant: string): HTMLButtonElement {
  const button = doc.createElement('button');
  button.type = 'button';
  button.className = `${buttonClass} ${buttonClass}--${variant}`;
  button.dataset.action = action;
  button.dataset.rowId = String(rowId);
  button.textContent = text;
  return button;
}

function hydrateRow(row: SessionRow, payload: UserActionResponse, requestedUserName: string): void {
  clearRowTimer(row);
  row.pendingInput = false;
  row.userName = getString(payload.UserName ?? payload.USER_NAME) || requestedUserName;
  row.inputValue = row.userName;
  row.options = parseActivityOptions(payload.ActivityOptionsJson ?? payload.activityOptionsJson);
  row.selectedActivityType = getString(payload.SelectedActivityType ?? payload.selectedActivityType) || getDefaultActivity(row.options);
  row.startDateTime = formatStartTime(getString(payload.StartDateTime ?? payload.START_DATE_TIME));
  row.elapsedSeconds = parseElapsedTime(payload.ElapsedTime ?? payload.ELAPSED_TIME);
  row.active = toBoolean(payload.HasActiveSession ?? payload.hasActiveSession);

  if (row.active && row.elapsedSeconds !== null) {
    row.intervalId = window.setInterval(() => {
      row.elapsedSeconds = (row.elapsedSeconds ?? 0) + 1;
      updateMetricValue(row.id, 'elapsed-time', formatElapsed(row.elapsedSeconds));
    }, 1000);
  }
}

function updateMetricValue(rowId: number, role: string, nextValue: string): void {
  const value = document.querySelector<HTMLElement>(`[data-row-id="${rowId}"] [data-role="${role}"]`);

  if (!value) {
    return;
  }

  value.textContent = nextValue;
  value.classList.toggle(`${valueClass}--placeholder`, nextValue === placeholder);
}

function parseActivityOptions(value: unknown): ActivityOption[] {
  const parsedValue = typeof value === 'string' ? parseJson(value) : value;

  if (!Array.isArray(parsedValue)) {
    return [];
  }

  return parsedValue.flatMap((option) => {
    if (!option || typeof option !== 'object') {
      return [];
    }

    const candidate = option as Record<string, unknown>;
    const identifier = getString(candidate.IDENTIFIER ?? candidate.Identifier ?? candidate.identifier);

    return identifier
      ? [{ defaultActivity: getString(candidate.DEFAULT_ACTIVITY ?? candidate.defaultActivity) || 'N', description: getString(candidate.DESCRIPTION ?? candidate.Description ?? candidate.description) || identifier, identifier }]
      : [];
  });
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

function getDefaultActivity(options: ActivityOption[]): string {
  return options.find((option) => option.defaultActivity.toUpperCase() === 'Y')?.identifier ?? options[0]?.identifier ?? '';
}

function ensureUserNotLoaded(rows: SessionRow[], row: SessionRow, userName: string): void {
  if (rows.some((candidate) => candidate !== row && normalizeUserName(candidate.userName) === normalizeUserName(userName))) {
    throw new Error(`${userName} is already on the strip.`);
  }
}

function clearRowTimer(row: SessionRow): void {
  if (row.intervalId !== null) {
    window.clearInterval(row.intervalId);
    row.intervalId = null;
  }
}

function getRowRequestedUserName(row: SessionRow): string {
  return normalizeUserName(row.userName || row.inputValue || getFallbackUserName());
}

function getFallbackUserName(): string {
  return normalizeUserName(parseUserInformationCookie().UserName ?? '');
}

function parseUserInformationCookie(): Record<string, string> {
  const cookie = document.cookie.split(';').map((value) => value.trim()).find((value) => value.startsWith('UserInformation='));

  if (!cookie) {
    return {};
  }

  return cookie.slice('UserInformation='.length).split('&').reduce<Record<string, string>>((values, segment) => {
    const [key, ...rest] = segment.split('=');

    if (key) {
      values[decodeURIComponent(key)] = decodeURIComponent(rest.join('='));
    }

    return values;
  }, {});
}

function allowsExtraUsers(): boolean {
  return readCachedMachineName().toLowerCase().startsWith('slotstax station ');
}

function readCachedMachineName(): string {
  try {
    return localStorage.getItem('MachineName')?.trim() ?? '';
  } catch {
    return '';
  }
}

function isEligiblePage(doc: Document): boolean {
  const normalizedPath = location.pathname.toLowerCase().replace(/\/+$/, '') || '/';

  return !doc.getElementById('loginForm') && eligiblePaths.includes(normalizedPath);
}

function normalizeUserName(value: unknown): string {
  let text = getString(value);

  if (text.includes('\\')) {
    text = text.slice(text.lastIndexOf('\\') + 1);
  }

  if (text.includes('@')) {
    text = text.slice(0, text.indexOf('@'));
  }

  return text;
}

function getString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function toBoolean(value: unknown): boolean {
  return value === true || (typeof value === 'string' && value.toLowerCase() === 'true');
}

function parseElapsedTime(value: unknown): number | null {
  const text = getString(value);
  const parts = text.split(':').map((part) => Number(part));

  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
    return null;
  }

  const [hours, minutes, seconds] = parts as [number, number, number];
  return hours * 3600 + minutes * 60 + seconds;
}

function formatElapsed(totalSeconds: number | null): string {
  if (totalSeconds === null) {
    return placeholder;
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
}

function formatStartTime(value: string): string {
  const match = value.match(/^(\d{2})-(\d{2})-(\d{4})\/(\d{2}):(\d{2})/);

  if (!match) {
    return value;
  }

  const hour = Number(match[4]);
  const minute = match[5];
  const period = hour >= 12 ? 'PM' : 'AM';

  return `${hour % 12 || 12}:${minute} ${period}`;
}

function defer(callback: () => void): void {
  const activeWindow = globalThis.window;

  if (typeof activeWindow?.requestAnimationFrame === 'function') {
    activeWindow.requestAnimationFrame(callback);
    return;
  }

  activeWindow?.setTimeout(callback, 0);
}

function ensureStyles(doc: Document): void {
  if (doc.getElementById(styleId)) {
    return;
  }

  const style = doc.createElement('style');
  style.id = styleId;
  style.textContent = `
    .${rootClass} {
      position: sticky;
      top: 0;
      z-index: 2147483638;
      pointer-events: none;
      width: 100%;
      font: 600 14px/1.35 var(--${rootClass}-font, var(--ion-font-family, "Segoe UI", system-ui, sans-serif));
      color: var(--${rootClass}-text, CanvasText);
    }
    .${belowHeaderClass} {
      position: relative;
      top: auto;
      z-index: 11;
    }
    .${rootClass}__panel {
      pointer-events: auto;
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 12px 16px;
      background: var(--${rootClass}-panel-bg, Canvas);
      color: var(--${rootClass}-text, CanvasText);
      border-bottom: 1px solid var(--${rootClass}-border, currentColor);
      backdrop-filter: blur(8px);
    }
    .${rowClass} {
      display: flex;
      flex-wrap: wrap;
      align-items: end;
      gap: 12px;
      padding: 10px 0;
      border-top: 1px solid var(--${rootClass}-row-border, currentColor);
    }
    .${pendingRowClass} {
      column-gap: 16px;
    }
    .${rowClass}:first-child {
      border-top: 0;
      padding-top: 0;
    }
    .${fieldClass} {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
    }
    .${fieldClass}--user {
      flex: 0 1 170px;
    }
    .${fieldClass}--activity {
      flex: 0 1 210px;
    }
    .${pendingRowClass} .${fieldClass}--activity {
      padding-left: 4px;
    }
    .${fieldClass}--metric {
      flex: 0 1 110px;
      align-items: flex-end;
      text-align: right;
    }
    .${fieldClass}--metric-anchor {
      margin-left: auto;
    }
    .${labelClass} {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--${rootClass}-muted, currentColor);
    }
    .${valueClass}, .${rootClass} input, .${rootClass} select {
      min-height: 40px;
      padding: 0 12px;
      border: 1px solid var(--${rootClass}-border, currentColor);
      border-radius: 10px;
      background: var(--${rootClass}-input-bg, transparent);
      color: var(--${rootClass}-input-text, inherit);
      box-sizing: border-box;
    }
    .${valueClass} {
      display: flex;
      align-items: center;
      background: var(--${rootClass}-field-bg, transparent);
      color: var(--${rootClass}-text, inherit);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .${valueClass}--status {
      width: 100%;
      min-height: auto;
      justify-content: flex-end;
      text-align: right;
      padding: 0;
      border: 0;
      border-radius: 0;
      background: transparent;
      font-weight: 700;
    }
    .${valueClass}--placeholder {
      color: var(--${rootClass}-placeholder, currentColor);
    }
    .${rootClass} input:disabled,
    .${rootClass} select:disabled {
      opacity: 0.65;
      cursor: not-allowed;
    }
    .${inputShellClass} {
      display: block;
      width: 100%;
    }
    .${actionsClass} {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: nowrap;
    }
    .${buttonClass} {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 40px;
      padding: 0 14px;
      border: 1px solid var(--${rootClass}-button-border, currentColor);
      border-radius: 10px;
      font: inherit;
      font-weight: 700;
      text-align: center;
      cursor: pointer;
      transition: filter 80ms ease, transform 80ms ease;
    }
    .${actionsClass} .${buttonClass}--start,
    .${actionsClass} .${buttonClass}--stop {
      flex: 0 0 72px;
      width: 72px;
    }
    .${actionsClass} .${buttonClass}--secondary {
      flex: 0 0 116px;
      width: 116px;
    }
    .${rootClass} .${buttonClass}--load {
      width: 100%;
    }
    .${buttonClass}:hover {
      filter: brightness(1.08);
    }
    .${buttonClass}:active {
      transform: translateY(1px);
    }
    .${buttonClass}:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      filter: none;
      transform: none;
    }
    .${buttonClass}--start {
      background: var(--${rootClass}-start-bg, ButtonFace);
      color: var(--${rootClass}-start-text, ButtonText);
    }
    .${buttonClass}--stop {
      background: var(--${rootClass}-stop-bg, ButtonFace);
      color: var(--${rootClass}-stop-text, ButtonText);
    }
    .${buttonClass}--secondary {
      background: var(--${rootClass}-secondary-bg, transparent);
      color: var(--${rootClass}-secondary-text, inherit);
    }
    .${errorClass} {
      flex-basis: 100%;
      margin-top: -2px;
      font-size: 12px;
      color: var(--${rootClass}-error, currentColor);
    }
    ion-content.${offsetTargetClass} {
      --offset-top: calc(var(${offsetBaseTopVar}, 0px) + var(${offsetVar}, 0px));
      --padding-top: calc(var(${offsetBasePaddingVar}, 0px) + var(${offsetVar}, 0px));
    }
    ion-content.${offsetTargetClass}::part(scroll) {
      padding-top: calc(var(${offsetBasePaddingVar}, 0px) + var(${offsetVar}, 0px)) !important;
      box-sizing: border-box;
    }
    .${fixedToolbarContentTargetClass} {
      padding-top: ${fixedToolbarContentPadding} !important;
    }
    @media (max-width: 900px) {
      .${rootClass}__panel { padding: 12px; }
      .${actionsClass} { width: 100%; margin-left: 0; justify-content: flex-end; }
      .${fieldClass}--metric { flex: 1 1 140px; }
    }
    @media (max-width: 640px) {
      .${rowClass} { gap: 10px; }
      .${fieldClass}--user,
      .${fieldClass}--activity,
      .${fieldClass}--metric { flex-basis: 100%; }
      .${actionsClass} { justify-content: stretch; flex-wrap: wrap; }
      .${actionsClass} .${buttonClass} { flex: 1 1 0; width: auto; }
      .${inputShellClass} { width: 100%; }
    }
  `;
  doc.head.append(style);
}