const rootClass = 'glide-adfs-keyboard';
const panelClass = `${rootClass}__panel`;
const rowClass = `${rootClass}__row`;
const keyClass = `${rootClass}__key`;
const styleId = `${rootClass}-style`;
const formId = 'loginForm';
const submitId = 'submitButton';
const credentialSelector = '#userNameInput, #passwordInput';
const pressedBackgroundColor = '#1f1f1f';
const pressedBoxShadow = 'inset 0 2px 4px rgba(0, 0, 0, 0.34), 0 0 0 rgba(0, 0, 0, 0.12)';
const pressedTransform = 'translateY(3px)';
const letterRows = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
] as const;
const symbolRows = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')'],
  ['-', '_', '=', '+', '[', ']', '{', '}', '\\', '/'],
  [':', ';', "'", '"', '?', '<', '>', ',', '.'],
] as const;

type KeyAction = 'shift' | 'capslock' | 'toggle-mode' | 'backspace' | 'tab' | 'space' | 'enter';

interface KeyboardKey {
  action?: KeyAction;
  className: string;
  label: string;
  value?: string;
}

interface KeyboardRow {
  className: string;
  keys: KeyboardKey[];
}

export function installAdfsOverlayKeyboard(doc: Document = document): () => void {
  const activeWindow = doc.defaultView ?? window;
  let activeInput: HTMLInputElement | null = null;
  let shiftActive = false;
  let capsLockActive = false;
  let symbolMode = false;
  let lastPointerActivatedButton: HTMLButtonElement | null = null;

  const syncKeyboard = (): void => {
    const existing = doc.querySelector(`.${rootClass}`);

    if (!isAdfsPage(doc)) {
      existing?.remove();
      activeInput = null;
      shiftActive = false;
      capsLockActive = false;
      symbolMode = false;
      return;
    }

    ensureStyles(doc);
    activeInput = focusInput(getPrimaryInput(doc, activeInput));

    if (!existing) {
      doc.body.append(
        createKeyboard(
          doc,
          activeWindow,
          () => shiftActive,
          () => capsLockActive,
          () => symbolMode,
          (value) => {
            shiftActive = value;
          },
          (value) => {
            capsLockActive = value;
          },
          (value) => {
            symbolMode = value;
          },
          () => activeInput,
          (input) => {
            activeInput = input;
          },
          () => lastPointerActivatedButton,
          (button) => {
            lastPointerActivatedButton = button;
          },
        ),
      );
      return;
    }
  };

  const queueSync = createQueuedSync(activeWindow, syncKeyboard);
  const handleFocusIn = (event: FocusEvent): void => {
    if (isCredentialInput(event.target)) {
      activeInput = event.target;
      queueSync();
    }
  };
  const handleMouseDown = (event: MouseEvent): void => {
    if (isCredentialInput(event.target)) {
      activeInput = event.target;
    }
  };

  doc.addEventListener('focusin', handleFocusIn, true);
  doc.addEventListener('mousedown', handleMouseDown, true);

  const observer = new activeWindow.MutationObserver(queueSync);
  observer.observe(doc.documentElement, { childList: true, subtree: true });
  syncKeyboard();

  return () => {
    observer.disconnect();
    doc.removeEventListener('focusin', handleFocusIn, true);
    doc.removeEventListener('mousedown', handleMouseDown, true);
    doc.querySelectorAll(`.${rootClass}`).forEach((keyboard) => keyboard.remove());
  };
}

function createKeyboard(
  doc: Document,
  activeWindow: Window,
  getShiftActive: () => boolean,
  getCapsLockActive: () => boolean,
  getSymbolMode: () => boolean,
  setShiftActive: (value: boolean) => void,
  setCapsLockActive: (value: boolean) => void,
  setSymbolMode: (value: boolean) => void,
  getActiveInput: () => HTMLInputElement | null,
  setActiveInput: (input: HTMLInputElement | null) => void,
  getLastPointerActivatedButton: () => HTMLButtonElement | null,
  setLastPointerActivatedButton: (button: HTMLButtonElement | null) => void,
): HTMLElement {
  const keyboard = doc.createElement('div');
  keyboard.className = rootClass;
  keyboard.setAttribute('role', 'complementary');
  keyboard.setAttribute('aria-label', 'ADFS on-screen keyboard');
  keyboard.append(doc.createElement('div'));
  keyboard.firstElementChild?.classList.add(panelClass);

  const clearPressingState = (button: HTMLButtonElement | null): void => {
    if (!button) {
      return;
    }

    button.classList.remove(`${keyClass}--pressing`);
    button.style.removeProperty('background-color');
    button.style.removeProperty('box-shadow');
    button.style.removeProperty('transform');
  };

  const activateButton = (button: HTMLButtonElement): void => {
    const action = button.dataset.action as KeyAction | undefined;
    const shouldResetShift = handleKey(
      doc,
      action,
      button.dataset.value,
      getActiveInput(),
      setActiveInput,
      getShiftActive,
      getSymbolMode,
      setShiftActive,
      getCapsLockActive,
      setCapsLockActive,
      setSymbolMode,
    );

    if (shouldResetShift) {
      setShiftActive(false);
    }

    if (action || shouldResetShift) {
      renderKeyboard(doc, keyboard, getShiftActive(), getCapsLockActive(), getSymbolMode());
    }
  };

  keyboard.addEventListener('pointerdown', (event) => {
    if (!(event.target instanceof Element)) {
      return;
    }

    const button = event.target.closest('button');

    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    applyPressingState(button);
    event.preventDefault();
  });

  keyboard.addEventListener('mousedown', (event) => {
    if (!(event.target instanceof Element)) {
      return;
    }

    const button = event.target.closest('button');

    if (button instanceof HTMLButtonElement) {
      applyPressingState(button);
    }
  });

  keyboard.addEventListener('pointerup', (event) => {
    const button = event.target instanceof Element ? event.target.closest('button') : null;

    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    clearPressingState(button);
    setLastPointerActivatedButton(button);
    activeWindow.setTimeout(() => {
      if (getLastPointerActivatedButton() === button) {
        setLastPointerActivatedButton(null);
      }
    }, 0);
    activateButton(button);
  });

  keyboard.addEventListener('pointercancel', (event) => {
    const button = event.target instanceof Element ? event.target.closest('button') : null;

    if (button instanceof HTMLButtonElement) {
      clearPressingState(button);
    }
  });

  keyboard.addEventListener('mouseup', (event) => {
    const button = event.target instanceof Element ? event.target.closest('button') : null;

    if (button instanceof HTMLButtonElement) {
      clearPressingState(button);
    }
  });

  keyboard.addEventListener('click', (event) => {
    const button = event.target instanceof Element ? event.target.closest('button') : null;

    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    if (getLastPointerActivatedButton() === button) {
      setLastPointerActivatedButton(null);
      return;
    }

    clearPressingState(button);
    activateButton(button);
  });

  renderKeyboard(doc, keyboard, getShiftActive(), getCapsLockActive(), getSymbolMode());
  return keyboard;
}

function applyPressingState(button: HTMLButtonElement): void {
  button.classList.add(`${keyClass}--pressing`);
  button.style.setProperty('background-color', pressedBackgroundColor, 'important');
  button.style.setProperty('box-shadow', pressedBoxShadow, 'important');
  button.style.setProperty('transform', pressedTransform, 'important');
}

function renderKeyboard(
  doc: Document,
  keyboard: HTMLElement,
  shiftActive: boolean,
  capsLockActive: boolean,
  symbolMode: boolean,
): void {
  const panel = keyboard.querySelector(`.${panelClass}`);

  if (!(panel instanceof HTMLElement)) {
    return;
  }

  panel.innerHTML = '';

  for (const rowValue of getRows(shiftActive, capsLockActive, symbolMode)) {
    const row = doc.createElement('div');
    row.className = `${rowClass}${rowValue.className ? ` ${rowValue.className}` : ''}`;

    for (const key of rowValue.keys) {
      const button = doc.createElement('button');
      button.type = 'button';
      button.className = `${keyClass}${key.className ? ` ${key.className}` : ''}`;
      button.textContent = key.label;

      if (key.action) {
        button.dataset.action = key.action;

        if (key.action === 'shift' || key.action === 'capslock') {
          const isPressed = key.action === 'shift' ? shiftActive : capsLockActive;
          button.setAttribute('aria-pressed', isPressed ? 'true' : 'false');
        }
      }

      if (key.value) {
        button.dataset.value = key.value;
      }

      row.append(button);
    }

    panel.append(row);
  }
}

function getRows(shiftActive: boolean, capsLockActive: boolean, symbolMode: boolean): KeyboardRow[] {
  if (symbolMode) {
    return [
      { className: '', keys: symbolRows[0].map((value) => createValueKey(value)) },
      { className: '', keys: symbolRows[1].map((value) => createValueKey(value)) },
      { className: '', keys: symbolRows[2].map((value) => createValueKey(value)) },
      {
        className: '',
        keys: symbolRows[3]
          .map((value) => createValueKey(value))
          .concat([createActionKey('Backspace', 'backspace', `${keyClass}--control ${keyClass}--wide-label`)]),
      },
      {
        className: '',
        keys: [
          createActionKey('ABC', 'toggle-mode'),
          createActionKey('Caps', 'capslock', `${keyClass}--control ${keyClass}--wide-label${capsLockActive ? ` ${keyClass}--active` : ''}`),
          createActionKey('Space', 'space', `${keyClass}--space`),
          createActionKey('Tab', 'tab', `${keyClass}--control ${keyClass}--wide-label`),
          createActionKey('Enter', 'enter', `${keyClass}--enter`),
        ],
      },
    ];
  }

  return [
    { className: '', keys: letterRows[0].map((value) => createValueKey(value)) },
    {
      className: `${rowClass}--letters-middle`,
      keys: letterRows[1].map((value) => createValueKey(resolveLetterValue(value, shiftActive, capsLockActive))),
    },
    {
      className: `${rowClass}--letters-middle`,
      keys: letterRows[2].map((value) => createValueKey(resolveLetterValue(value, shiftActive, capsLockActive))),
    },
    {
      className: `${rowClass}--letters-bottom`,
      keys: [createActionKey('Shift', 'shift', `${keyClass}--control${shiftActive ? ` ${keyClass}--active` : ''}`)]
        .concat(letterRows[3].map((value) => createValueKey(resolveLetterValue(value, shiftActive, capsLockActive))))
        .concat([createActionKey('Backspace', 'backspace', `${keyClass}--control ${keyClass}--wide-label`)]),
    },
    {
      className: '',
      keys: [
        createActionKey('&123', 'toggle-mode'),
        createActionKey('Caps', 'capslock', `${keyClass}--control ${keyClass}--wide-label${capsLockActive ? ` ${keyClass}--active` : ''}`),
        createActionKey('Space', 'space', `${keyClass}--space`),
        createActionKey('Tab', 'tab', `${keyClass}--control ${keyClass}--wide-label`),
        createActionKey('Enter', 'enter', `${keyClass}--enter`),
      ],
    },
  ];
}

function createValueKey(value: string): KeyboardKey {
  return {
    className: '',
    label: value,
    value,
  };
}

function createActionKey(label: string, action: KeyAction, className = `${keyClass}--control`): KeyboardKey {
  return {
    action,
    className,
    label,
  };
}

function handleKey(
  doc: Document,
  action: KeyAction | undefined,
  value: string | undefined,
  activeInput: HTMLInputElement | null,
  setActiveInput: (input: HTMLInputElement | null) => void,
  getShiftActive: () => boolean,
  getSymbolMode: () => boolean,
  setShiftActive: (value: boolean) => void,
  getCapsLockActive: () => boolean,
  setCapsLockActive: (value: boolean) => void,
  setSymbolMode: (value: boolean) => void,
): boolean {
  const input = focusInput(getPrimaryInput(doc, activeInput));
  setActiveInput(input);

  if (action === 'shift') {
    setShiftActive(!getShiftActive());
    return false;
  }

  if (action === 'capslock') {
    setCapsLockActive(!getCapsLockActive());
    return false;
  }

  if (action === 'toggle-mode') {
    setSymbolMode(!getSymbolMode());
    setShiftActive(false);
    return false;
  }

  if (action === 'tab') {
    focusNextCredentialInput(doc, input, setActiveInput);
    return false;
  }

  if (action === 'enter') {
    submitForm(doc);
    return false;
  }

  if (!input) {
    return false;
  }

  if (action === 'backspace') {
    mutateInput(input, (inputValue, selectionStart, selectionEnd) => {
      if (selectionStart !== selectionEnd) {
        return { nextValue: inputValue.slice(0, selectionStart) + inputValue.slice(selectionEnd), nextPosition: selectionStart };
      }

      if (selectionStart === 0) {
        return null;
      }

      return { nextValue: inputValue.slice(0, selectionStart - 1) + inputValue.slice(selectionEnd), nextPosition: selectionStart - 1 };
    });
    return false;
  }

  mutateInput(input, (inputValue, selectionStart, selectionEnd) => {
    const text = action === 'space' ? ' ' : value ?? '';
    return { nextValue: inputValue.slice(0, selectionStart) + text + inputValue.slice(selectionEnd), nextPosition: selectionStart + text.length };
  });

  return Boolean(value && !getSymbolMode() && getShiftActive() && /^[a-z]$/i.test(value));
}

function mutateInput(
  input: HTMLInputElement,
  mutate: (value: string, selectionStart: number, selectionEnd: number) => { nextValue: string; nextPosition: number } | null,
): void {
  const value = input.value;
  const selectionStart = input.selectionStart ?? value.length;
  const selectionEnd = input.selectionEnd ?? value.length;
  const next = mutate(value, selectionStart, selectionEnd);

  if (!next) {
    return;
  }

  setInputValue(input, next.nextValue);

  try {
    input.setSelectionRange(next.nextPosition, next.nextPosition);
  } catch {
    // Ignore selection failures for input variants that do not expose selection ranges.
  }

  input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
}

function setInputValue(input: HTMLInputElement, value: string): void {
  const activeWindow = input.ownerDocument.defaultView;
  const prototype = activeWindow?.HTMLInputElement?.prototype ?? HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');

  if (typeof descriptor?.set === 'function') {
    descriptor.set.call(input, value);
    return;
  }

  input.value = value;
}

function isAdfsPage(doc: Document): boolean {
  return doc.getElementById(formId) instanceof HTMLFormElement && getCredentialInputs(doc).length > 0;
}

function isCredentialInput(element: EventTarget | null): element is HTMLInputElement {
  return element instanceof HTMLInputElement && !element.disabled && !element.readOnly && element.matches(credentialSelector);
}

function getCredentialInputs(doc: Document): HTMLInputElement[] {
  return Array.from(doc.querySelectorAll(credentialSelector)).filter(isCredentialInput);
}

function getPrimaryInput(doc: Document, activeInput: HTMLInputElement | null): HTMLInputElement | null {
  if (isCredentialInput(doc.activeElement)) {
    return doc.activeElement;
  }

  if (isCredentialInput(activeInput)) {
    return activeInput;
  }

  return getCredentialInputs(doc)[0] ?? null;
}

function focusInput(input: HTMLInputElement | null): HTMLInputElement | null {
  if (!isCredentialInput(input)) {
    return null;
  }

  input.focus({ preventScroll: true });
  return input;
}

function focusNextCredentialInput(doc: Document, input: HTMLInputElement | null, setActiveInput: (input: HTMLInputElement | null) => void): void {
  const inputs = getCredentialInputs(doc);
  const currentIndex = input ? inputs.indexOf(input) : -1;
  const nextInput = inputs[Math.min(Math.max(currentIndex + 1, 0), inputs.length - 1)] ?? null;

  setActiveInput(focusInput(nextInput));
}

function submitForm(doc: Document): void {
  const submitButton = doc.getElementById(submitId);

  if (submitButton instanceof HTMLElement) {
    submitButton.click();
    return;
  }

  const form = doc.getElementById(formId);

  if (form instanceof HTMLFormElement) {
    if (typeof form.requestSubmit === 'function') {
      form.requestSubmit();
      return;
    }

    form.submit();
  }
}

function resolveLetterValue(value: string, shiftActive: boolean, capsLockActive: boolean): string {
  return shiftActive !== capsLockActive ? value.toUpperCase() : value.toLowerCase();
}

function ensureStyles(doc: Document): void {
  if (doc.getElementById(styleId)) {
    return;
  }

  const style = doc.createElement('style');
  style.id = styleId;
  style.textContent = `
    .${rootClass} {
      position: fixed;
      left: 50%;
      bottom: 14px;
      transform: translateX(-50%);
      width: min(calc(100vw - 24px), 720px);
      z-index: 2147483640;
      pointer-events: none;
    }
    .${panelClass} {
      pointer-events: auto;
      padding: 12px;
      border-radius: 14px;
      background: rgba(18, 18, 18, 0.96);
      box-shadow: 0 18px 40px rgba(0, 0, 0, 0.36);
      backdrop-filter: blur(6px);
      box-sizing: border-box;
    }
    .${rowClass} {
      display: flex;
      gap: 8px;
      margin-top: 8px;
    }
    .${rowClass}:first-child {
      margin-top: 0;
    }
    .${rowClass}--letters-middle {
      padding-inline: 18px;
    }
    .${rowClass}--letters-bottom {
      padding-inline: 34px;
    }
    .${keyClass} {
      appearance: none;
      flex: 1 1 0;
      min-width: 0;
      min-height: 48px;
      padding-inline: 10px;
      border: 1px solid #565656;
      border-radius: 8px;
      background: #2f2f2f;
      color: #fff;
      font: 600 16px/1.1 "Segoe UI", system-ui, sans-serif;
      cursor: pointer;
      touch-action: manipulation;
      white-space: nowrap;
      transform: translateY(0);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 2px 0 rgba(0, 0, 0, 0.38);
      transition: transform 70ms ease, box-shadow 70ms ease, background-color 70ms ease;
      box-sizing: border-box;
    }
    .${keyClass}:hover {
      background: #393939;
    }
    .${keyClass}:active,
    .${keyClass}--pressing {
      background: #1f1f1f;
      box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.34), 0 0 0 rgba(0, 0, 0, 0.12);
      transform: translateY(3px);
    }
    .${keyClass}:focus-visible {
      outline: 2px solid #ffffff;
      outline-offset: 1px;
    }
    .${keyClass}--control {
      flex: 1.35 1 0;
      background: #242424;
    }
    .${keyClass}--space {
      flex: 4 1 0;
    }
    .${keyClass}--enter {
      flex: 1.6 1 0;
    }
    .${keyClass}--wide-label {
      flex: 1.7 1 0;
      padding-inline: 22px;
      font-size: 15px;
    }
    .${keyClass}--active {
      background: #575757;
    }
    @media (max-width: 640px) {
      .${panelClass} {
        padding: 10px;
      }
      .${rowClass} {
        gap: 6px;
        margin-top: 6px;
      }
      .${rowClass}--letters-middle {
        padding-inline: 10px;
      }
      .${rowClass}--letters-bottom {
        padding-inline: 18px;
      }
      .${keyClass} {
        min-height: 44px;
        font-size: 14px;
      }
    }
  `;
  doc.head.append(style);
}

function createQueuedSync(activeWindow: Window, callback: () => void): () => void {
  let queued = false;

  return () => {
    if (queued) {
      return;
    }

    queued = true;
    activeWindow.requestAnimationFrame(() => {
      queued = false;
      callback();
    });
  };
}
