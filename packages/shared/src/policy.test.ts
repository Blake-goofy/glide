import { describe, expect, it } from 'vitest';

import { parseManagedPolicy } from './policy.js';

describe('managed policy parsing', () => {
  it('fills in default feature flags when managed policy omits them', () => {
    expect(parseManagedPolicy({}).featureFlags).toEqual({
      arriveAllTotes: false,
      bridgeSpike: true,
      sessionStrip: false,
    });
  });
});