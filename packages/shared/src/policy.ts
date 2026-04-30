import { z } from 'zod';

import { defaultFeatureFlags, featureFlagNames } from './feature-flags.js';

const featureFlagsSchema = z.object(Object.fromEntries(featureFlagNames.map((flagName) => [flagName, z.boolean().optional()]))) as z.ZodObject<{
  arriveAllTotes: z.ZodOptional<z.ZodBoolean>;
  bridgeSpike: z.ZodOptional<z.ZodBoolean>;
  sessionStrip: z.ZodOptional<z.ZodBoolean>;
}>;

export const managedPolicySchema = z.object({
  allowedHosts: z.array(z.string().min(1)).default([]),
  diagnosticsEnabled: z.boolean().default(false),
  featureFlags: featureFlagsSchema.default({}),
});

export type ManagedPolicy = z.infer<typeof managedPolicySchema>;

export function parseManagedPolicy(value: unknown): ManagedPolicy {
  const parsed = managedPolicySchema.parse(value ?? {});
  return {
    ...parsed,
    featureFlags: {
      ...defaultFeatureFlags,
      ...parsed.featureFlags,
    },
  };
}
