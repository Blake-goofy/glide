const rowSelector = 'ion-row.table-row';
const inputHostId = 'PalletColumnId';
const clickableClass = 'glide-clickable-row';
const selectedClass = 'glide-clickable-row-selected';
const styleId = 'glide-clickable-rows-style';

export function installClickableRows(doc: Document = document): () => void {
  ensureStyles(doc);
  primeRows(doc);

  const observer = new MutationObserver(() => primeRows(doc));
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

function primeRows(doc: Document): void {
  if (!getInputHost(doc)) {
    return;
  }

  doc.querySelectorAll(rowSelector).forEach((row) => row.classList.add(clickableClass));
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