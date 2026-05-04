const rootClass = 'glide-adfs-keyboard';
const panelClass = `${rootClass}__panel`;
const rowClass = `${rootClass}__row`;
const keyClass = `${rootClass}__key`;
const statusClass = `${rootClass}__status`;
const styleId = `${rootClass}-style`;
const formId = 'loginForm';
const submitId = 'submitButton';
const credentialSelector = '#userNameInput, #passwordInput';
const pressedBackgroundColor = '#1f1f1f';
const pressedBoxShadow = 'inset 0 2px 4px rgba(0, 0, 0, 0.34), 0 0 0 rgba(0, 0, 0, 0.12)';
const pressedTransform = 'translateY(3px)';
const statusDismissDelayMs = 2500;
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

type KeyAction = 'shift' | 'capslock' | 'toggle-mode' | 'backspace' | 'tab' | 'space' | 'enter' | 'select-all' | 'copy' | 'paste';
type KeyboardStatusKind = 'error' | 'success';

type InputSelectionDirection = Exclude<HTMLInputElement['selectionDirection'], undefined>;

interface InputSelectionSnapshot {
  direction: InputSelectionDirection;
  end: number;
  input: HTMLInputElement;
  start: number;
  value: string;
}

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

interface LegacyCopyDocument {
  execCommand?: (commandId: string, showUI?: boolean, value?: string) => boolean;
}

export function installAdfsOverlayKeyboard(doc: Document = document): () => void {
  const activeWindow = doc.defaultView ?? window;
  let activeInput: HTMLInputElement | null = null;
  let activeSelection: InputSelectionSnapshot | null = null;
  let shiftActive = false;
  let capsLockActive = false;
  let symbolMode = false;
  let lastPointerActivatedButton: HTMLButtonElement | null = null;

  const captureActiveSelection = (input: HTMLInputElement | null): void => {
    activeSelection = captureInputSelection(input);
  };

  const getTrackedCredentialInput = (): HTMLInputElement | null => {
    if (isCredentialInput(activeInput)) {
      return activeInput;
    }

    if (isCredentialInput(doc.activeElement)) {
      return doc.activeElement;
    }

    return null;
  };

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
    captureActiveSelection(activeInput);

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
            captureActiveSelection(input);
          },
          () => activeSelection,
          captureActiveSelection,
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
      captureActiveSelection(activeInput);
      queueSync();
    }
  };
  const handleMouseDown = (event: MouseEvent): void => {
    if (isCredentialInput(event.target)) {
      activeInput = event.target;
      captureActiveSelection(activeInput);
    }
  };
  const handlePointerSelectionCommit = (): void => {
    const trackedInput = getTrackedCredentialInput();

    if (!trackedInput) {
      return;
    }

    activeInput = trackedInput;
    captureActiveSelection(activeInput);
  };
  const handleInputSelectionChange = (event: Event): void => {
    if (!isCredentialInput(event.target)) {
      return;
    }

    activeInput = event.target;
    captureActiveSelection(activeInput);
  };
  const handleDocumentSelectionChange = (): void => {
    const trackedInput = getTrackedCredentialInput();

    if (!trackedInput) {
      return;
    }

    activeInput = trackedInput;
    captureActiveSelection(activeInput);
  };

  doc.addEventListener('focusin', handleFocusIn, true);
  doc.addEventListener('mousedown', handleMouseDown, true);
  doc.addEventListener('mouseup', handlePointerSelectionCommit, true);
  doc.addEventListener('keyup', handlePointerSelectionCommit, true);
  doc.addEventListener('input', handleInputSelectionChange, true);
  doc.addEventListener('select', handleInputSelectionChange, true);
  doc.addEventListener('selectionchange', handleDocumentSelectionChange);

  const observer = new activeWindow.MutationObserver((mutations) => {
    if (mutations.some((mutation) => mutationAffectsKeyboard(doc, mutation))) {
      queueSync();
    }
  });
  observer.observe(doc.body ?? doc.documentElement, { childList: true, subtree: true });
  syncKeyboard();

  return () => {
    observer.disconnect();
    doc.removeEventListener('focusin', handleFocusIn, true);
    doc.removeEventListener('mousedown', handleMouseDown, true);
    doc.removeEventListener('mouseup', handlePointerSelectionCommit, true);
    doc.removeEventListener('keyup', handlePointerSelectionCommit, true);
    doc.removeEventListener('input', handleInputSelectionChange, true);
    doc.removeEventListener('select', handleInputSelectionChange, true);
    doc.removeEventListener('selectionchange', handleDocumentSelectionChange);
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
  getSavedSelection: () => InputSelectionSnapshot | null,
  saveSelection: (input: HTMLInputElement | null) => void,
  getLastPointerActivatedButton: () => HTMLButtonElement | null,
  setLastPointerActivatedButton: (button: HTMLButtonElement | null) => void,
): HTMLElement {
  const keyboard = doc.createElement('div');
  const panel = doc.createElement('div');
  const status = doc.createElement('div');
  keyboard.className = rootClass;
  keyboard.setAttribute('role', 'complementary');
  keyboard.setAttribute('aria-label', 'ADFS on-screen keyboard');
  panel.classList.add(panelClass);
  status.className = statusClass;
  status.setAttribute('aria-atomic', 'true');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('role', 'status');
  keyboard.append(panel, status);

  let statusTimeoutId: number | null = null;

  const clearStatus = (): void => {
    if (statusTimeoutId !== null) {
      activeWindow.clearTimeout(statusTimeoutId);
      statusTimeoutId = null;
    }

    status.className = statusClass;
    status.removeAttribute('data-kind');
    status.textContent = '';
  };

  const showStatus = (message: string, kind: KeyboardStatusKind): void => {
    if (statusTimeoutId !== null) {
      activeWindow.clearTimeout(statusTimeoutId);
    }

    status.className = `${statusClass} ${statusClass}--visible ${statusClass}--${kind}`;
    status.dataset.kind = kind;
    status.textContent = message;
    statusTimeoutId = activeWindow.setTimeout(() => {
      clearStatus();
    }, statusDismissDelayMs);
  };

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
    clearStatus();
    const shouldResetShift = handleKey(
      doc,
      action,
      button.dataset.value,
      getActiveInput(),
      setActiveInput,
      getShiftActive,
      getSymbolMode,
      getSavedSelection,
      saveSelection,
      setShiftActive,
      getCapsLockActive,
      setCapsLockActive,
      setSymbolMode,
      showStatus,
    );

    if (shouldResetShift) {
      setShiftActive(false);
    }

    if (shouldRenderAfterAction(action) || shouldResetShift) {
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

    saveSelection(getActiveInput());
    applyPressingState(button);
    event.preventDefault();
  });

  keyboard.addEventListener('mousedown', (event) => {
    if (!(event.target instanceof Element)) {
      return;
    }

    const button = event.target.closest('button');

    if (button instanceof HTMLButtonElement) {
      saveSelection(getActiveInput());
      applyPressingState(button);
      event.preventDefault();
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
      button.tabIndex = -1;
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
      {
        className: '',
        keys: symbolRows[0]
          .map((value) => createValueKey(value))
          .concat([createActionKey('Backspace', 'backspace', `${keyClass}--control ${keyClass}--wide-label`)]),
      },
      {
        className: '',
        keys: symbolRows[1]
          .map((value) => createValueKey(value))
          .concat([createActionKey('Select all', 'select-all', `${keyClass}--control ${keyClass}--wide-label`)]),
      },
      {
        className: '',
        keys: symbolRows[2]
          .map((value) => createValueKey(value))
          .concat([createActionKey('Copy', 'copy', `${keyClass}--control ${keyClass}--wide-label`)]),
      },
      {
        className: '',
        keys: symbolRows[3]
          .map((value) => createValueKey(value))
          .concat([createActionKey('Paste', 'paste', `${keyClass}--control ${keyClass}--wide-label`)]),
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
    {
      className: '',
      keys: letterRows[0]
        .map((value) => createValueKey(value))
        .concat([createActionKey('Backspace', 'backspace', `${keyClass}--control ${keyClass}--wide-label`)]),
    },
    {
      className: '',
      keys: letterRows[1]
        .map((value) => createValueKey(resolveLetterValue(value, shiftActive, capsLockActive)))
        .concat([createActionKey('Select all', 'select-all', `${keyClass}--control ${keyClass}--wide-label`)]),
    },
    {
      className: '',
      keys: letterRows[2]
        .map((value) => createValueKey(resolveLetterValue(value, shiftActive, capsLockActive)))
        .concat([createActionKey('Copy', 'copy', `${keyClass}--control ${keyClass}--wide-label`)]),
    },
    {
      className: '',
      keys: [createActionKey('Shift', 'shift', `${keyClass}--control${shiftActive ? ` ${keyClass}--active` : ''}`)]
        .concat(letterRows[3].map((value) => createValueKey(resolveLetterValue(value, shiftActive, capsLockActive))))
        .concat([
          createActionKey('Shift', 'shift', `${keyClass}--control${shiftActive ? ` ${keyClass}--active` : ''}`),
          createActionKey('Paste', 'paste', `${keyClass}--control ${keyClass}--wide-label`),
        ]),
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

function shouldRenderAfterAction(action: KeyAction | undefined): boolean {
  return action === 'shift' || action === 'capslock' || action === 'toggle-mode';
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
  getSavedSelection: () => InputSelectionSnapshot | null,
  saveSelection: (input: HTMLInputElement | null) => void,
  setShiftActive: (value: boolean) => void,
  getCapsLockActive: () => boolean,
  setCapsLockActive: (value: boolean) => void,
  setSymbolMode: (value: boolean) => void,
  showStatus: (message: string, kind: KeyboardStatusKind) => void,
): boolean {
  const savedSelection = getSavedSelection();
  const input = focusInput(getPrimaryInput(doc, activeInput));
  if (action !== 'copy' && action !== 'backspace') {
    restoreInputSelection(input, savedSelection);
  }
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
    focusAdjacentCredentialInput(doc, input, getShiftActive() ? -1 : 1, setActiveInput);
    return getShiftActive();
  }

  if (action === 'enter') {
    submitForm(doc);
    return false;
  }

  if (!input) {
    if (action === 'copy') {
      showStatus('Select a username or password field first.', 'error');
    }

    return false;
  }

  if (action === 'select-all') {
    selectAllInputText(input);
    saveSelection(input);
    return false;
  }

  if (action === 'copy') {
    void copySelectedText(input, showStatus);
    return false;
  }

  if (action === 'paste') {
    void pasteClipboardText(input, saveSelection);
    return false;
  }

  if (action === 'backspace') {
    deleteInputSelectionOrCharacter(input);
    saveSelection(input);
    return false;
  }

  mutateInput(input, (inputValue, selectionStart, selectionEnd) => {
    const text = action === 'space' ? ' ' : value ?? '';
    return { nextValue: inputValue.slice(0, selectionStart) + text + inputValue.slice(selectionEnd), nextPosition: selectionStart + text.length };
  });
  saveSelection(input);

  return Boolean(value && !getSymbolMode() && getShiftActive() && /^[a-z]$/i.test(value));
}

function selectAllInputText(input: HTMLInputElement): void {
  try {
    input.setSelectionRange(0, input.value.length);
  } catch {
    input.select();
  }
}

async function copySelectedText(
  input: HTMLInputElement,
  showStatus: (message: string, kind: KeyboardStatusKind) => void,
): Promise<void> {
  try {
    if (!copyCurrentInputSelection(input.ownerDocument, input)) {
      showStatus('Select text before copying.', 'error');
      return;
    }

    showStatus('Copied to clipboard.', 'success');
  } catch (error) {
    showStatus(error instanceof Error ? error.message : 'Unable to copy the selected value.', 'error');
  }
}

function deleteInputSelectionOrCharacter(
  input: HTMLInputElement,
): void {
  if (deleteCurrentInputSelection(input.ownerDocument, input)) {
    return;
  }

  mutateInput(input, (inputValue, selectionStart, selectionEnd) => {
    if (selectionStart !== selectionEnd) {
      return { nextValue: inputValue.slice(0, selectionStart) + inputValue.slice(selectionEnd), nextPosition: selectionStart };
    }

    if (selectionStart === 0) {
      return null;
    }

    return { nextValue: inputValue.slice(0, selectionStart - 1) + inputValue.slice(selectionEnd), nextPosition: selectionStart - 1 };
  });
}

async function pasteClipboardText(input: HTMLInputElement, saveSelection: (input: HTMLInputElement | null) => void): Promise<void> {
  try {
    const clipboard = input.ownerDocument.defaultView?.navigator.clipboard ?? navigator.clipboard;

    if (!clipboard || typeof clipboard.readText !== 'function') {
      return;
    }

    const clipboardText = await clipboard.readText();

    if (!clipboardText) {
      return;
    }

    mutateInput(input, (inputValue, selectionStart, selectionEnd) => ({
      nextValue: inputValue.slice(0, selectionStart) + clipboardText + inputValue.slice(selectionEnd),
      nextPosition: selectionStart + clipboardText.length,
    }));
    saveSelection(input);
  } catch {
    // Ignore clipboard read failures so keyboard input still works.
  }
}

function copyCurrentInputSelection(doc: Document, input: HTMLInputElement): boolean {
  const execCommand = (doc as unknown as LegacyCopyDocument).execCommand;

  if (typeof execCommand !== 'function') {
    return false;
  }

  focusInput(input);

  try {
    return execCommand.call(doc, 'copy');
  } catch {
    return false;
  }
}

function deleteCurrentInputSelection(doc: Document, input: HTMLInputElement): boolean {
  const execCommand = (doc as unknown as LegacyCopyDocument).execCommand;

  if (typeof execCommand !== 'function') {
    return false;
  }

  if (doc.activeElement !== input) {
    focusInput(input);
  }

  try {
    return execCommand.call(doc, 'delete');
  } catch {
    return false;
  }
}

function captureInputSelection(input: HTMLInputElement | null): InputSelectionSnapshot | null {
  if (!isCredentialInput(input)) {
    return null;
  }

  return {
    direction: input.selectionDirection ?? 'none',
    end: input.selectionEnd ?? input.value.length,
    input,
    start: input.selectionStart ?? input.value.length,
    value: input.value,
  };
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

function restoreInputSelection(input: HTMLInputElement | null, snapshot: InputSelectionSnapshot | null): void {
  if (!input || !snapshot || snapshot.input !== input) {
    return;
  }

  try {
    input.setSelectionRange(snapshot.start, snapshot.end, snapshot.direction ?? 'none');
  } catch {
    // Ignore selection failures for input variants that do not expose selection ranges.
  }
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

function mutationAffectsKeyboard(doc: Document, mutation: MutationRecord): boolean {
  if (mutation.type !== 'childList') {
    return false;
  }

  return nodesAffectKeyboard(doc, mutation.addedNodes) || nodesAffectKeyboard(doc, mutation.removedNodes);
}

function nodesAffectKeyboard(doc: Document, nodes: NodeList): boolean {
  for (const node of Array.from(nodes)) {
    if (!isElementNode(doc, node)) {
      continue;
    }

    if (
      node.id === formId ||
      node.id === submitId ||
      node.classList.contains(rootClass) ||
      node.matches(credentialSelector) ||
      node.querySelector(`#${formId}, #${submitId}, ${credentialSelector}, .${rootClass}`)
    ) {
      return true;
    }
  }

  return false;
}

function isElementNode(doc: Document, node: unknown): node is Element {
  const ElementCtor = doc.defaultView?.Element;

  return typeof ElementCtor === 'function' && node instanceof ElementCtor;
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

function focusAdjacentCredentialInput(
  doc: Document,
  input: HTMLInputElement | null,
  direction: -1 | 1,
  setActiveInput: (input: HTMLInputElement | null) => void,
): void {
  const inputs = getCredentialInputs(doc);
  const currentIndex = input ? inputs.indexOf(input) : -1;
  const nextIndex = Math.min(Math.max(currentIndex + direction, 0), inputs.length - 1);
  const nextInput = inputs[nextIndex] ?? null;

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
    .${statusClass} {
      position: absolute;
      left: 50%;
      bottom: calc(100% + 8px);
      max-width: min(calc(100vw - 24px), 560px);
      padding: 8px 12px;
      border-radius: 10px;
      background: rgba(18, 18, 18, 0.94);
      box-shadow: 0 12px 24px rgba(0, 0, 0, 0.28);
      color: #fff;
      font: 600 13px/1.3 "Segoe UI", system-ui, sans-serif;
      opacity: 0;
      pointer-events: none;
      transform: translate(-50%, 8px);
      transition: opacity 120ms ease, transform 120ms ease;
      white-space: nowrap;
    }
    .${statusClass}--visible {
      opacity: 1;
      transform: translate(-50%, 0);
    }
    .${statusClass}--success {
      background: rgba(26, 94, 55, 0.96);
    }
    .${statusClass}--error {
      background: rgba(122, 35, 35, 0.96);
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
    .${keyClass} {
      appearance: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
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
      text-align: center;
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
      .${statusClass} {
        max-width: calc(100vw - 24px);
        font-size: 12px;
        white-space: normal;
      }
      .${panelClass} {
        padding: 10px;
      }
      .${rowClass} {
        gap: 6px;
        margin-top: 6px;
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
