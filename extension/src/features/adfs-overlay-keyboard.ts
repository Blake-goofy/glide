const rootClass = 'glide-adfs-keyboard';
const layoutClass = `${rootClass}__layout`;
const mainClass = `${rootClass}__main`;
const panelClass = `${rootClass}__panel`;
const popupClass = `${rootClass}__popup`;
const popupKeyClass = `${rootClass}__popup-key`;
const rowClass = `${rootClass}__row`;
const sideClass = `${rootClass}__side`;
const sideRowClass = `${rootClass}__side-row`;
const keyClass = `${rootClass}__key`;
const keyContentClass = `${rootClass}__key-content`;
const keyPrimaryClass = `${rootClass}__key-primary`;
const keyPreviewClass = `${rootClass}__key-preview`;
const statusClass = `${rootClass}__status`;
const styleId = `${rootClass}-style`;
const formId = 'loginForm';
const submitId = 'submitButton';
const credentialSelector = '#userNameInput, #passwordInput';
const pressedBackgroundColor = '#1f1f1f';
const pressedBoxShadow = 'inset 0 2px 4px rgba(0, 0, 0, 0.34), 0 0 0 rgba(0, 0, 0, 0.12)';
const pressedTransform = 'translateY(3px)';
const longPressDelayMs = 450;
const statusDismissDelayMs = 2500;
const keyboardSizeModes = ['compact', 'comfortable', 'full'] as const;
const keyboardPreferencesStorageKey = 'glide.adfsKeyboard.preferences';
const numberRowKeys = [
  { value: '1', shiftValue: '!' },
  { value: '2', shiftValue: '@' },
  { value: '3', shiftValue: '#' },
  { value: '4', shiftValue: '$' },
  { value: '5', shiftValue: '%' },
  { value: '6', shiftValue: '^' },
  { value: '7', shiftValue: '&' },
  { value: '8', shiftValue: '*' },
  { value: '9', shiftValue: '(' },
  { value: '0', shiftValue: ')' },
] as const;
const letterRows = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm', '-'],
] as const;
const symbolRows = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')'],
  ['-', '_', '=', '+', '[', ']', '{', '}', '\\', '/'],
  [':', ';', "'", '"', '?', '<', '>', ',', '.'],
] as const;

type ArrowAction = 'arrow-left' | 'arrow-right' | 'arrow-up' | 'arrow-down';
type KeyAction = 'shift' | 'capslock' | 'toggle-mode' | 'toggle-numpad' | 'backspace' | 'tab' | 'space' | 'enter' | 'select-all' | 'copy' | 'paste' | 'cycle-size' | ArrowAction;
type KeyboardStatusKind = 'error' | 'success';
type KeyboardSizeMode = (typeof keyboardSizeModes)[number];

type InputSelectionDirection = Exclude<HTMLInputElement['selectionDirection'], undefined | null>;

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
  longPressValue?: string;
  previewLabel?: string;
  resetShiftOnPress?: boolean;
  value?: string;
}

interface KeyboardRow {
  className: string;
  keys: KeyboardKey[];
}

interface KeyboardSideRow {
  className: string;
  keys: KeyboardKey[];
}

interface LegacyCopyDocument {
  execCommand?: (commandId: string, showUI?: boolean, value?: string) => boolean;
}

interface ResolvedInputSelection {
  direction: InputSelectionDirection;
  end: number;
  start: number;
}

interface StoredKeyboardPreferences {
  keyboardSize?: KeyboardSizeMode;
  numpadVisible?: boolean;
}

export function installAdfsOverlayKeyboard(doc: Document = document): () => void {
  const activeWindow = doc.defaultView ?? window;
  const storedPreferences = readStoredKeyboardPreferences(activeWindow);
  let activeInput: HTMLInputElement | null = null;
  let activeSelection: InputSelectionSnapshot | null = null;
  let shiftActive = false;
  let capsLockActive = false;
  let symbolMode = false;
  let keyboardSize: KeyboardSizeMode = storedPreferences.keyboardSize ?? 'compact';
  let numpadVisible = storedPreferences.numpadVisible ?? true;

  const persistKeyboardPreferences = (): void => {
    writeStoredKeyboardPreferences(activeWindow, {
      keyboardSize,
      numpadVisible,
    });
  };

  const setStoredKeyboardSize = (value: KeyboardSizeMode): void => {
    keyboardSize = value;
    persistKeyboardPreferences();
  };

  const setStoredNumpadVisible = (value: boolean): void => {
    numpadVisible = value;
    persistKeyboardPreferences();
  };

  const captureActiveSelection = (input: HTMLInputElement | null, preferredSnapshot: InputSelectionSnapshot | null = null): void => {
    activeSelection = captureInputSelection(input, preferredSnapshot ?? activeSelection);
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
          () => keyboardSize,
          () => numpadVisible,
          (value) => {
            shiftActive = value;
          },
          (value) => {
            capsLockActive = value;
          },
          (value) => {
            symbolMode = value;
          },
          setStoredKeyboardSize,
          setStoredNumpadVisible,
          () => activeInput,
          (input) => {
            activeInput = input;
            captureActiveSelection(input);
          },
          () => activeSelection,
          captureActiveSelection,
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
  getKeyboardSize: () => KeyboardSizeMode,
  getNumpadVisible: () => boolean,
  setShiftActive: (value: boolean) => void,
  setCapsLockActive: (value: boolean) => void,
  setSymbolMode: (value: boolean) => void,
  setKeyboardSize: (value: KeyboardSizeMode) => void,
  setNumpadVisible: (value: boolean) => void,
  getActiveInput: () => HTMLInputElement | null,
  setActiveInput: (input: HTMLInputElement | null) => void,
  getSavedSelection: () => InputSelectionSnapshot | null,
  saveSelection: (input: HTMLInputElement | null, preferredSnapshot?: InputSelectionSnapshot | null) => void,
): HTMLElement {
  const keyboard = doc.createElement('div');
  const panel = doc.createElement('div');
  const popup = doc.createElement('div');
  const status = doc.createElement('div');
  let pressedPointerButton: HTMLButtonElement | null = null;
  let longPressTimerId: number | null = null;
  let longPressButton: HTMLButtonElement | null = null;
  let longPressValue: string | null = null;
  let suppressNextClick = false;
  keyboard.className = rootClass;
  keyboard.setAttribute('role', 'complementary');
  keyboard.setAttribute('aria-label', 'ADFS on-screen keyboard');
  panel.classList.add(panelClass);
  popup.className = popupClass;
  popup.setAttribute('aria-hidden', 'true');
  status.className = statusClass;
  status.setAttribute('aria-atomic', 'true');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('role', 'status');
  keyboard.append(panel, status, popup);

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

  const clearLongPressTimer = (): void => {
    if (longPressTimerId !== null) {
      activeWindow.clearTimeout(longPressTimerId);
      longPressTimerId = null;
    }
  };

  const hideLongPressPopup = (): void => {
    popup.className = popupClass;
    popup.replaceChildren();
    popup.style.removeProperty('left');
    popup.style.removeProperty('top');
    popup.setAttribute('aria-hidden', 'true');
  };

  const clearLongPressState = (): void => {
    clearLongPressTimer();
    longPressButton = null;
    longPressValue = null;
    hideLongPressPopup();
  };

  const hasTriggeredLongPress = (button: HTMLButtonElement): boolean => {
    return longPressButton === button && longPressValue !== null && popup.getAttribute('aria-hidden') === 'false';
  };

  const showLongPressPopup = (button: HTMLButtonElement, value: string): void => {
    const keyboardRect = keyboard.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    const popupKey = doc.createElement('div');

    popupKey.className = popupKeyClass;
    popupKey.textContent = value;
    popup.className = `${popupClass} ${popupClass}--visible`;
    popup.replaceChildren(popupKey);
    popup.style.left = `${buttonRect.left - keyboardRect.left + buttonRect.width / 2}px`;
    popup.style.top = `${buttonRect.top - keyboardRect.top - 8}px`;
    popup.setAttribute('aria-hidden', 'false');
  };

  const armLongPress = (button: HTMLButtonElement): void => {
    const candidateValue = button.dataset.longPressValue;

    if (!candidateValue) {
      clearLongPressState();
      return;
    }

    if (longPressButton === button && (longPressTimerId !== null || hasTriggeredLongPress(button))) {
      return;
    }

    clearLongPressTimer();
    hideLongPressPopup();
    longPressButton = button;
    longPressValue = null;
    longPressTimerId = activeWindow.setTimeout(() => {
      longPressTimerId = null;

      if (pressedPointerButton !== button || longPressButton !== button) {
        return;
      }

      longPressValue = candidateValue;
      showLongPressPopup(button, candidateValue);
    }, longPressDelayMs);
  };

  const setPressedPointerButton = (button: HTMLButtonElement | null): void => {
    if (pressedPointerButton === button) {
      return;
    }

    clearPressingState(pressedPointerButton);
    pressedPointerButton = button;

    if (pressedPointerButton) {
      applyPressingState(pressedPointerButton);
    }
  };

  const activateButton = (button: HTMLButtonElement, overrideValue?: string): void => {
    const action = button.dataset.action as KeyAction | undefined;
    const value = overrideValue ?? button.dataset.value;
    const resetShiftOnPress = button.dataset.resetShiftOnPress === 'true';

    clearStatus();
    const shouldResetShift = handleKey(
      doc,
      action,
      value,
      resetShiftOnPress,
      getActiveInput(),
      setActiveInput,
      getShiftActive,
      getSymbolMode,
      getKeyboardSize,
      getNumpadVisible,
      getSavedSelection,
      saveSelection,
      setShiftActive,
      getCapsLockActive,
      setCapsLockActive,
      setSymbolMode,
      setKeyboardSize,
      setNumpadVisible,
      showStatus,
    );

    if (shouldResetShift) {
      setShiftActive(false);
    }

    if (shouldRenderAfterAction(action) || shouldResetShift) {
      renderKeyboard(doc, keyboard, getShiftActive(), getCapsLockActive(), getSymbolMode(), getKeyboardSize(), getNumpadVisible());
    }
  };

  const restoreCredentialInputFocus = (): void => {
    activeWindow.setTimeout(() => {
      const input = focusInput(getPrimaryInput(doc, getActiveInput()));

      if (input) {
        setActiveInput(input);
      }
    }, 0);
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
    setPressedPointerButton(button);
    armLongPress(button);
    event.preventDefault();
  });

  keyboard.addEventListener('mousedown', (event) => {
    if (!(event.target instanceof Element)) {
      return;
    }

    const button = event.target.closest('button');

    if (button instanceof HTMLButtonElement) {
      saveSelection(getActiveInput());
      setPressedPointerButton(button);
      armLongPress(button);
      event.preventDefault();
    }
  });

  keyboard.addEventListener('pointermove', (event) => {
    const hoveredButton = event.target instanceof Element ? event.target.closest('button') : null;

    if (pressedPointerButton && hoveredButton !== pressedPointerButton) {
      clearPressingState(pressedPointerButton);
      clearLongPressState();
      return;
    }

    if (pressedPointerButton && hoveredButton === pressedPointerButton) {
      applyPressingState(pressedPointerButton);
    }
  });

  keyboard.addEventListener('pointerleave', () => {
    clearPressingState(pressedPointerButton);
    clearLongPressState();
  });

  keyboard.addEventListener('mousemove', (event) => {
    const hoveredButton = event.target instanceof Element ? event.target.closest('button') : null;

    if (pressedPointerButton && hoveredButton !== pressedPointerButton) {
      clearPressingState(pressedPointerButton);
      clearLongPressState();
      return;
    }

    if (pressedPointerButton && hoveredButton === pressedPointerButton) {
      applyPressingState(pressedPointerButton);
    }
  });

  keyboard.addEventListener('mouseleave', () => {
    clearPressingState(pressedPointerButton);
    clearLongPressState();
  });

  keyboard.addEventListener('contextmenu', (event) => {
    if (event.target instanceof Element && event.target.closest('button')) {
      event.preventDefault();
    }
  });

  keyboard.addEventListener('pointerup', (event) => {
    const button = event.target instanceof Element ? event.target.closest('button') : null;

    if (!(button instanceof HTMLButtonElement) || button !== pressedPointerButton) {
      setPressedPointerButton(null);
      clearLongPressState();
      return;
    }

    const overrideValue = hasTriggeredLongPress(button) ? longPressValue : null;
    setPressedPointerButton(null);
    clearLongPressState();
    suppressNextClick = true;
    event.preventDefault();
    activeWindow.setTimeout(() => {
      suppressNextClick = false;
    }, 0);

    activateButton(button, overrideValue ?? undefined);
    restoreCredentialInputFocus();
  });

  keyboard.addEventListener('pointercancel', (event) => {
    const button = event.target instanceof Element ? event.target.closest('button') : null;

    if (button === pressedPointerButton) {
      setPressedPointerButton(null);
    }

    clearLongPressState();
  });

  keyboard.addEventListener('mouseup', (event) => {
    const button = event.target instanceof Element ? event.target.closest('button') : null;

    if (!button || button !== pressedPointerButton) {
      setPressedPointerButton(null);
      clearLongPressState();
      return;
    }

    setPressedPointerButton(null);
    clearLongPressState();
  });

  keyboard.addEventListener('click', (event) => {
    const button = event.target instanceof Element ? event.target.closest('button') : null;

    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    event.preventDefault();

    if (suppressNextClick) {
      suppressNextClick = false;
      clearLongPressState();
      restoreCredentialInputFocus();
      return;
    }

    if (pressedPointerButton) {
      setPressedPointerButton(null);
      clearLongPressState();
      return;
    }

    clearLongPressState();
    clearPressingState(button);

    activateButton(button);
    restoreCredentialInputFocus();
  });

  renderKeyboard(doc, keyboard, getShiftActive(), getCapsLockActive(), getSymbolMode(), getKeyboardSize(), getNumpadVisible());
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
  keyboardSize: KeyboardSizeMode,
  numpadVisible: boolean,
): void {
  const panel = keyboard.querySelector(`.${panelClass}`);

  if (!(panel instanceof HTMLElement)) {
    return;
  }

  keyboard.dataset.size = keyboardSize;
  keyboard.dataset.numpadVisible = numpadVisible ? 'true' : 'false';
  panel.innerHTML = '';

  const layout = doc.createElement('div');
  const main = doc.createElement('div');
  const side = doc.createElement('div');
  layout.className = layoutClass;
  main.className = mainClass;
  side.className = sideClass;

  for (const rowValue of getRows(shiftActive, capsLockActive, symbolMode)) {
    const row = doc.createElement('div');
    row.className = `${rowClass}${rowValue.className ? ` ${rowValue.className}` : ''}`;

    for (const key of rowValue.keys) {
      const button = doc.createElement('button');
      button.type = 'button';
      button.tabIndex = -1;
      button.className = `${keyClass}${key.className ? ` ${key.className}` : ''}`;

      const content = doc.createElement('span');
      const primaryLabel = doc.createElement('span');
      content.className = keyContentClass;
      primaryLabel.className = keyPrimaryClass;
      primaryLabel.textContent = key.label;
      content.append(primaryLabel);

      if (key.previewLabel) {
        const previewLabel = doc.createElement('span');
        previewLabel.className = keyPreviewClass;
        previewLabel.textContent = key.previewLabel;
        content.append(previewLabel);
      }

      button.setAttribute('aria-label', key.previewLabel ? `${key.label} ${key.previewLabel}` : key.label);
      button.append(content);

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

      if (key.longPressValue) {
        button.dataset.longPressValue = key.longPressValue;
      }

      if (key.resetShiftOnPress) {
        button.dataset.resetShiftOnPress = 'true';
      }

      row.append(button);
    }

    main.append(row);
  }

  if (numpadVisible) {
    for (const rowValue of getSideRows()) {
      const row = doc.createElement('div');
      row.className = `${sideRowClass}${rowValue.className ? ` ${rowValue.className}` : ''}`;

      for (const key of rowValue.keys) {
        const button = doc.createElement('button');
        button.type = 'button';
        button.tabIndex = -1;
        button.className = `${keyClass}${key.className ? ` ${key.className}` : ''}`;

        const content = doc.createElement('span');
        const primaryLabel = doc.createElement('span');
        content.className = keyContentClass;
        primaryLabel.className = keyPrimaryClass;
        primaryLabel.textContent = key.label;
        content.append(primaryLabel);
        button.setAttribute('aria-label', key.label);
        button.append(content);

        if (key.action) {
          button.dataset.action = key.action;
        }

        if (key.value) {
          button.dataset.value = key.value;
        }

        row.append(button);
      }

      side.append(row);
    }
  }

  layout.append(main);

  if (numpadVisible) {
    layout.append(side);
  }

  panel.append(layout);
}

function getRows(shiftActive: boolean, capsLockActive: boolean, symbolMode: boolean): KeyboardRow[] {
  if (symbolMode) {
    return [
      {
        className: '',
        keys: [createActionKey('Size', 'cycle-size', `${keyClass}--control ${keyClass}--size-control ${keyClass}--wide-label`)]
          .concat(symbolRows[0].map((value) => createValueKey(value)))
          .concat([createActionKey('Backspace', 'backspace', `${keyClass}--control ${keyClass}--wide-label`)]),
      },
      {
        className: '',
        keys: [createActionKey('Tab', 'tab', `${keyClass}--control ${keyClass}--wide-label ${keyClass}--left-column`)]
          .concat(symbolRows[1].map((value) => createValueKey(value)))
          .concat([createActionKey('Select all', 'select-all', `${keyClass}--control ${keyClass}--wide-label`)]),
      },
      {
        className: '',
        keys: [createActionKey('Caps', 'capslock', `${keyClass}--control ${keyClass}--wide-label ${keyClass}--left-column${capsLockActive ? ` ${keyClass}--active` : ''}`)]
          .concat(symbolRows[2].map((value) => createValueKey(value)))
          .concat([createActionKey('Enter', 'enter', `${keyClass}--control ${keyClass}--wide-label`)]),
      },
      {
        className: '',
        keys: symbolRows[3]
          .map((value) => createValueKey(value))
          .concat([createActionKey('Copy', 'copy', `${keyClass}--control ${keyClass}--wide-label`)]),
      },
      {
        className: '',
        keys: [
          createActionKey('ABC', 'toggle-mode', `${keyClass}--control ${keyClass}--bottom-toggle`),
          createActionKey('Numpad', 'toggle-numpad', `${keyClass}--control ${keyClass}--bottom-toggle`),
          createActionKey('Space', 'space', `${keyClass}--space`),
          createActionKey('Paste', 'paste', `${keyClass}--control ${keyClass}--wide-label`),
        ],
      },
    ];
  }

  return [
    {
      className: '',
        keys: [createActionKey('Size', 'cycle-size', `${keyClass}--control ${keyClass}--size-control ${keyClass}--wide-label`)]
        .concat(getNumberRowKeys(shiftActive))
        .concat([createActionKey('Backspace', 'backspace', `${keyClass}--control ${keyClass}--wide-label`)]),
    },
    {
      className: '',
      keys: [createActionKey('Tab', 'tab', `${keyClass}--control ${keyClass}--wide-label ${keyClass}--left-column`)]
        .concat(letterRows[1].map((value) => createValueKey(resolveLetterValue(value, shiftActive, capsLockActive))))
        .concat([createActionKey('Select all', 'select-all', `${keyClass}--control ${keyClass}--wide-label`)]),
    },
    {
      className: '',
      keys: [createActionKey('Caps', 'capslock', `${keyClass}--control ${keyClass}--wide-label ${keyClass}--left-column${capsLockActive ? ` ${keyClass}--active` : ''}`)]
        .concat(letterRows[2].map((value) => createValueKey(resolveLetterValue(value, shiftActive, capsLockActive))))
        .concat([createActionKey('Enter', 'enter', `${keyClass}--control ${keyClass}--wide-label`)]),
    },
    {
      className: '',
      keys: [createActionKey('Shift', 'shift', `${keyClass}--control ${keyClass}--shift-left${shiftActive ? ` ${keyClass}--active` : ''}`)]
        .concat(letterRows[3].map((value) => createValueKey(resolveLetterValue(value, shiftActive, capsLockActive))))
        .concat([
          createActionKey('Copy', 'copy', `${keyClass}--control ${keyClass}--wide-label`),
        ]),
    },
    {
      className: '',
      keys: [
        createActionKey('&123', 'toggle-mode', `${keyClass}--control ${keyClass}--bottom-toggle`),
        createActionKey('Numpad', 'toggle-numpad', `${keyClass}--control ${keyClass}--bottom-toggle`),
        createActionKey('Space', 'space', `${keyClass}--space`),
        createActionKey('Paste', 'paste', `${keyClass}--control ${keyClass}--wide-label`),
      ],
    },
  ];
}

function getSideRows(): KeyboardSideRow[] {
  return [
    {
      className: '',
      keys: ['7', '8', '9'].map((value) => createValueKey(value)),
    },
    {
      className: '',
      keys: ['4', '5', '6'].map((value) => createValueKey(value)),
    },
    {
      className: '',
      keys: ['1', '2', '3'].map((value) => createValueKey(value)),
    },
    {
      className: '',
      keys: [
        createValueKey('0'),
        createActionKey('^', 'arrow-up', `${keyClass}--control ${keyClass}--arrow`),
      ],
    },
    {
      className: '',
      keys: [
        createActionKey('<', 'arrow-left', `${keyClass}--control ${keyClass}--arrow`),
        createActionKey('v', 'arrow-down', `${keyClass}--control ${keyClass}--arrow`),
        createActionKey('>', 'arrow-right', `${keyClass}--control ${keyClass}--arrow`),
      ],
    },
  ];
}

function shouldRenderAfterAction(action: KeyAction | undefined): boolean {
  return action === 'shift' || action === 'capslock' || action === 'toggle-mode' || action === 'toggle-numpad' || action === 'cycle-size';
}

function createValueKey(value: string): KeyboardKey {
  return {
    className: '',
    label: value,
    value,
  };
}

function getNumberRowKeys(shiftActive: boolean): KeyboardKey[] {
  return numberRowKeys.map(({ value, shiftValue }) => createNumberValueKey(value, shiftValue, shiftActive));
}

function createNumberValueKey(value: string, shiftValue: string, shiftActive: boolean): KeyboardKey {
  return {
    className: '',
    label: shiftActive ? shiftValue : value,
    longPressValue: shiftValue,
    previewLabel: shiftActive ? value : shiftValue,
    resetShiftOnPress: true,
    value: shiftActive ? shiftValue : value,
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
  resetShiftOnPress: boolean,
  activeInput: HTMLInputElement | null,
  setActiveInput: (input: HTMLInputElement | null) => void,
  getShiftActive: () => boolean,
  getSymbolMode: () => boolean,
  getKeyboardSize: () => KeyboardSizeMode,
  getNumpadVisible: () => boolean,
  getSavedSelection: () => InputSelectionSnapshot | null,
  saveSelection: (input: HTMLInputElement | null, preferredSnapshot?: InputSelectionSnapshot | null) => void,
  setShiftActive: (value: boolean) => void,
  getCapsLockActive: () => boolean,
  setCapsLockActive: (value: boolean) => void,
  setSymbolMode: (value: boolean) => void,
  setKeyboardSize: (value: KeyboardSizeMode) => void,
  setNumpadVisible: (value: boolean) => void,
  showStatus: (message: string, kind: KeyboardStatusKind) => void,
): boolean {
  const savedSelection = getSavedSelection();
  const input = focusInput(getPrimaryInput(doc, activeInput));

  if (action !== 'copy' && action !== 'backspace' && !isArrowAction(action)) {
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

  if (action === 'cycle-size') {
    setKeyboardSize(stepKeyboardSize(getKeyboardSize(), 1));
    return false;
  }

  if (action === 'toggle-numpad') {
    setNumpadVisible(!getNumpadVisible());
    return false;
  }

  if (action === 'tab') {
    focusAdjacentCredentialInput(doc, input, getShiftActive() ? -1 : 1, setActiveInput);
    return getShiftActive();
  }

  if (isArrowAction(action)) {
    const nextSelection = moveInputCaret(input, action, savedSelection);
    saveSelection(input, nextSelection);

    return false;
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
    const nextSelection = selectAllInputText(input);
    saveSelection(input, nextSelection);
    return false;
  }

  if (action === 'copy') {
    if (savedSelection?.input === input) {
      applyInputSelectionRange(input, savedSelection.start, savedSelection.end, savedSelection.direction);
    }

    void copySelectedText(input, showStatus);
    return false;
  }

  if (action === 'paste') {
    void pasteClipboardText(input, savedSelection, saveSelection);
    return false;
  }

  if (action === 'backspace') {
    const nextSelection = deleteInputSelectionOrCharacter(input, savedSelection);
    saveSelection(input, nextSelection);
    return false;
  }

  const nextSelection = mutateInput(input, savedSelection, (inputValue, selectionStart, selectionEnd) => {
    const text = action === 'space' ? ' ' : value ?? '';
    return { nextValue: inputValue.slice(0, selectionStart) + text + inputValue.slice(selectionEnd), nextPosition: selectionStart + text.length };
  });
  saveSelection(input, nextSelection);

  return Boolean(!getSymbolMode() && getShiftActive() && (resetShiftOnPress || Boolean(value && /^[a-z]$/i.test(value))));
}

function selectAllInputText(input: HTMLInputElement): InputSelectionSnapshot {
  applyInputSelectionRange(input, 0, input.value.length);
  return createInputSelectionSnapshot(input, 0, input.value.length, 'none');
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
  selectionSnapshot: InputSelectionSnapshot | null,
): InputSelectionSnapshot | null {
  if (selectionSnapshot?.input === input && selectionSnapshot.start !== selectionSnapshot.end) {
    applyInputSelectionRange(input, selectionSnapshot.start, selectionSnapshot.end, selectionSnapshot.direction);
  }

  if (deleteCurrentInputSelection(input.ownerDocument, input)) {
    return captureInputSelection(input, selectionSnapshot);
  }

  return mutateInput(input, selectionSnapshot, (inputValue, selectionStart, selectionEnd) => {
    if (selectionStart !== selectionEnd) {
      return { nextValue: inputValue.slice(0, selectionStart) + inputValue.slice(selectionEnd), nextPosition: selectionStart };
    }

    if (selectionStart === 0) {
      return null;
    }

    return { nextValue: inputValue.slice(0, selectionStart - 1) + inputValue.slice(selectionEnd), nextPosition: selectionStart - 1 };
  });
}

function moveInputCaret(input: HTMLInputElement | null, action: ArrowAction, selectionSnapshot: InputSelectionSnapshot | null): InputSelectionSnapshot | null {
  if (!input) {
    return null;
  }

  const selection = resolveInputSelection(input, selectionSnapshot);
  const valueLength = input.value.length;
  const selectionStart = selection.start;
  const selectionEnd = selection.end;
  let nextPosition = selectionEnd;

  if (action === 'arrow-left') {
    nextPosition = selectionStart === selectionEnd ? Math.max(selectionStart - 1, 0) : selectionStart;
  } else if (action === 'arrow-right') {
    nextPosition = selectionStart === selectionEnd ? Math.min(selectionEnd + 1, valueLength) : selectionEnd;
  } else if (action === 'arrow-up') {
    nextPosition = 0;
  } else if (action === 'arrow-down') {
    nextPosition = valueLength;
  }

  applyInputSelectionRange(input, nextPosition, nextPosition);

  scheduleArrowCaretStabilization(input, nextPosition);

  input.ownerDocument.defaultView?.requestAnimationFrame(() => {
    scheduleArrowCaretStabilization(input, nextPosition);
  });

  input.ownerDocument.defaultView?.setTimeout(() => {
    scheduleArrowCaretStabilization(input, nextPosition);
  }, 50);

  return createInputSelectionSnapshot(input, nextPosition, nextPosition, selection.direction);
}

function applyInputSelectionRange(
  input: HTMLInputElement,
  selectionStart: number,
  selectionEnd: number,
  direction: InputSelectionDirection = 'none',
): void {
  const applied = withInputSelectionAccess(input, () => {
    input.setSelectionRange(selectionStart, selectionEnd, direction);
  });

  if (!applied) {
    return;
  }

  input.dispatchEvent(new Event('select', { bubbles: true, composed: true }));
}

async function pasteClipboardText(
  input: HTMLInputElement,
  selectionSnapshot: InputSelectionSnapshot | null,
  saveSelection: (input: HTMLInputElement | null, preferredSnapshot?: InputSelectionSnapshot | null) => void,
): Promise<void> {
  try {
    const clipboard = input.ownerDocument.defaultView?.navigator.clipboard ?? navigator.clipboard;

    if (!clipboard || typeof clipboard.readText !== 'function') {
      return;
    }

    const clipboardText = await clipboard.readText();

    if (!clipboardText) {
      return;
    }

    const nextSelection = mutateInput(input, selectionSnapshot, (inputValue, selectionStart, selectionEnd) => ({
      nextValue: inputValue.slice(0, selectionStart) + clipboardText + inputValue.slice(selectionEnd),
      nextPosition: selectionStart + clipboardText.length,
    }));
    saveSelection(input, nextSelection);
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

function captureInputSelection(input: HTMLInputElement | null, fallbackSnapshot: InputSelectionSnapshot | null = null): InputSelectionSnapshot | null {
  if (!isCredentialInput(input)) {
    return null;
  }

  const selection = resolveInputSelection(input, fallbackSnapshot);
  return createInputSelectionSnapshot(input, selection.start, selection.end, selection.direction);
}

function mutateInput(
  input: HTMLInputElement,
  selectionSnapshot: InputSelectionSnapshot | null,
  mutate: (value: string, selectionStart: number, selectionEnd: number) => { nextValue: string; nextPosition: number } | null,
): InputSelectionSnapshot | null {
  const value = input.value;
  const selection = resolveInputSelection(input, selectionSnapshot);
  const selectionStart = selection.start;
  const selectionEnd = selection.end;
  const next = mutate(value, selectionStart, selectionEnd);

  if (!next) {
    return selectionSnapshot;
  }

  setInputValue(input, next.nextValue);

  applyInputSelectionRange(input, next.nextPosition, next.nextPosition, selection.direction);

  input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));

  return createInputSelectionSnapshot(input, next.nextPosition, next.nextPosition, selection.direction);
}

function restoreInputSelection(input: HTMLInputElement | null, snapshot: InputSelectionSnapshot | null): void {
  if (!input || !snapshot || snapshot.input !== input) {
    return;
  }

  applyInputSelectionRange(input, snapshot.start, snapshot.end, snapshot.direction);
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

function createInputSelectionSnapshot(
  input: HTMLInputElement,
  start: number,
  end: number,
  direction: InputSelectionDirection,
): InputSelectionSnapshot {
  return {
    direction,
    end,
    input,
    start,
    value: input.value,
  };
}

function resolveInputSelection(input: HTMLInputElement, fallbackSnapshot: InputSelectionSnapshot | null): ResolvedInputSelection {
  const nativeSelection = readNativeInputSelection(input);

  if (nativeSelection) {
    return nativeSelection;
  }

  if (fallbackSnapshot?.input === input) {
    const clampedStart = Math.min(fallbackSnapshot.start, input.value.length);
    const clampedEnd = Math.min(fallbackSnapshot.end, input.value.length);

    return {
      direction: fallbackSnapshot.direction,
      end: clampedEnd,
      start: clampedStart,
    };
  }

  return {
    direction: 'none',
    end: input.value.length,
    start: input.value.length,
  };
}

function readNativeInputSelection(input: HTMLInputElement): ResolvedInputSelection | null {
  const selectionStart = input.selectionStart;
  const selectionEnd = input.selectionEnd;

  if (selectionStart === null || selectionEnd === null) {
    return null;
  }

  return {
    direction: input.selectionDirection ?? 'none',
    end: selectionEnd,
    start: selectionStart,
  };
}

function withInputSelectionAccess(input: HTMLInputElement, callback: () => void): boolean {
  try {
    callback();
    return true;
  } catch {
    return withTemporaryTextSelectionType(input, callback);
  }
}

function withTemporaryTextSelectionType(input: HTMLInputElement, callback: () => void): boolean {
  if (!canTemporarilySwitchInputTypeForSelection(input)) {
    return false;
  }

  const originalTypeAttribute = input.getAttribute('type');

  try {
    input.setAttribute('type', 'text');
    callback();
    return true;
  } catch {
    return false;
  } finally {
    if (originalTypeAttribute === null) {
      input.removeAttribute('type');
    } else {
      input.setAttribute('type', originalTypeAttribute);
    }

    focusInput(input);
  }
}

function canTemporarilySwitchInputTypeForSelection(input: HTMLInputElement): boolean {
  return input.type === 'email';
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

function stepKeyboardSize(currentSize: KeyboardSizeMode, delta: -1 | 1): KeyboardSizeMode {
  const currentIndex = keyboardSizeModes.indexOf(currentSize);
  const nextIndex = (currentIndex + delta + keyboardSizeModes.length) % keyboardSizeModes.length;

  return keyboardSizeModes[nextIndex] ?? currentSize;
}

function readStoredKeyboardPreferences(activeWindow: Window): StoredKeyboardPreferences {
  try {
    const storedValue = activeWindow.localStorage.getItem(keyboardPreferencesStorageKey);

    if (!storedValue) {
      return {};
    }

    const parsedValue = JSON.parse(storedValue) as StoredKeyboardPreferences;

    return {
      ...(isKeyboardSizeMode(parsedValue.keyboardSize) ? { keyboardSize: parsedValue.keyboardSize } : {}),
      ...(typeof parsedValue.numpadVisible === 'boolean' ? { numpadVisible: parsedValue.numpadVisible } : {}),
    };
  } catch {
    return {};
  }
}

function writeStoredKeyboardPreferences(activeWindow: Window, preferences: StoredKeyboardPreferences): void {
  try {
    activeWindow.localStorage.setItem(keyboardPreferencesStorageKey, JSON.stringify(preferences));
  } catch {
    // Ignore storage failures so the keyboard remains usable.
  }
}

function isKeyboardSizeMode(value: unknown): value is KeyboardSizeMode {
  return typeof value === 'string' && keyboardSizeModes.includes(value as KeyboardSizeMode);
}

function ensureStyles(doc: Document): void {
  if (doc.getElementById(styleId)) {
    return;
  }

  const style = doc.createElement('style');
  style.id = styleId;
  style.textContent = `
    .${rootClass} {
      --glide-adfs-keyboard-width: min(calc(100vw - 24px), 1020px);
      --glide-adfs-keyboard-bottom: 14px;
      --glide-adfs-keyboard-panel-padding: 12px;
      --glide-adfs-keyboard-row-gap: 8px;
      --glide-adfs-keyboard-key-height: 48px;
      --glide-adfs-keyboard-key-font-size: 16px;
      --glide-adfs-keyboard-wide-font-size: 15px;
      --glide-adfs-keyboard-side-width: 220px;
      --glide-adfs-keyboard-space-flex: 5.2 1 0;
      --glide-adfs-keyboard-enter-flex: 1.6 1 0;
      --glide-adfs-keyboard-control-flex: 1.35 1 0;
      --glide-adfs-keyboard-wide-flex: 1.7 1 0;
      --glide-adfs-keyboard-left-column-flex: 1.95 1 0;
      --glide-adfs-keyboard-bottom-toggle-flex: 1.55 1 0;
      --glide-adfs-keyboard-shift-left-flex: 2.85 1 0;
      --glide-adfs-keyboard-size-control-flex: 0.9 1 0;
      position: fixed;
      left: 50%;
      bottom: var(--glide-adfs-keyboard-bottom);
      transform: translateX(-50%);
      width: var(--glide-adfs-keyboard-width);
      z-index: 2147483640;
      pointer-events: none;
    }
    .${rootClass}[data-size="comfortable"] {
      --glide-adfs-keyboard-width: min(calc(100vw - 18px), 1180px);
      --glide-adfs-keyboard-bottom: 10px;
      --glide-adfs-keyboard-panel-padding: 16px;
      --glide-adfs-keyboard-row-gap: 10px;
      --glide-adfs-keyboard-key-height: 60px;
      --glide-adfs-keyboard-key-font-size: 18px;
      --glide-adfs-keyboard-wide-font-size: 16px;
      --glide-adfs-keyboard-side-width: 256px;
      --glide-adfs-keyboard-space-flex: 5.8 1 0;
      --glide-adfs-keyboard-enter-flex: 1.8 1 0;
      --glide-adfs-keyboard-control-flex: 1.45 1 0;
      --glide-adfs-keyboard-wide-flex: 1.85 1 0;
      --glide-adfs-keyboard-left-column-flex: 2.15 1 0;
      --glide-adfs-keyboard-bottom-toggle-flex: 1.72 1 0;
      --glide-adfs-keyboard-shift-left-flex: 3.05 1 0;
      --glide-adfs-keyboard-size-control-flex: 1.05 1 0;
    }
    .${rootClass}[data-size="full"] {
      --glide-adfs-keyboard-width: calc(100vw - 12px);
      --glide-adfs-keyboard-bottom: 6px;
      --glide-adfs-keyboard-panel-padding: 18px;
      --glide-adfs-keyboard-row-gap: 12px;
      --glide-adfs-keyboard-key-height: 72px;
      --glide-adfs-keyboard-key-font-size: 20px;
      --glide-adfs-keyboard-wide-font-size: 18px;
      --glide-adfs-keyboard-side-width: 300px;
      --glide-adfs-keyboard-space-flex: 6.4 1 0;
      --glide-adfs-keyboard-enter-flex: 2 1 0;
      --glide-adfs-keyboard-control-flex: 1.55 1 0;
      --glide-adfs-keyboard-wide-flex: 2.1 1 0;
      --glide-adfs-keyboard-left-column-flex: 2.4 1 0;
      --glide-adfs-keyboard-bottom-toggle-flex: 1.95 1 0;
      --glide-adfs-keyboard-shift-left-flex: 3.35 1 0;
      --glide-adfs-keyboard-size-control-flex: 1.15 1 0;
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
    .${popupClass} {
      position: absolute;
      left: 0;
      top: 0;
      opacity: 0;
      pointer-events: none;
      transform: translate(-50%, -100%);
      transition: opacity 120ms ease, transform 120ms ease;
      z-index: 1;
    }
    .${popupClass}--visible {
      opacity: 1;
      transform: translate(-50%, calc(-100% - 10px));
    }
    .${popupKeyClass} {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: min(92px, calc(var(--glide-adfs-keyboard-key-height) * 1.35));
      min-height: var(--glide-adfs-keyboard-key-height);
      padding-inline: 18px;
      border: 1px solid #747474;
      border-radius: 10px;
      background: #3a3a3a;
      box-shadow: 0 16px 24px rgba(0, 0, 0, 0.34);
      color: #fff;
      font: 700 calc(var(--glide-adfs-keyboard-key-font-size) + 1px)/1 "Segoe UI", system-ui, sans-serif;
      box-sizing: border-box;
    }
    .${panelClass} {
      pointer-events: auto;
      padding: var(--glide-adfs-keyboard-panel-padding);
      border-radius: 14px;
      background: rgba(18, 18, 18, 0.96);
      box-shadow: 0 18px 40px rgba(0, 0, 0, 0.36);
      backdrop-filter: blur(6px);
      box-sizing: border-box;
    }
    .${layoutClass} {
      display: flex;
      gap: var(--glide-adfs-keyboard-row-gap);
      align-items: stretch;
    }
    .${mainClass} {
      min-width: 0;
      flex: 1 1 auto;
    }
    .${sideClass} {
      display: flex;
      flex-direction: column;
      gap: var(--glide-adfs-keyboard-row-gap);
      width: var(--glide-adfs-keyboard-side-width);
      flex: 0 0 var(--glide-adfs-keyboard-side-width);
    }
    .${rowClass} {
      display: flex;
      gap: var(--glide-adfs-keyboard-row-gap);
      margin-top: var(--glide-adfs-keyboard-row-gap);
    }
    .${rowClass}:first-child {
      margin-top: 0;
    }
    .${sideRowClass} {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: var(--glide-adfs-keyboard-row-gap);
    }
    .${keyClass} {
      appearance: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 1 1 0;
      min-width: 0;
      min-height: var(--glide-adfs-keyboard-key-height);
      padding-inline: 10px;
      border: 1px solid #565656;
      border-radius: 8px;
      background: #2f2f2f;
      color: #fff;
      font: 600 var(--glide-adfs-keyboard-key-font-size)/1.1 "Segoe UI", system-ui, sans-serif;
      cursor: pointer;
      touch-action: manipulation;
      user-select: none;
      -webkit-touch-callout: none;
      white-space: nowrap;
      text-align: center;
      transform: translateY(0);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 2px 0 rgba(0, 0, 0, 0.38);
      transition: transform 70ms ease, box-shadow 70ms ease, background-color 70ms ease;
      box-sizing: border-box;
    }
    .${keyContentClass} {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      min-height: 100%;
    }
    .${keyPrimaryClass} {
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .${keyPreviewClass} {
      position: absolute;
      top: 4px;
      right: 2px;
      min-width: 0;
      font-size: max(11px, calc(var(--glide-adfs-keyboard-key-font-size) - 5px));
      line-height: 1;
      opacity: 0.82;
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
      flex: var(--glide-adfs-keyboard-control-flex);
      background: #242424;
    }
    .${keyClass}--space {
      flex: var(--glide-adfs-keyboard-space-flex);
    }
    .${keyClass}--enter {
      flex: var(--glide-adfs-keyboard-enter-flex);
    }
    .${keyClass}--wide-label {
      flex: var(--glide-adfs-keyboard-wide-flex);
      padding-inline: 22px;
      font-size: var(--glide-adfs-keyboard-wide-font-size);
    }
    .${keyClass}--left-column {
      flex: var(--glide-adfs-keyboard-left-column-flex);
    }
    .${keyClass}--bottom-toggle {
      flex: var(--glide-adfs-keyboard-bottom-toggle-flex);
    }
    .${keyClass}--shift-left {
      flex: var(--glide-adfs-keyboard-shift-left-flex);
    }
    .${keyClass}--size-control {
      flex: var(--glide-adfs-keyboard-size-control-flex);
    }
    .${keyClass}--arrow {
      font-size: max(13px, calc(var(--glide-adfs-keyboard-key-font-size) - 1px));
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
        padding: max(10px, calc(var(--glide-adfs-keyboard-panel-padding) - 2px));
      }
      .${layoutClass} {
        flex-direction: column;
      }
      .${sideClass} {
        width: 100%;
        flex: 0 0 auto;
      }
      .${rowClass} {
        gap: max(6px, calc(var(--glide-adfs-keyboard-row-gap) - 2px));
        margin-top: max(6px, calc(var(--glide-adfs-keyboard-row-gap) - 2px));
      }
      .${sideRowClass} {
        gap: max(6px, calc(var(--glide-adfs-keyboard-row-gap) - 2px));
      }
      .${keyClass} {
        min-height: max(44px, calc(var(--glide-adfs-keyboard-key-height) - 4px));
        font-size: max(14px, calc(var(--glide-adfs-keyboard-key-font-size) - 2px));
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

function isArrowAction(action: KeyAction | undefined): action is ArrowAction {
  return action === 'arrow-left' || action === 'arrow-right' || action === 'arrow-up' || action === 'arrow-down';
}

function scheduleArrowCaretStabilization(
  input: HTMLInputElement,
  nextPosition: number,
): void {
  if (input.ownerDocument.activeElement !== input) {
    focusInput(input);
  }

  applyInputSelectionRange(input, nextPosition, nextPosition);
}
