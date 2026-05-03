const inputHostId = 'UnitsInTote';
const rootClass = 'glide-units-in-tote-numpad';
const keyClass = `${rootClass}__key`;
const styleId = `${rootClass}-style`;
const digitKeys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '0'] as const;

export function installUnitsInToteNumpad(doc: Document = document): () => void {
  ensureStyles(doc);

  const syncKeypad = (): void => {
    const host = getInputHost(doc);
    const existing = doc.querySelector(`.${rootClass}`);

    if (!host) {
      existing?.remove();
      return;
    }

    const anchor = findAnchor(host);

    if (!anchor?.parentElement) {
      return;
    }

    if (existing && existing.previousElementSibling !== anchor) {
      existing.remove();
    }

    if (!doc.querySelector(`.${rootClass}`)) {
      anchor.insertAdjacentElement('afterend', createKeypad(doc));
      focusAndSelectInput(host);
    }
  };

  const queueSync = createQueuedSync(syncKeypad);
  const observer = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => mutationAffectsKeypad(doc, mutation))) {
      queueSync();
    }
  });
  observer.observe(doc.body ?? doc.documentElement, { childList: true, subtree: true });
  syncKeypad();

  return () => {
    observer.disconnect();
    doc.querySelectorAll(`.${rootClass}`).forEach((keypad) => keypad.remove());
  };
}

function ensureStyles(doc: Document): void {
  if (doc.getElementById(styleId)) {
    return;
  }

  const style = doc.createElement('style');
  style.id = styleId;
  style.textContent = `
    .${rootClass} {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.5rem;
      width: 100%;
      max-width: 320px;
      margin: 0.75rem auto 0;
      padding: 0.5rem;
      border-radius: 0.75rem;
      background: rgba(255, 255, 255, 0.08);
      box-sizing: border-box;
    }
    .${keyClass} {
      appearance: none;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 0.65rem;
      min-height: 3.25rem;
      padding: 0.6rem;
      background: rgba(18, 12, 34, 0.72);
      color: rgba(255, 255, 255, 0.96);
      font: inherit;
      font-size: 1.1rem;
      font-weight: 600;
      line-height: 1;
      text-shadow: 0 1px 0 rgba(0, 0, 0, 0.3);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 1px 2px rgba(0, 0, 0, 0.22);
      cursor: pointer;
      touch-action: manipulation;
    }
    .${keyClass}:hover {
      background: rgba(28, 20, 50, 0.82);
    }
    .${keyClass}:active { transform: translateY(1px); }
    .${keyClass}--wide { grid-column: span 2; }
  `;
  doc.head.append(style);
}

function createKeypad(doc: Document): HTMLElement {
  const keypad = doc.createElement('div');
  keypad.className = rootClass;
  keypad.setAttribute('role', 'group');
  keypad.setAttribute('aria-label', 'Units in Tote keypad');

  for (const digit of digitKeys) {
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = keyClass + (digit === '0' ? ` ${keyClass}--wide` : '');
    button.dataset.value = digit;
    button.textContent = digit;
    keypad.append(button);
  }

  const deleteButton = doc.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = keyClass;
  deleteButton.dataset.action = 'backspace';
  deleteButton.textContent = '\u232B';
  keypad.append(deleteButton);

  keypad.addEventListener('pointerdown', (event) => {
    if (event.target instanceof Element && event.target.closest('button')) {
      event.preventDefault();
    }
  });
  keypad.addEventListener('click', (event) => {
    const button = event.target instanceof Element ? event.target.closest('button') : null;
    const host = getInputHost(doc);

    if (!(button instanceof HTMLButtonElement) || !host) {
      return;
    }

    if (button.dataset.action === 'backspace') {
      removeDigit(host);
      return;
    }

    if (button.dataset.value) {
      insertDigit(host, button.dataset.value);
    }
  });

  return keypad;
}

function getInputHost(doc: Document): HTMLElement | null {
  return doc.getElementById(inputHostId);
}

function getKeypad(doc: Document): HTMLElement | null {
  return doc.querySelector<HTMLElement>(`.${rootClass}`);
}

function getNativeInput(host: HTMLElement | null): HTMLInputElement | null {
  if (!host) {
    return null;
  }

  if (host instanceof HTMLInputElement) {
    return host;
  }

  return host.querySelector('input') ?? host.shadowRoot?.querySelector('input') ?? null;
}

function findAnchor(host: HTMLElement): Element | null {
  return host.closest('scale-input')?.closest('ion-item') ?? host.closest('ion-item') ?? host.closest('scale-input') ?? host;
}

function focusAndSelectInput(host: HTMLElement): void {
  const input = getNativeInput(host);

  if (!input) {
    return;
  }

  input.focus({ preventScroll: true });
  input.select();
}

function insertDigit(host: HTMLElement, digit: string): void {
  mutateInputValue(host, (value, selectionStart, selectionEnd) => {
    const nextValue = value.slice(0, selectionStart) + digit + value.slice(selectionEnd);
    const nextPosition = selectionStart + digit.length;

    return { nextValue, nextPosition };
  });
}

function removeDigit(host: HTMLElement): void {
  mutateInputValue(host, (value, selectionStart, selectionEnd) => {
    if (selectionStart !== selectionEnd) {
      return { nextValue: value.slice(0, selectionStart) + value.slice(selectionEnd), nextPosition: selectionStart };
    }

    if (selectionStart <= 0) {
      return null;
    }

    return { nextValue: value.slice(0, selectionStart - 1) + value.slice(selectionEnd), nextPosition: selectionStart - 1 };
  });
}

function mutateInputValue(
  host: HTMLElement,
  mutate: (value: string, selectionStart: number, selectionEnd: number) => { nextValue: string; nextPosition: number } | null,
): void {
  const input = getNativeInput(host);

  if (!input) {
    return;
  }

  const value = input.value;
  const selectionStart = input.selectionStart ?? value.length;
  const selectionEnd = input.selectionEnd ?? value.length;
  const next = mutate(value, selectionStart, selectionEnd);

  if (!next) {
    return;
  }

  try {
    (host as HTMLElement & { value?: string }).value = next.nextValue;
  } catch {
    // Custom element setters can reject; continue with the native input.
  }

  input.value = next.nextValue;
  input.focus({ preventScroll: true });
  input.setSelectionRange(next.nextPosition, next.nextPosition);
  input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
}

function mutationAffectsKeypad(doc: Document, mutation: MutationRecord): boolean {
  if (mutation.type !== 'childList') {
    return false;
  }

  if (nodesAffectKeypad(doc, mutation.addedNodes) || nodesAffectKeypad(doc, mutation.removedNodes)) {
    return true;
  }

  const target = mutation.target;

  if (!isElementNode(doc, target)) {
    return false;
  }

  const host = getInputHost(doc);
  const keypad = getKeypad(doc);
  const anchorParent = host ? findAnchor(host)?.parentElement : null;

  return target === anchorParent || target === keypad?.parentElement;
}

function nodesAffectKeypad(doc: Document, nodes: NodeList): boolean {
  for (const node of Array.from(nodes)) {
    if (!isElementNode(doc, node)) {
      continue;
    }

    if (node.id === inputHostId || node.classList.contains(rootClass)) {
      return true;
    }

    if (node.querySelector(`#${inputHostId}, .${rootClass}`)) {
      return true;
    }
  }

  return false;
}

function isElementNode(doc: Document, node: Node): node is Element {
  const ElementCtor = doc.defaultView?.Element;

  return typeof ElementCtor === 'function' && node instanceof ElementCtor;
}

function createQueuedSync(callback: () => void): () => void {
  let queued = false;

  return () => {
    const activeWindow = globalThis.window;

    if (queued || !activeWindow) {
      return;
    }

    queued = true;
    activeWindow.requestAnimationFrame(() => {
      queued = false;
      callback();
    });
  };
}