export const featureFlagNames = ['bridgeSpike', 'sessionStrip', 'arriveAllTotes'] as const;

export type FeatureFlagName = (typeof featureFlagNames)[number];

export type FeatureFlags = Record<FeatureFlagName, boolean>;

export const defaultFeatureFlags: FeatureFlags = {
  arriveAllTotes: false,
  bridgeSpike: true,
  sessionStrip: false,
};
