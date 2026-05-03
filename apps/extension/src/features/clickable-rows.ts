const rowSelector = 'ion-row.table-row';
const inputHostId = 'PalletColumnId';
const clickableClass = 'glide-clickable-row';
const selectedClass = 'glide-clickable-row-selected';
const styleId = 'glide-clickable-rows-style';

export function installClickableRows(doc: Document = document): () => void {
  ensureStyles(doc);
  syncRows(doc);

  const observer = new MutationObserver(createQueuedMutationSync(doc));
  observer.observe(doc.documentElement, { childList: true, subtree: true });

  const handleClick = (event: MouseEvent): void => {
    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const row = target.closest(rowSelector);
    const value = row ? extractRowValue(row) : null;

    if (!row || !value || !setInputValue(doc, value)) {
      return;
    }

    doc.querySelectorAll(`${rowSelector}.${selectedClass}`).forEach((candidate) => {
      if (candidate !== row) {
        candidate.classList.remove(selectedClass);
      }
    });
    row.classList.add(clickableClass, selectedClass);
  };

  doc.addEventListener('click', handleClick);

  return () => {
    observer.disconnect();
    doc.removeEventListener('click', handleClick);
    doc.querySelectorAll(rowSelector).forEach((row) => row.classList.remove(clickableClass, selectedClass));
  };
}

function ensureStyles(doc: Document): void {
  if (doc.getElementById(styleId)) {
    return;
  }

  const style = doc.createElement('style');
  style.id = styleId;
  style.textContent = `
    ion-row.table-row.${clickableClass} { cursor: pointer; }
    ion-row.table-row.${selectedClass} {
      outline: 2px solid #0f6cbd;
      outline-offset: -2px;
      box-shadow: inset 0 0 0 1px rgba(15, 108, 189, 0.25);
      border-radius: 6px;
    }
  `;
  doc.head.append(style);
}

function syncRows(doc: Document): void {
  syncRowsInScope(doc, doc);
}

function syncRowsInScope(doc: Document, scope: ParentNode): void {
  const hasInputHost = Boolean(getInputHost(doc));

  if (!hasInputHost) {
    const rows = scope instanceof Document ? scope.querySelectorAll(rowSelector) : collectRows(scope);

    rows.forEach((row) => row.classList.remove(clickableClass, selectedClass));
    return;
  }

  const rows = scope instanceof Document ? scope.querySelectorAll(rowSelector) : collectRows(scope);

  rows.forEach((row) => row.classList.add(clickableClass));
}

function createQueuedMutationSync(doc: Document): MutationCallback {
  let queued = false;
  let requiresFullSync = false;
  const pendingScopes = new Set<Element>();

  return (mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== 'childList') {
        continue;
      }

      if (nodesAffectInputHost(doc, mutation.addedNodes) || nodesAffectInputHost(doc, mutation.removedNodes)) {
        requiresFullSync = true;
      }

      if (!requiresFullSync) {
        collectRowScopes(doc, mutation.addedNodes, pendingScopes);
      }
    }

    if (queued) {
      return;
    }

    queued = true;
    queueTask(() => {
      queued = false;

      if (requiresFullSync) {
        syncRows(doc);
      } else {
        for (const scope of pendingScopes) {
          syncRowsInScope(doc, scope);
        }
      }

      requiresFullSync = false;
      pendingScopes.clear();
    });
  };
}

function nodesAffectInputHost(doc: Document, nodes: NodeList): boolean {
  for (const node of Array.from(nodes)) {
    if (!isElementNode(doc, node)) {
      continue;
    }

    if (node.id === inputHostId || node.querySelector(`#${inputHostId}`)) {
      return true;
    }
  }

  return false;
}

function collectRowScopes(doc: Document, nodes: NodeList, scopes: Set<Element>): void {
  for (const node of Array.from(nodes)) {
    if (!isElementNode(doc, node)) {
      continue;
    }

    if (node.matches(rowSelector)) {
      scopes.add(node);
    }

    node.querySelectorAll(rowSelector).forEach((row) => scopes.add(row));
  }
}

function collectRows(scope: ParentNode): HTMLElement[] {
  const rows: HTMLElement[] = [];

  if (scope instanceof HTMLElement && scope.matches(rowSelector)) {
    rows.push(scope);
  }

  scope.querySelectorAll<HTMLElement>(rowSelector).forEach((row) => rows.push(row));
  return rows;
}

function isElementNode(doc: Document, node: Node): node is Element {
  const ElementCtor = doc.defaultView?.Element;

  return typeof ElementCtor === 'function' && node instanceof ElementCtor;
}

function queueTask(callback: () => void): void {
  const activeWindow = globalThis.window;

  if (typeof activeWindow?.requestAnimationFrame === 'function') {
    activeWindow.requestAnimationFrame(callback);
    return;
  }

  activeWindow?.setTimeout(callback, 0);
}

function getInputHost(doc: Document): HTMLElement | null {
  return doc.getElementById(inputHostId);
}

function getNativeInput(host: HTMLElement | null): HTMLInputElement | null {
  if (!host) {
    return null;
  }

  return host.querySelector('input') ?? host.shadowRoot?.querySelector('input') ?? null;
}

function extractRowValue(row: Element): string | null {
  const firstColumn = row.querySelector('ion-col');
  const value = firstColumn?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  return value || null;
}

function setInputValue(doc: Document, value: string): boolean {
  const host = getInputHost(doc);
  const input = getNativeInput(host);

  if (!host || !input) {
    return false;
  }

  try {
    (host as HTMLElement & { value?: string }).value = value;
  } catch {
    // Custom element setters can reject; the native input remains the source of truth for the event.
  }

  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  return true;
}