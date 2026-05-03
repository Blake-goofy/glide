import { showBridgeToast } from './bridge-client';

const copyMenuClassName = 'glide-grid-copy-menu';
const copyMenuHostId = 'glide-grid-copy-menu';
const copyMenuItemSelector = '[data-glide-grid-copy-action="copy"]';
const handledLinkSuppressWindowMs = 1000;
const longPressDistanceThresholdPx = 12;
const longPressDurationMs = 550;
const styleId = 'glide-grid-copy-style';
const supportedCellSelector = 'td, th';
const activeCellClassName = 'glide-grid-copy-cell--active';
const flashCellClassName = 'glide-grid-copy-cell--flash';

type PressState = {
  cell: HTMLElement;
  pointerId: number;
  startX: number;
  startY: number;
  text: string;
};

export function installGridCopy(doc: Document = document): () => void {
  ensureStyles(doc);

  let activeMenuCell: HTMLElement | null = null;
  let activeMenuText: string | null = null;
  let longPressState: PressState | null = null;
  let longPressTimer: number | null = null;
  let suppressedLinkCell: HTMLElement | null = null;
  let suppressedLinkUntil = 0;
  let longPressListenersAttached = false;

  const attachLongPressListeners = (): void => {
    if (longPressListenersAttached) {
      return;
    }

    longPressListenersAttached = true;
    doc.addEventListener('pointermove', handlePointerMove, true);
    doc.addEventListener('pointerup', handlePointerEnd, true);
    doc.addEventListener('pointercancel', handlePointerEnd, true);
  };

  const detachLongPressListeners = (): void => {
    if (!longPressListenersAttached) {
      return;
    }

    longPressListenersAttached = false;
    doc.removeEventListener('pointermove', handlePointerMove, true);
    doc.removeEventListener('pointerup', handlePointerEnd, true);
    doc.removeEventListener('pointercancel', handlePointerEnd, true);
  };

  const clearLongPressTimer = (): void => {
    if (longPressTimer !== null) {
      window.clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  };

  const clearLongPressState = (): void => {
    clearLongPressTimer();
    longPressState = null;
    detachLongPressListeners();
  };

  const clearActiveMenuCell = (): void => {
    activeMenuCell?.classList.remove(activeCellClassName);
    activeMenuCell = null;
    activeMenuText = null;
  };

  const closeMenu = (): void => {
    doc.getElementById(copyMenuHostId)?.remove();
    clearActiveMenuCell();
  };

  const handleDocumentClickCapture = (event: MouseEvent): void => {
    const target = event.target;

    if (isSuppressedLinkTarget(target, suppressedLinkCell, suppressedLinkUntil)) {
      event.preventDefault();
      event.stopPropagation();
      suppressedLinkCell = null;
      suppressedLinkUntil = 0;
      return;
    }

    const menu = doc.getElementById(copyMenuHostId);

    if (!menu) {
      return;
    }

    if (target instanceof Element && menu.contains(target)) {
      const actionTarget = target.closest(copyMenuItemSelector);

      if (!(actionTarget instanceof HTMLElement) || !activeMenuText || !activeMenuCell) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      void copyCellText(activeMenuCell, activeMenuText).finally(closeMenu);
      return;
    }

    closeMenu();
  };

  const handleDocumentKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      closeMenu();
    }
  };

  const handleContextMenu = (event: MouseEvent): void => {
    const target = event.target;

    if (!(target instanceof Element)) {
      closeMenu();
      return;
    }

    if (shouldSuppressHandledLink(target, suppressedLinkCell, suppressedLinkUntil)) {
      event.preventDefault();
      event.stopPropagation();
      closeMenu();
      return;
    }

    const candidate = getGridCellCandidate(target);

    if (!candidate) {
      closeMenu();
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    showCopyMenu(doc, candidate.cell, candidate.text, event.clientX, event.clientY);
  };

  const handleAuxClick = (event: MouseEvent): void => {
    if (event.button !== 1) {
      return;
    }

    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const candidate = getGridCellCandidate(target);

    if (!candidate) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    closeMenu();
    void copyCellText(candidate.cell, candidate.text);
  };

  const handlePointerDown = (event: PointerEvent): void => {
    if (event.pointerType !== 'touch' && event.pointerType !== 'pen') {
      return;
    }

    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const candidate = getGridCellCandidate(target);

    if (!candidate) {
      return;
    }

    closeMenu();
    clearLongPressState();
    longPressState = {
      cell: candidate.cell,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      text: candidate.text,
    };
    attachLongPressListeners();
    longPressTimer = window.setTimeout(() => {
      if (!longPressState) {
        return;
      }

      const currentState = longPressState;
      const linkCell = containsLink(currentState.cell) ? currentState.cell : null;

      if (linkCell) {
        suppressedLinkCell = linkCell;
        suppressedLinkUntil = Date.now() + handledLinkSuppressWindowMs;
      }

      clearLongPressState();
      void copyCellText(currentState.cell, currentState.text);
    }, longPressDurationMs);
  };

  const handlePointerMove = (event: PointerEvent): void => {
    if (!longPressState || event.pointerId !== longPressState.pointerId) {
      return;
    }

    const deltaX = Math.abs(event.clientX - longPressState.startX);
    const deltaY = Math.abs(event.clientY - longPressState.startY);

    if (deltaX > longPressDistanceThresholdPx || deltaY > longPressDistanceThresholdPx) {
      clearLongPressState();
    }
  };

  const handlePointerEnd = (event: PointerEvent): void => {
    if (longPressState && event.pointerId === longPressState.pointerId) {
      clearLongPressState();
    }
  };

  doc.addEventListener('click', handleDocumentClickCapture, true);
  doc.addEventListener('keydown', handleDocumentKeydown, true);
  doc.addEventListener('contextmenu', handleContextMenu, true);
  doc.addEventListener('auxclick', handleAuxClick, true);
  doc.addEventListener('pointerdown', handlePointerDown, true);

  return () => {
    clearLongPressState();
    closeMenu();
    doc.removeEventListener('click', handleDocumentClickCapture, true);
    doc.removeEventListener('keydown', handleDocumentKeydown, true);
    doc.removeEventListener('contextmenu', handleContextMenu, true);
    doc.removeEventListener('auxclick', handleAuxClick, true);
    doc.removeEventListener('pointerdown', handlePointerDown, true);
    detachLongPressListeners();
  };

  function showCopyMenu(activeDocument: Document, cell: HTMLElement, text: string, clientX: number, clientY: number): void {
    closeMenu();

    const menu = activeDocument.createElement('div');
    menu.id = copyMenuHostId;
    menu.className = copyMenuClassName;
    menu.setAttribute('role', 'menu');
    menu.innerHTML = `
      <button type="button" data-glide-grid-copy-action="copy" role="menuitem">
        Copy
      </button>
    `;

    menu.style.left = `${clientX}px`;
    menu.style.top = `${clientY}px`;
    activeDocument.body.append(menu);

    activeMenuCell = cell;
    activeMenuText = text;
    activeMenuCell.classList.add(activeCellClassName);

    requestAnimationFrame(() => {
      const rect = menu.getBoundingClientRect();

      if (rect.right > window.innerWidth) {
        menu.style.left = `${Math.max(8, clientX - rect.width)}px`;
      }

      if (rect.bottom > window.innerHeight) {
        menu.style.top = `${Math.max(8, clientY - rect.height)}px`;
      }
    });
  }
}

function ensureStyles(doc: Document): void {
  if (doc.getElementById(styleId)) {
    return;
  }

  const style = doc.createElement('style');
  style.id = styleId;
  style.textContent = `
    .${copyMenuClassName} {
      align-items: stretch;
      background: #ffffff;
      border: 1px solid #c7c7c7;
      border-radius: 6px;
      box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
      display: inline-flex;
      min-width: 132px;
      padding: 4px;
      position: fixed;
      z-index: 2147483647;
    }

    .${copyMenuClassName} > button {
      background: transparent;
      border: 0;
      border-radius: 4px;
      color: #1f1f1f;
      cursor: pointer;
      font: 600 13px/1.2 'Segoe UI', sans-serif;
      padding: 9px 12px;
      text-align: left;
      width: 100%;
    }

    .${copyMenuClassName} > button:hover,
    .${copyMenuClassName} > button:focus-visible {
      background: #f2f2f2;
      outline: none;
    }

    .${activeCellClassName} {
      outline: 2px solid #bf8133 !important;
      outline-offset: -2px !important;
    }

    .${flashCellClassName} {
      background-color: rgba(191, 129, 51, 0.15) !important;
      outline: 2px solid #bf8133 !important;
      outline-offset: -2px !important;
      transition: background-color 0.18s ease, outline-color 0.18s ease;
    }
  `;
  doc.head.append(style);
}

function getGridCellCandidate(target: Element): { cell: HTMLElement; text: string } | null {
  const cell = target.closest(supportedCellSelector);

  if (!(cell instanceof HTMLElement) || !isWithinSupportedGrid(cell)) {
    return null;
  }

  const text = getCellText(cell);

  if (text === null) {
    return null;
  }

  return { cell, text };
}

function isWithinSupportedGrid(cell: HTMLElement): boolean {
  const table = cell.closest('table');

  if (!(table instanceof HTMLTableElement)) {
    return false;
  }

  if (table.classList.contains('ui-iggrid-headertable') || table.classList.contains('ui-iggrid-table')) {
    return true;
  }

  if (Array.from(table.classList).some((className) => className.startsWith('ui-iggrid'))) {
    return true;
  }

  if (/DataGrid/i.test(table.id) || /_headers$/i.test(table.id)) {
    return true;
  }

  return table.closest('.ui-iggrid') instanceof HTMLElement;
}

function getCellText(cell: HTMLElement): string | null {
  const headerText = cell.querySelector<HTMLElement>('.ui-iggrid-headertext');
  const source = headerText ?? cell;
  const rawText = (source.innerText || source.textContent || '').replace(/\u00a0/g, ' ');
  const collapsedText = rawText.replace(/\s+/g, ' ').trim();

  if (collapsedText) {
    return collapsedText;
  }

  return /\s/.test(rawText) ? ' ' : null;
}

function containsLink(cell: HTMLElement): boolean {
  return cell.querySelector('a[href]') instanceof HTMLAnchorElement;
}

async function copyCellText(cell: HTMLElement, text: string): Promise<void> {
  try {
    await writeClipboardText(text);
    flashCell(cell);
    await showBridgeToast('Copied to clipboard.', 'success');
  } catch (error) {
    await showBridgeToast(error instanceof Error ? error.message : 'Unable to copy the selected value.', 'error');
  }
}

async function writeClipboardText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.left = '-9999px';
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  document.body.append(textarea);
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  const copied = document.execCommand('copy');

  textarea.remove();

  if (!copied) {
    throw new Error('Unable to copy the selected value.');
  }
}

function flashCell(cell: HTMLElement): void {
  cell.classList.add(flashCellClassName);
  window.setTimeout(() => {
    cell.classList.remove(flashCellClassName);
  }, 700);
}

function isSuppressedLinkTarget(target: EventTarget | null, suppressedCell: HTMLElement | null, suppressedUntil: number): boolean {
  if (Date.now() > suppressedUntil || !(target instanceof Element) || !suppressedCell) {
    return false;
  }

  return suppressedCell.contains(target);
}

function shouldSuppressHandledLink(target: EventTarget | null, suppressedCell: HTMLElement | null, suppressedUntil: number): boolean {
  return isSuppressedLinkTarget(target, suppressedCell, suppressedUntil);
}