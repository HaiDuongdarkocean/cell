import { isDevMode } from '@/shared/lib/env/devMode';
import { MESSAGE_REGISTRY } from './registry';
import type { MessageType } from './types';

export function messagePayload<T>(msg: unknown, type: MessageType): T | undefined {
  const m = msg as { type?: unknown; payload?: unknown } | null | undefined;
  if (m?.type !== type) return undefined;
  const schema = MESSAGE_REGISTRY[type]?.schema;
  if (!schema) return m.payload as T;
  const parsed = schema.safeParse(m.payload);
  if (!parsed.success) {
    if (isDevMode) {
      console.warn(
        `[messagePayload] invalid ${type} payload dropped:`,
        parsed.error.issues[0]?.message ?? parsed.error.message,
      );
    }
    return undefined;
  }
  return parsed.data as T;
}
