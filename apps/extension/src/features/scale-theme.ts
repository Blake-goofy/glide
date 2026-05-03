export interface ScaleThemePalette {
  border: string;
  buttonBorder: string;
  error: string;
  fieldBackground: string;
  fontFamily: string;
  inputBackground: string;
  inputText: string;
  muted: string;
  pageBackground: string;
  panelBackground: string;
  placeholder: string;
  rowBorder: string;
  secondaryButton: string;
  secondaryButtonText: string;
  startButton: string;
  startButtonText: string;
  stopButton: string;
  stopButtonText: string;
  text: string;
}

const themeSurfaceSelectors = [
  '.transheadermiddlepanel',
  '.transheaderleftpanel',
  '.transheaderrightpanel',
  '.transheaderpanel',
  '.cruddatapart',
];

const pageShellSelectors = [
  '.ion-page:not(.ion-page-hidden)',
  'app-generic-view-processor',
  'ion-app',
  '#TransactionScreenForm',
  '[data-controltype="form"]',
  '#scrollableContentWrapper',
  '.containercontent',
  'main',
  '#app',
];

const darkPageBackgroundAnchorSelectors = ['.ui-accordion .ui-accordion-content', '.ui-widget-content.ui-accordion-content'];
const darkPageBackgroundRuleSelectors = ["[data-igTheme='dark'] .ui-accordion .ui-accordion-content"];
const defaultDarkPageBackground = 'rgb(0, 0, 0)';

interface CssColor {
  alpha: number;
  blue: number;
  green: number;
  red: number;
}

export function resolveScaleThemePalette(doc: Document = document, ignoredElements: Element[] = []): ScaleThemePalette {
  const activeWindow = doc.defaultView && typeof doc.defaultView.getComputedStyle === 'function' ? doc.defaultView : window;

  if (typeof activeWindow.getComputedStyle !== 'function') {
    return {
      border: 'currentColor',
      buttonBorder: 'currentColor',
      error: 'currentColor',
      fieldBackground: 'transparent',
      fontFamily: '"Segoe UI", system-ui, sans-serif',
      inputBackground: 'transparent',
      inputText: 'currentColor',
      muted: 'currentColor',
      pageBackground: '',
      panelBackground: 'Canvas',
      placeholder: 'currentColor',
      rowBorder: 'currentColor',
      secondaryButton: 'transparent',
      secondaryButtonText: 'currentColor',
      startButton: 'ButtonFace',
      startButtonText: 'ButtonText',
      stopButton: 'ButtonFace',
      stopButtonText: 'ButtonText',
      text: 'CanvasText',
    };
  }

  const documentStyle = activeWindow.getComputedStyle(doc.documentElement);
  const activeTheme = getActiveTheme(doc);
  const themeSuffix = activeTheme === 'light' ? 'light' : 'dark';
  const visibleThemeSurface = findVisibleThemeSurface(doc, ignoredElements);
  const visiblePageShell = findVisiblePageShell(doc, ignoredElements);
  const darkPageBackground = activeTheme === 'dark' ? resolveDarkPageBackground(doc, ignoredElements) : '';
  const fontFamily = documentStyle.getPropertyValue('--ion-font-family').trim() || '"Segoe UI", system-ui, sans-serif';
  const panelBackground =
    getThemeSurfaceCssValue(doc, visibleThemeSurface, 'background-color') ||
    getThemeCssValue(documentStyle, [`--background-${themeSuffix}`, '--ion-background-color', '--background-md-color']) ||
    getElementCssValue(activeWindow, [visiblePageShell, doc.body, doc.documentElement], ['background-color']);
  const themeSurfaceText = getThemeSurfaceText(doc, activeWindow, visibleThemeSurface, panelBackground);
  const text =
    themeSurfaceText ||
    getThemeCssValue(documentStyle, [
      `--label-color-${themeSuffix}`,
      `--action-title-label-${themeSuffix}`,
      '--label-light',
      '--label-color',
      activeTheme === 'light' ? '--ion-color-light-contrast' : '--ion-color-dark-contrast',
      '--ion-text-color',
    ]) ||
    getElementCssValue(activeWindow, [visiblePageShell, doc.body, doc.documentElement], ['color']) ||
    'CanvasText';

  const panelColor = parseCssColor(panelBackground);
  const fieldFallback = panelColor ? formatCssColor(tintColor(panelColor, isDarkColor(panelColor) ? 0.12 : -0.06)) : panelBackground;
  const fieldBackground =
    getThemeCssValue(documentStyle, [
      `--text-input-background-color-${themeSuffix}`,
      `--action-menu-option-bg-${themeSuffix}`,
      `--action-title-bg-${themeSuffix}`,
      '--text-input-background-color',
    ]) || fieldFallback;
  const inputText =
    getThemeCssValue(documentStyle, [`--text-input-color-${themeSuffix}`, `--input-label-${themeSuffix}`, '--text-input-color', '--color-black']) || text;
  const borderBase = parseCssColor(inputText) || parseCssColor(text) || parseCssColor(fieldBackground) || panelColor;
  const border =
    getThemeCssValue(documentStyle, [
      `--text-input-border-${themeSuffix}`,
      `--border-${themeSuffix}`,
      '--warehousemobile-menu-border-bottom-color',
    ]) || (borderBase ? formatCssColor(borderBase, 0.28) : 'currentColor');

  const stopFallbackColor = parseCssColor(fieldBackground) || panelColor;
  const stopFallback = stopFallbackColor ? formatCssColor(tintColor(stopFallbackColor, isDarkColor(stopFallbackColor) ? 0.18 : -0.12)) : fieldBackground;
  const startButton =
    getThemeCssValue(documentStyle, [`--ion-color-go-${themeSuffix}`, '--ion-color-go', '--ion-color-primary']) || fieldBackground;
  const stopButton =
    getThemeCssValue(documentStyle, [`--action-title-bg-${themeSuffix}`, `--footer-bg-${themeSuffix}`, `--action-menu-option-bg-${themeSuffix}`]) || stopFallback;
  const secondaryButton =
    getThemeCssValue(documentStyle, [`--action-menu-option-bg-${themeSuffix}`, `--text-input-background-color-${themeSuffix}`, '--text-input-background-color']) ||
    fieldBackground;
  const pageBackground = activeTheme === 'light' ? '' : resolveDarkThemePageBackground(darkPageBackground, panelBackground, panelColor);
  const textCandidates = [text, inputText].filter(Boolean);

  return {
    border,
    buttonBorder: border,
    error: text,
    fieldBackground,
    fontFamily,
    inputBackground: fieldBackground,
    inputText,
    muted: text,
    pageBackground,
    panelBackground,
    placeholder: text,
    rowBorder: border,
    secondaryButton,
    secondaryButtonText: pickReadableTextColor(secondaryButton, textCandidates),
    startButton,
    startButtonText: pickReadableTextColor(startButton, textCandidates),
    stopButton,
    stopButtonText: pickReadableTextColor(stopButton, textCandidates),
    text,
  };
}

function resolveDarkThemePageBackground(darkPageBackground: string, panelBackground: string, panelColor: CssColor | null): string {
  if (darkPageBackground) {
    return darkPageBackground;
  }

  if (panelColor && isDarkColor(panelColor)) {
    return panelBackground;
  }

  return defaultDarkPageBackground;
}

function resolveDarkPageBackground(doc: Document, ignoredElements: Element[]): string {
  const anchor = findVisibleDarkPageBackgroundAnchor(doc, ignoredElements);

  if (anchor) {
    return getThemeSurfaceCssValue(doc, anchor, 'background-color');
  }

  return getStyleRuleValue(doc, darkPageBackgroundRuleSelectors, 'background-color');
}

function getActiveTheme(doc: Document): 'light' | 'dark' {
  const theme = String(doc.body?.getAttribute('data-theme') || '').trim().toLowerCase();
  return theme === 'light' ? 'light' : 'dark';
}

function findVisibleThemeSurface(doc: Document, ignoredElements: Element[]): HTMLElement | null {
  for (const selector of themeSurfaceSelectors) {
    for (const candidate of doc.querySelectorAll<HTMLElement>(selector)) {
      if (shouldIgnoreElement(candidate, ignoredElements) || isPlacementBranchHidden(candidate)) {
        continue;
      }

      return candidate;
    }
  }

  return null;
}

function findVisiblePageShell(doc: Document, ignoredElements: Element[]): HTMLElement {
  for (const selector of pageShellSelectors) {
    for (const candidate of doc.querySelectorAll<HTMLElement>(selector)) {
      if (shouldIgnoreElement(candidate, ignoredElements) || isPlacementBranchHidden(candidate)) {
        continue;
      }

      return candidate;
    }
  }

  return doc.body ?? doc.documentElement;
}

function findVisibleDarkPageBackgroundAnchor(doc: Document, ignoredElements: Element[]): HTMLElement | null {
  for (const selector of darkPageBackgroundAnchorSelectors) {
    for (const candidate of doc.querySelectorAll<HTMLElement>(selector)) {
      if (shouldIgnoreElement(candidate, ignoredElements) || isPlacementBranchHidden(candidate)) {
        continue;
      }

      return candidate;
    }
  }

  return null;
}

function shouldIgnoreElement(element: Element, ignoredElements: Element[]): boolean {
  return ignoredElements.some((ignoredElement) => ignoredElement === element || ignoredElement.contains(element));
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

function getThemeSurfaceCssValue(doc: Document, element: Element | null, propertyName: string): string {
  if (!element) {
    return '';
  }

  return getMatchingStyleRuleValue(doc, element, propertyName) || getElementCssValue(doc.defaultView ?? window, [element], [propertyName]);
}

function getThemeSurfaceText(doc: Document, activeWindow: Window, element: HTMLElement | null, panelBackground: string): string {
  if (!element) {
    return '';
  }

  const panelColor = parseCssColor(panelBackground);

  if (!panelColor) {
    return getElementCssValue(activeWindow, [element], ['color']);
  }

  const candidates: Element[] = [
    element,
    ...Array.from(
      element.querySelectorAll(
        'label, .LabelTop, .detailpaneheaderlabel, .cruddetailsmalllabel, input, select, button, [data-resourcevalue]',
      ),
    ),
  ];

  let bestValue = '';
  let bestContrast = 0;

  for (const candidate of candidates) {
    const value = getElementCssValue(activeWindow, [candidate], ['color']);
    const color = parseCssColor(value);

    if (!color) {
      continue;
    }

    const contrast = getContrastRatio(panelColor, color);

    if (contrast > bestContrast) {
      bestContrast = contrast;
      bestValue = value;
    }
  }

  return bestContrast >= 3 ? bestValue : '';
}

function getThemeCssValue(computedStyle: CSSStyleDeclaration, names: string[]): string {
  for (const name of names) {
    const value = computedStyle.getPropertyValue(name).trim();

    if (isUsableCssValue(value)) {
      return value;
    }
  }

  return '';
}

function getElementCssValue(activeWindow: Window, elements: Array<Element | null | undefined>, properties: string[]): string {
  for (const element of elements) {
    if (!(element instanceof Element)) {
      continue;
    }

    const computedStyle = activeWindow.getComputedStyle(element);

    for (const property of properties) {
      const value = computedStyle.getPropertyValue(property).trim();

      if (isUsableCssValue(value)) {
        return value;
      }
    }
  }

  return '';
}

function getMatchingStyleRuleValue(doc: Document, element: Element, propertyName: string): string {
  let matchedValue = '';
  let matchedImportantValue = '';

  const visitRules = (rules: CSSRuleList | undefined): void => {
    if (!rules) {
      return;
    }

    for (const rule of Array.from(rules)) {
      if (hasCssRules(rule)) {
        visitRules(rule.cssRules);
        continue;
      }

      if (!(rule instanceof CSSStyleRule) || !selectorMatchesElement(element, rule.selectorText)) {
        continue;
      }

      const value = rule.style.getPropertyValue(propertyName).trim();

      if (!isUsableCssValue(value)) {
        continue;
      }

      if (rule.style.getPropertyPriority(propertyName) === 'important') {
        matchedImportantValue = value;
      } else {
        matchedValue = value;
      }
    }
  };

  for (const styleSheet of Array.from(doc.styleSheets)) {
    try {
      visitRules(styleSheet.cssRules);
    } catch {
      // Ignore inaccessible stylesheets.
    }
  }

  return matchedImportantValue || matchedValue;
}

function getStyleRuleValue(doc: Document, selectorTexts: string[], propertyName: string): string {
  let matchedValue = '';
  let matchedImportantValue = '';
  const normalizedSelectorTexts = selectorTexts.map(normalizeSelector);

  const visitRules = (rules: CSSRuleList | undefined): void => {
    if (!rules) {
      return;
    }

    for (const rule of Array.from(rules)) {
      if (hasCssRules(rule)) {
        visitRules(rule.cssRules);
        continue;
      }

      if (!(rule instanceof CSSStyleRule) || !normalizedSelectorTexts.includes(normalizeSelector(rule.selectorText))) {
        continue;
      }

      const value = rule.style.getPropertyValue(propertyName).trim();

      if (!isUsableCssValue(value)) {
        continue;
      }

      if (rule.style.getPropertyPriority(propertyName) === 'important') {
        matchedImportantValue = value;
      } else {
        matchedValue = value;
      }
    }
  };

  for (const styleSheet of Array.from(doc.styleSheets)) {
    try {
      visitRules(styleSheet.cssRules);
    } catch {
      // Ignore inaccessible stylesheets.
    }
  }

  return matchedImportantValue || matchedValue;
}

function normalizeSelector(selectorText: string): string {
  return String(selectorText || '')
    .trim()
    .replace(/\s+/g, ' ');
}

function hasCssRules(rule: CSSRule): rule is CSSGroupingRule {
  return 'cssRules' in rule;
}

function selectorMatchesElement(element: Element, selectorText: string): boolean {
  for (const selector of String(selectorText || '').split(',')) {
    const trimmedSelector = selector.trim();

    if (!trimmedSelector) {
      continue;
    }

    try {
      if (element.matches(trimmedSelector)) {
        return true;
      }
    } catch {
      // Ignore unsupported selectors.
    }
  }

  return false;
}

function isUsableCssValue(value: string): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  return Boolean(normalized) && normalized !== 'transparent' && normalized !== 'rgba(0, 0, 0, 0)';
}

function parseCssColor(value: string): CssColor | null {
  const normalized = String(value || '').trim();

  if (!isUsableCssValue(normalized)) {
    return null;
  }

  if (normalized.startsWith('#')) {
    return parseHexColor(normalized);
  }

  const rgbMatch = normalized.match(/^rgba?\(([^)]+)\)$/i);

  if (!rgbMatch) {
    return null;
  }

  const rgbParts = rgbMatch[1];

  if (!rgbParts) {
    return null;
  }

  const parts = rgbParts.split(',').map((part) => part.trim());

  return {
    alpha: clampAlpha(parts[3] == null ? 1 : Number(parts[3])),
    blue: clampColorChannel(Number(parts[2])),
    green: clampColorChannel(Number(parts[1])),
    red: clampColorChannel(Number(parts[0])),
  };
}

function parseHexColor(value: string): CssColor | null {
  const hex = value.slice(1);

  if (hex.length === 3 || hex.length === 4) {
    const [redNibble, greenNibble, blueNibble, alphaNibble] = hex.split('');

    if (!redNibble || !greenNibble || !blueNibble) {
      return null;
    }

    return {
      alpha: hex.length === 4 && alphaNibble ? parseInt(alphaNibble + alphaNibble, 16) / 255 : 1,
      blue: parseInt(blueNibble + blueNibble, 16),
      green: parseInt(greenNibble + greenNibble, 16),
      red: parseInt(redNibble + redNibble, 16),
    };
  }

  if (hex.length === 6 || hex.length === 8) {
    return {
      alpha: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
      blue: parseInt(hex.slice(4, 6), 16),
      green: parseInt(hex.slice(2, 4), 16),
      red: parseInt(hex.slice(0, 2), 16),
    };
  }

  return null;
}

function pickReadableTextColor(backgroundValue: string, candidates: string[]): string {
  const backgroundColor = parseCssColor(backgroundValue);

  if (!backgroundColor) {
    return candidates[0] || 'currentColor';
  }

  let bestCandidate = candidates[0] || 'currentColor';
  let bestContrast = -1;

  for (const candidate of candidates) {
    const candidateColor = parseCssColor(candidate);

    if (!candidateColor) {
      continue;
    }

    const contrast = getContrastRatio(backgroundColor, candidateColor);

    if (contrast > bestContrast) {
      bestContrast = contrast;
      bestCandidate = candidate;
    }
  }

  return bestCandidate;
}

function tintColor(color: CssColor, amount: number): CssColor {
  const target = amount >= 0 ? 255 : 0;
  const magnitude = Math.abs(amount);

  return {
    alpha: color.alpha,
    blue: mixColorChannel(color.blue, target, magnitude),
    green: mixColorChannel(color.green, target, magnitude),
    red: mixColorChannel(color.red, target, magnitude),
  };
}

function formatCssColor(color: CssColor, alpha?: number): string {
  const resolvedAlpha = alpha ?? color.alpha;

  if (resolvedAlpha >= 1) {
    return `rgb(${color.red}, ${color.green}, ${color.blue})`;
  }

  return `rgba(${color.red}, ${color.green}, ${color.blue}, ${resolvedAlpha})`;
}

function mixColorChannel(channel: number, target: number, amount: number): number {
  return clampColorChannel(channel + (target - channel) * amount);
}

function clampColorChannel(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(255, Math.round(value)));
}

function clampAlpha(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.max(0, Math.min(1, value));
}

function isDarkColor(color: CssColor): boolean {
  return getColorLuminance(color) < 0.5;
}

function getColorLuminance(color: CssColor): number {
  return 0.2126 * toLinearColorChannel(color.red) + 0.7152 * toLinearColorChannel(color.green) + 0.0722 * toLinearColorChannel(color.blue);
}

function toLinearColorChannel(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function getContrastRatio(colorA: CssColor, colorB: CssColor): number {
  const lighter = Math.max(getColorLuminance(colorA), getColorLuminance(colorB));
  const darker = Math.min(getColorLuminance(colorA), getColorLuminance(colorB));
  return (lighter + 0.05) / (darker + 0.05);
}