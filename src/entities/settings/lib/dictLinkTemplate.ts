import type { ExternalDictLinkTemplate } from '../types';

export const DICT_LINK_NAME_MAX = 64;
export const DICT_LINK_TEMPLATE_MAX = 2048;

export function makeDictLinkId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function isSafeDictUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateDictLink(name: string, urlTemplate: string): boolean {
  const trimmedName = name.trim();
  const trimmedTemplate = urlTemplate.trim();
  if (!trimmedName || trimmedName.length > DICT_LINK_NAME_MAX) return false;
  if (!trimmedTemplate || trimmedTemplate.length > DICT_LINK_TEMPLATE_MAX) return false;
  if (!trimmedTemplate.includes('{term}')) return false;
  return isSafeDictUrl(trimmedTemplate.replaceAll('{term}', 'x').replaceAll('{lang}', 'en'));
}

export function makeDictLink(name: string, urlTemplate: string): ExternalDictLinkTemplate {
  return {
    id: makeDictLinkId(),
    name: name.trim(),
    urlTemplate: urlTemplate.trim(),
    langCodes: [],
  };
}
