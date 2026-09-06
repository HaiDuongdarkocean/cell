// i18n — SSOT for all user-visible UI copy.
//
// Messages live in src/shared/i18n/messages/<locale>.json so they import
// cleanly in every context: React entrypoints, content scripts, Shadow DOM,
// the design-system showcase (plain Vite page), and jest. chrome.i18n is NOT
// the SSOT for UI copy — it does not exist outside extension contexts;
// public/_locales only covers manifest-level strings (__MSG_*__).

import en from './messages/en.json';
import viMessages from './messages/vi.json';
import { STORAGE_KEYS } from '@/shared/config/config';

export const SUPPORTED_LOCALES = ['en', 'vi'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

export type MessageKey = keyof typeof en;

// A missing key in vi.json fails typecheck — every message needs both locales.
const vi: Record<MessageKey, string> = viMessages;
const MESSAGES: Record<Locale, Record<MessageKey, string>> = { en, vi };

// --- UI-language override (settings.uiLanguage) ---
//
// `t()` resolves at call time: components repainting on the next render pick up
// a language change automatically — no store subscription needed. The Settings
// dialog re-renders on settings change, so the switcher applies live there.
// Non-React code (toasts, controllers) always reads the latest override.

let override: Locale | null = null;

/** Set the interface-language override. `'auto'` (or anything else) = detect. */
export function setUiLanguageOverride(lang: string): void {
  override = lang === 'en' || lang === 'vi' ? lang : null;
}

function applyStoredUiLanguage(settings: unknown): void {
  const lang = (settings as { uiLanguage?: unknown } | undefined)?.uiLanguage;
  if (typeof lang === 'string') setUiLanguageOverride(lang);
}

let storageSyncStarted = false;
// Self-contained sync: reads settings once, then follows chrome.storage changes.
// Skipped entirely outside extension contexts (showcase pages, jest).
function syncUiLanguageFromStorage(): void {
  if (storageSyncStarted) return;
  storageSyncStarted = true;
  if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) return;
  void chrome.storage.local.get(STORAGE_KEYS.SETTINGS).then((data) => {
    applyStoredUiLanguage(data?.[STORAGE_KEYS.SETTINGS]);
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    const change = changes[STORAGE_KEYS.SETTINGS];
    if (change) applyStoredUiLanguage(change.newValue);
  });
}

export function getLocale(): Locale {
  syncUiLanguageFromStorage();
  if (override) return override;
  const raw =
    (typeof chrome !== 'undefined' && chrome.i18n?.getUILanguage?.()) ||
    (typeof navigator !== 'undefined' ? navigator.language : '') ||
    '';
  return raw.toLowerCase().startsWith('vi') ? 'vi' : DEFAULT_LOCALE;
}

/** t('dict.tab.audio') or t('dict.audio.play', [name]) — $1..$9 placeholders. */
export function t(key: MessageKey, substitutions?: readonly (string | number)[]): string {
  const message = MESSAGES[getLocale()][key] ?? en[key] ?? key;
  if (!substitutions?.length) return message;
  return substitutions.reduce<string>(
    (text, value, index) => text.replaceAll(`$${index + 1}`, String(value)),
    message,
  );
}
