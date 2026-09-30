import type { FieldMapping } from '../model/normalized';

const PREFIX = 'ankiImport.mapping.';

async function storageGet(key: string): Promise<unknown> {
  try {
    const data = await chrome.storage.local.get(key);
    return data?.[key];
  } catch {
    return null;
  }
}

/** Persisted per-notetype-name field mapping (REQ-6 rule). */
export async function loadMappingPreset(notetypeName: string): Promise<FieldMapping | null> {
  const raw = await storageGet(`${PREFIX}${notetypeName}`);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return raw as FieldMapping;
}

export async function loadMappingPresets(notetypeNames: readonly string[]): Promise<Record<string, FieldMapping>> {
  const out: Record<string, FieldMapping> = {};
  for (const name of notetypeNames) {
    const preset = await loadMappingPreset(name);
    if (preset) out[name] = preset;
  }
  return out;
}

export async function saveMappingPreset(notetypeName: string, mapping: FieldMapping): Promise<void> {
  try {
    await chrome.storage.local.set({ [`${PREFIX}${notetypeName}`]: mapping });
  } catch {
    // non-extension context (tests, mock pages) — presets are best-effort
  }
}
