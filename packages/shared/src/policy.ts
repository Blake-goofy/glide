import { z } from 'zod';

export const managedPolicySchema = z.object({
  allowedHosts: z.array(z.string().min(1)).default([]),
  diagnosticsEnabled: z.boolean().default(false),
});

export type ManagedPolicy = z.infer<typeof managedPolicySchema>;

export function parseManagedPolicy(value: unknown): ManagedPolicy {
  return managedPolicySchema.parse(value ?? {});
}
