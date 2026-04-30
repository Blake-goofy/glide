import { z } from 'zod';

export const scaleRequestHeaderNames = [
  'authorization',
  'environment',
  'warehouse',
  'username',
  'sessionid',
  'machinename',
  'processstartdatetime',
] as const;

export type ScaleRequestHeaderName = (typeof scaleRequestHeaderNames)[number];

export const scaleRequestContextSchema = z.object({
  authorization: z.string().optional(),
  environment: z.string().optional(),
  warehouse: z.string().optional(),
  username: z.string().optional(),
  sessionid: z.string().optional(),
  machinename: z.string().optional(),
  processstartdatetime: z.string().optional(),
});

export type ScaleRequestContext = z.infer<typeof scaleRequestContextSchema>;

export const userActionProcedureNames = ['GetSessionInfo', 'ArriveAllTotes', 'StartStopSession', 'ResolveSessionUser'] as const;

export type UserActionProcedureName = (typeof userActionProcedureNames)[number];

export interface UserActionRequest {
  action: UserActionProcedureName;
  changeValue?: string;
}

export interface UserActionResponse {
  Message?: string;
  MessageCode?: string;
  [key: string]: unknown;
}

export function normalizeScaleHeaderName(name: string): ScaleRequestHeaderName | null {
  const lowerName = name.toLowerCase();
  return scaleRequestHeaderNames.includes(lowerName as ScaleRequestHeaderName)
    ? (lowerName as ScaleRequestHeaderName)
    : null;
}
