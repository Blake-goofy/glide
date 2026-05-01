import { callBridgeUserAction, showBridgeToast } from './bridge-client';

const actionId = 'GlideArriveAllTotesAction';
const actionItemClass = 'glide-arrive-all-totes-action';
const actionName = 'ArriveAllTotes';
const leadAccessCode = 'AAT-LEAD-CODE-1573';
const leadApprovalBackdropId = 'GlideArriveAllTotesModalBackdrop';
const leadApprovalMessage = 'All totes for this pallet will be marked arrived.';
const leadApprovalPrompt = 'Scan team lead barcode';
const leadApprovalError = 'Team lead code was not accepted.';
const leadApprovalModalId = 'GlideArriveAllTotesModal';
const leadApprovalFormId = 'GlideArriveAllTotesApprovalForm';
const leadApprovalInputId = 'GlideArriveAllTotesApprovalCode';
const leadApprovalErrorId = 'GlideArriveAllTotesApprovalError';
const leadApprovalStyleId = 'glide-arrive-all-totes-modal-style';
const modalOpenClassName = 'glide-arrive-all-totes-modal-open';

type ActivityOption = {
  defaultActivity: string;
  identifier: string;
};

type BootstrapWindow = Window & typeof globalThis & {
  toastr?: Record<string, unknown> & {
    error?: (...args: unknown[]) => void;
    options?: Record<string, unknown>;
    success?: (...args: unknown[]) => void;
  };
};

export function installArriveAllTotes(doc: Document = document): () => void {
  const activeWindow = (doc.defaultView ?? window) as BootstrapWindow;
  let actionLink: HTMLAnchorElement | null = null;
  let observer: MutationObserver | null = null;
  let syncQueued = false;
  let running = false;
  let approvalPending = false;

  const queueSync = (): void => {
    if (syncQueued) {
      return;
    }

    syncQueued = true;
    defer(activeWindow, () => {
      syncQueued = false;
      syncAction();
    });
  };

  const syncAction = (): void => {
    if (!isEligiblePage(doc)) {
      removeActionItem();
      return;
    }

    const menu = findActionsMenu(doc);

    if (!menu) {
      removeActionItem();
      return;
    }

    const link = ensureActionLink(doc, menu);
    actionLink = link;
    updateActionDisabledState(link, running, approvalPending, canArriveTotes(doc));
  };

  const handleDocumentClick = (event: Event): void => {
    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const link = target.closest(`#${actionId}`);

    if (!(link instanceof HTMLAnchorElement)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (link.getAttribute('aria-disabled') === 'true') {
      return;
    }

    void handleArriveAllTotes(link);
  };

  const handleArriveAllTotes = async (link: HTMLAnchorElement): Promise<void> => {
    if (running) {
      return;
    }

    const palletId = getPalletId(doc);

    if (!palletId) {
      void showBridgeToast('Unable to determine the pallet ID.', 'error');
      return;
    }

    approvalPending = true;
    updateActionDisabledState(link, running, approvalPending, canArriveTotes(doc));

    let approved = false;

    try {
      approved = await requestLeadApproval(doc, activeWindow);
    } finally {
      approvalPending = false;
      updateActionDisabledState(link, running, approvalPending, canArriveTotes(doc));
    }

    if (!approved) {
      return;
    }

    running = true;
    link.textContent = 'Arriving...';
    updateActionDisabledState(link, running, approvalPending, canArriveTotes(doc));

    try {
      const workstationActivity = await resolveWorkstationActivityType(doc);
      const payload = await callBridgeUserAction(actionName, workstationActivity || 'INIT', palletId);
      const messageCode = getString(payload.MessageCode ?? payload.messageCode);

      if (messageCode.startsWith('ERR_')) {
        throw new Error(getString(payload.Message ?? payload.message) || 'Unable to arrive totes.');
      }

      void showBridgeToast(getString(payload.Message ?? payload.message) || 'Totes marked as arrived.', 'success');
      queueSync();
    } catch (error) {
      void showBridgeToast(error instanceof Error ? error.message : 'Unable to arrive totes.', 'error');
    } finally {
      running = false;
      link.textContent = 'Arrive all totes';
      updateActionDisabledState(link, running, approvalPending, canArriveTotes(doc));
    }
  };

  doc.addEventListener('click', handleDocumentClick, true);
  doc.addEventListener('input', queueSync, true);
  doc.addEventListener('change', queueSync, true);

  observer = new MutationObserver(queueSync);
  observer.observe(doc.documentElement, {
    attributeFilter: ['class', 'style', 'value'],
    attributes: true,
    childList: true,
    subtree: true,
  });

  syncAction();

  return () => {
    doc.removeEventListener('click', handleDocumentClick, true);
    doc.removeEventListener('input', queueSync, true);
    doc.removeEventListener('change', queueSync, true);
    observer?.disconnect();
    removeActionItem();
    doc.getElementById(leadApprovalModalId)?.remove();
  };

  function removeActionItem(): void {
    actionLink?.closest(`.${actionItemClass}`)?.remove();
    doc.querySelector(`.${actionItemClass}`)?.remove();
    actionLink = null;
  }
}

async function resolveWorkstationActivityType(doc: Document): Promise<string> {
  const sessionInfo = await callBridgeUserAction('GetSessionInfo', 'INIT', getMachineName(doc) || 'INIT');
  const selectedActivity = getString(sessionInfo.SelectedActivityType ?? sessionInfo.selectedActivityType);

  if (selectedActivity) {
    return selectedActivity;
  }

  const currentActivity = getString(sessionInfo.CurrentActivityType ?? sessionInfo.currentActivityType);

  if (currentActivity) {
    return currentActivity;
  }

  const defaultActivity = getDefaultActivity(parseActivityOptions(sessionInfo.ActivityOptionsJson ?? sessionInfo.activityOptionsJson));

  if (defaultActivity) {
    return defaultActivity;
  }

  return deriveActivityTypeFromMachineName(getMachineName(doc));
}

function isEligiblePage(doc: Document): boolean {
  return !(doc.getElementById('loginForm') instanceof HTMLFormElement);
}

function findActionsMenu(doc: Document): HTMLElement | null {
  const dropdown = doc.getElementById('EX22PalBuildActionsDropdown');

  if (!(dropdown instanceof HTMLElement)) {
    return null;
  }

  const owner = dropdown.closest('li') ?? dropdown.parentElement;
  const menu = owner?.querySelector('ul.dropdown-menu');
  return menu instanceof HTMLElement ? menu : null;
}

function ensureActionLink(doc: Document, menu: HTMLElement): HTMLAnchorElement {
  const existing = doc.getElementById(actionId);

  if (existing instanceof HTMLAnchorElement && menu.contains(existing)) {
    return existing;
  }

  const item = doc.createElement('li');
  item.className = `dropdownaction menubutton ${actionItemClass}`;

  const link = doc.createElement('a');
  link.id = actionId;
  link.href = '#';
  link.textContent = 'Arrive all totes';
  item.append(link);
  menu.append(item);
  return link;
}

function updateActionDisabledState(link: HTMLAnchorElement, running: boolean, approvalPending: boolean, canArrive: boolean): void {
  const disabled = running || approvalPending || !canArrive;
  const item = link.closest('li');

  link.setAttribute('aria-disabled', disabled ? 'true' : 'false');
  link.tabIndex = disabled ? -1 : 0;
  link.classList.toggle('disabled', disabled);
  link.style.opacity = disabled ? '0.55' : '';
  link.style.pointerEvents = disabled ? 'none' : '';

  if (item instanceof HTMLElement) {
    item.classList.toggle('disabled', disabled);
  }
}

function canArriveTotes(doc: Document): boolean {
  const inTransit = getNumericFieldValue(doc, 'EX22PalBuildToteStatusTotesInTransitValue');
  return inTransit != null && inTransit >= 1;
}

function getPalletId(doc: Document): string {
  return getFieldTextValue(doc, 'PalletId');
}

function getNumericFieldValue(doc: Document, fieldName: string): number | null {
  const input = queryFieldInput(doc, fieldName);

  if (input instanceof HTMLInputElement) {
    return parseNumber(input.value);
  }

  const host = doc.getElementById(fieldName);

  if (host && 'value' in host) {
    return parseNumber((host as { value?: unknown }).value);
  }

  return null;
}

function getFieldTextValue(doc: Document, fieldName: string): string {
  const input = queryFieldInput(doc, fieldName);

  if (input instanceof HTMLInputElement) {
    return getString(input.value);
  }

  const host = doc.getElementById(fieldName);

  if (host && 'value' in host) {
    return getString((host as { value?: unknown }).value);
  }

  return '';
}

function queryFieldInput(doc: Document, fieldName: string): Element | null {
  return (
    doc.querySelector(`input[name="${fieldName}"]`) ??
    doc.querySelector(`#${fieldName} input[type="hidden"]`) ??
    doc.querySelector(`#${fieldName} input`)
  );
}

async function requestLeadApproval(
  doc: Document,
  activeWindow: BootstrapWindow,
): Promise<boolean> {
  return requestLeadApprovalModal(doc, activeWindow, leadAccessCode);
}

function requestLeadApprovalModal(doc: Document, activeWindow: BootstrapWindow, leadAccessCode: string): Promise<boolean> {
  if (!doc.body) {
    return Promise.resolve(false);
  }

  ensureLeadApprovalModalStyles(doc);

  let modal = doc.getElementById(leadApprovalModalId);
  let backdrop = doc.getElementById(leadApprovalBackdropId);

  if (!(modal instanceof HTMLDivElement)) {
    modal = doc.createElement('div');
    modal.id = leadApprovalModalId;
    modal.className = 'modal fade';
    modal.tabIndex = -1;
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
      <div class="modal-dialog" role="document">
        <div class="modal-content">
          <div class="modal-header" data-controltype="modalDialogHeader">
            <button aria-hidden="true" class="close" data-bs-dismiss="modal" data-dismiss="modal" data-result="cancel" type="button">×</button>
            <h4 class="modal-title">Team lead approval</h4>
          </div>
          <form id="${leadApprovalFormId}" autocomplete="off">
            <div class="modal-body">
              <p>${leadApprovalMessage}</p>
              <label class="LabelTop" for="${leadApprovalInputId}">${leadApprovalPrompt}</label>
              <div class="ui-igedit ui-igedit-container ui-widget ui-corner-all ui-state-default" style="width: 100%; height: 25px;">
                <div class="ui-igeditor-input-container ui-corner-all">
                  <input aria-label="Team lead barcode" autocomplete="off" class="ignore ui-igedit-input" id="${leadApprovalInputId}" inputmode="text" role="textbox" style="box-sizing: border-box; height: 100%; text-align: left; width: 100%;" type="password">
                </div>
              </div>
              <div aria-live="polite" class="text-danger" id="${leadApprovalErrorId}"></div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-default" data-result="cancel" type="button">Cancel</button>
              <button class="btn btn-default" type="submit">Submit</button>
            </div>
          </form>
        </div>
      </div>
    `;
    doc.body.append(modal);
  }

  if (!(backdrop instanceof HTMLDivElement)) {
    backdrop = doc.createElement('div');
    backdrop.id = leadApprovalBackdropId;
    backdrop.className = 'modal-backdrop fade';
    backdrop.style.display = 'none';
    doc.body.append(backdrop);
  }

  return new Promise((resolve) => {
    const input = doc.getElementById(leadApprovalInputId);
    const error = doc.getElementById(leadApprovalErrorId);
    const form = doc.getElementById(leadApprovalFormId);
    const previouslyFocused = doc.activeElement instanceof HTMLElement ? doc.activeElement : null;
    let settled = false;

    if (!(input instanceof HTMLInputElement) || !(form instanceof HTMLFormElement) || !(modal instanceof HTMLDivElement) || !(backdrop instanceof HTMLDivElement)) {
      resolve(false);
      return;
    }

    input.value = '';
    input.removeAttribute('aria-invalid');

    if (error instanceof HTMLElement) {
      error.textContent = '';
    }

    const finish = (approved: boolean): void => {
      if (settled) {
        return;
      }

      settled = true;
      form.removeEventListener('submit', handleSubmit);
      modal.removeEventListener('click', handleModalClick);
      modal.removeEventListener('keydown', handleModalKeydown);
      closeLeadApprovalModal(doc, modal, backdrop);
      previouslyFocused?.focus();
      resolve(approved);
    };

    const rejectCode = (): void => {
      input.value = '';
      input.setAttribute('aria-invalid', 'true');

      if (error instanceof HTMLElement) {
        error.textContent = leadApprovalError;
      }

      input.focus();
    };

    const handleSubmit = (event: Event): void => {
      event.preventDefault();

      if (isLeadAccessCode(input.value, leadAccessCode)) {
        finish(true);
        return;
      }

      rejectCode();
    };

    const handleModalClick = (event: Event): void => {
      const target = event.target;
      const resultButton = target instanceof Element ? target.closest('[data-result]') : null;

      if (!(resultButton instanceof HTMLElement)) {
        return;
      }

      if (resultButton.dataset.result === 'cancel') {
        finish(false);
      }
    };

    const handleModalKeydown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        finish(false);
      }
    };

    form.addEventListener('submit', handleSubmit);
    modal.addEventListener('click', handleModalClick);
    modal.addEventListener('keydown', handleModalKeydown);
    openLeadApprovalModal(doc, activeWindow, modal, backdrop, input);
  });
}

function openLeadApprovalModal(
  doc: Document,
  activeWindow: BootstrapWindow,
  modal: HTMLDivElement,
  backdrop: HTMLDivElement,
  input: HTMLInputElement,
): void {
  applyModalLayering(doc, modal, backdrop);
  modal.classList.add('show');
  modal.style.display = 'block';
  modal.setAttribute('aria-hidden', 'false');
  modal.setAttribute('aria-modal', 'true');
  backdrop.classList.add('show');
  backdrop.style.display = 'block';
  doc.body?.classList.add(modalOpenClassName);

  const focusInput = (): void => {
    input.focus();
    input.select();
  };

  activeWindow.setTimeout(focusInput, 0);
  activeWindow.setTimeout(focusInput, 150);
}

function closeLeadApprovalModal(doc: Document, modal: HTMLDivElement, backdrop: HTMLDivElement): void {
  modal.classList.remove('show');
  modal.style.display = 'none';
  modal.setAttribute('aria-hidden', 'true');
  backdrop.classList.remove('show');
  backdrop.style.display = 'none';
  doc.body?.classList.remove(modalOpenClassName);
}

function ensureLeadApprovalModalStyles(doc: Document): void {
  if (doc.getElementById(leadApprovalStyleId)) {
    return;
  }

  const style = doc.createElement('style');
  style.id = leadApprovalStyleId;
  style.textContent = `
    body.${modalOpenClassName} {
      overflow: hidden;
    }
    #${leadApprovalModalId} {
      inset: 0;
      overflow-x: hidden;
      overflow-y: auto;
      position: fixed;
    }
    #${leadApprovalModalId} .modal-dialog {
      margin: 72px auto;
      max-width: 520px;
      width: min(calc(100vw - 32px), 520px);
    }
    #${leadApprovalModalId} .modal-content {
      overflow: hidden;
    }
    #${leadApprovalModalId} .modal-body p {
      margin-bottom: 12px;
    }
    #${leadApprovalErrorId} {
      margin-top: 8px;
      min-height: 20px;
    }
    #${leadApprovalBackdropId} {
      background: rgba(0, 0, 0, 0.45);
      inset: 0;
      position: fixed;
    }
  `;
  doc.head.append(style);
}

function applyModalLayering(activeDocument: Document, modal: HTMLDivElement, backdrop: HTMLDivElement): void {
  const modalZIndex = getModalZIndex(activeDocument);

  backdrop.style.zIndex = String(modalZIndex - 10);
  modal.style.zIndex = String(modalZIndex);
}

function getModalZIndex(activeDocument: Document): number {
  const highestPageZIndex = getHighestPageChromeZIndex(activeDocument);

  return Math.max(highestPageZIndex + 20, 1050);
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

function parseActivityOptions(value: unknown): ActivityOption[] {
  if (!value) {
    return [];
  }

  let parsed = value;

  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .map((option) => {
      const identifier = getString((option as Record<string, unknown>).IDENTIFIER ?? (option as Record<string, unknown>).Identifier ?? (option as Record<string, unknown>).identifier);

      if (!identifier) {
        return null;
      }

      return {
        defaultActivity: getString(
          (option as Record<string, unknown>).DEFAULT_ACTIVITY ??
            (option as Record<string, unknown>).defaultActivity ??
            (option as Record<string, unknown>).default_activity,
        ) || 'N',
        identifier,
      };
    })
    .filter((option): option is ActivityOption => option !== null);
}

function getDefaultActivity(options: ActivityOption[]): string {
  const defaultOption = options.find((option) => option.defaultActivity.toUpperCase() === 'Y');
  return defaultOption?.identifier ?? options[0]?.identifier ?? '';
}

function deriveActivityTypeFromMachineName(machineName: string): string {
  const normalized = getString(machineName);
  const slotStaxMatch = normalized.match(/^SlotStax Station\s*(\d+)$/i);

  if (slotStaxMatch) {
    return `PalletizingStation${slotStaxMatch[1]}`;
  }

  if (/^Decant Station/i.test(normalized)) {
    return 'Decant';
  }

  if (/^Packing Station/i.test(normalized)) {
    return 'Packing';
  }

  return normalized;
}

function getMachineName(doc: Document): string {
  try {
    return doc.defaultView?.localStorage.getItem('MachineName')?.trim() ?? '';
  } catch {
    return '';
  }
}

function isLeadAccessCode(value: string, leadAccessCode: string): boolean {
  return getString(value) === leadAccessCode;
}

function parseNumber(value: unknown): number | null {
  const text = String(value ?? '').replace(/,/g, '').trim();

  if (!text) {
    return null;
  }

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function getString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function defer(activeWindow: Window, callback: () => void): void {
  if (typeof activeWindow.requestAnimationFrame === 'function') {
    activeWindow.requestAnimationFrame(() => callback());
    return;
  }

  activeWindow.setTimeout(callback, 0);
}