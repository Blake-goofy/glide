import { resolveScaleThemePalette } from './scale-theme';

interface BackgroundSnapshot {
  priority: string;
  value: string;
}

export function installDarkModeBackgroundFix(doc: Document = document): () => void {
  let observer: MutationObserver | null = null;
  let queued = false;
  let htmlBackground: BackgroundSnapshot | null = null;
  let bodyBackground: BackgroundSnapshot | null = null;
  const detailPaneBackgrounds = new Map<HTMLElement, BackgroundSnapshot>();

  const sync = (): void => {
    if (!doc.body) {
      return;
    }

    const palette = resolveScaleThemePalette(doc);

    if (!palette.pageBackground) {
      restoreBackground();
      return;
    }

    htmlBackground ??= captureBackground(doc.documentElement);
    bodyBackground ??= captureBackground(doc.body);
    doc.documentElement.style.setProperty('background-color', palette.pageBackground, 'important');
    doc.body.style.setProperty('background-color', palette.pageBackground, 'important');
    applyDetailPaneBackgrounds(palette.pageBackground);
  };

  const queueSync = (): void => {
    const activeWindow = doc.defaultView ?? window;

    if (queued) {
      return;
    }

    queued = true;
    activeWindow.requestAnimationFrame(() => {
      queued = false;
      sync();
    });
  };

  sync();

  observer = new MutationObserver(() => {
    queueSync();
  });
  observer.observe(doc.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'data-theme', 'style', 'hidden', 'aria-hidden'],
    childList: true,
    subtree: true,
  });

  return () => {
    observer?.disconnect();
    restoreBackground();
  };

  function restoreBackground(): void {
    if (!doc.body) {
      return;
    }

    restoreElementBackground(doc.documentElement, htmlBackground);
    restoreElementBackground(doc.body, bodyBackground);
    for (const [element, snapshot] of detailPaneBackgrounds) {
      restoreElementBackground(element, snapshot);
    }
    detailPaneBackgrounds.clear();
    htmlBackground = null;
    bodyBackground = null;
  }

  function applyDetailPaneBackgrounds(backgroundColor: string): void {
    for (const element of doc.querySelectorAll<HTMLElement>('.detailpanepart')) {
      if (!detailPaneBackgrounds.has(element)) {
        detailPaneBackgrounds.set(element, captureBackground(element));
      }

      element.style.setProperty('background-color', backgroundColor, 'important');
    }
  }
}

function captureBackground(element: HTMLElement): BackgroundSnapshot {
  return {
    priority: element.style.getPropertyPriority('background-color'),
    value: element.style.getPropertyValue('background-color'),
  };
}

function restoreElementBackground(element: HTMLElement, snapshot: BackgroundSnapshot | null): void {
  if (!snapshot) {
    element.style.removeProperty('background-color');
    return;
  }

  if (snapshot.value) {
    element.style.setProperty('background-color', snapshot.value, snapshot.priority || undefined);
    return;
  }

  element.style.removeProperty('background-color');
}