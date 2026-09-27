import { baseLangCode, toIso6391 } from '@/shared/config/languageRegistry';
import type { AccountKey, ConnectionId, ProfileId, ProviderId, Scope } from './types';

export function targetOf(languageValue: string): string {
  return toIso6391(baseLangCode(languageValue));
}

export function profileIdForTarget(target: string): ProfileId {
  return `profile-${target}`;
}

export function scopeForTarget(target: string): Scope {
  return `profile:${target}`;
}

export function connectionId(providerId: ProviderId, accountKey: AccountKey): ConnectionId {
  return `${providerId}:${accountKey}`;
}
