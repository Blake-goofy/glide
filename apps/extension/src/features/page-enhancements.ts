import { installArriveAllTotes } from './arrive-all-totes';
import { installAdfsOverlayKeyboard } from './adfs-overlay-keyboard';
import { installClickableRows } from './clickable-rows';
import { installDarkModeBackgroundFix } from './dark-mode-background-fix';
import { getCurrentGlideSettings, onGlideSettingsChanged, type GlideSettingsState } from './glide-settings';
import { installSessionStrip } from './session-strip';
import { installUnitsInToteNumpad } from './units-in-tote-numpad';

type InstallableFeatureName = 'adfsKeyboard' | 'arriveAllTotes' | 'clickableRows' | 'darkModeBackgroundFix' | 'sessionStrip' | 'unitsInToteNumpad';

const featureInstallers: Record<InstallableFeatureName, () => () => void> = {
  adfsKeyboard: installAdfsOverlayKeyboard,
  arriveAllTotes: installArriveAllTotes,
  clickableRows: installClickableRows,
  darkModeBackgroundFix: installDarkModeBackgroundFix,
  sessionStrip: installSessionStrip,
  unitsInToteNumpad: installUnitsInToteNumpad,
};

const cleanupByFeature = new Map<InstallableFeatureName, () => void>();

export function initPageEnhancements(): void {
  void syncPageEnhancements();
  onGlideSettingsChanged((settingsState) => {
    applySettings(settingsState);
  });
}

async function syncPageEnhancements(): Promise<void> {
  applySettings(await getCurrentGlideSettings());
}

function applySettings(settingsState: GlideSettingsState): void {
  for (const [featureName, installer] of Object.entries(featureInstallers) as Array<[InstallableFeatureName, () => () => void]>) {
    const cleanup = cleanupByFeature.get(featureName);

    if (!settingsState[featureName]) {
      cleanup?.();
      cleanupByFeature.delete(featureName);
      continue;
    }

    if (!cleanup) {
      cleanupByFeature.set(featureName, installer());
    }
  }
}