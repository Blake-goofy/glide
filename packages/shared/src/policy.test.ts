import { describe, expect, it } from 'vitest';

import { parseManagedPolicy } from './policy.js';

describe('managed policy parsing', () => {
  it('fills in the managed policy defaults when values are omitted', () => {
    expect(parseManagedPolicy({})).toEqual({
      allowedHosts: [],
      diagnosticsEnabled: false,
    });
  });
});