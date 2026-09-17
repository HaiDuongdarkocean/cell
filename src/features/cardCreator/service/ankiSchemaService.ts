import { findRecentNote, getNoteInfo } from './cardCreatorService';
import { refreshAnkiSchemaCache } from './ankiSchemaCache';

export interface RecentNoteLookup {
  readonly id: number | null;
  readonly info: { fields: Record<string, string>; tags: string[] } | null;
}

export interface RefreshedSchema {
  readonly decks: readonly string[];
  readonly models: readonly string[];
}

export function isMissingSchemaError(error: string): boolean {
  const lower = error.toLowerCase();
  return (
    lower.includes('deck') ||
    lower.includes('model') ||
    lower.includes('note type') ||
    lower.includes('not found') ||
    lower.includes('does not exist')
  );
}

export function resolveSchemaChoice(
  options: readonly string[],
  restored: string,
  configured: string,
): string {
  if (options.includes(restored)) return restored;
  if (options.includes(configured)) return configured;
  return options[0] ?? '';
}

export async function fetchRecentNote(
  url: string,
  deck: string,
  noteType: string,
): Promise<RecentNoteLookup> {
  const recentR = await findRecentNote(url, deck, noteType);
  let id: number | null = null;
  let info: RecentNoteLookup['info'] = null;
  if (recentR.ok && recentR.value !== null) {
    id = recentR.value;
    const infoR = await getNoteInfo(url, recentR.value);
    if (infoR.ok && infoR.value) {
      info = { fields: infoR.value.fields, tags: infoR.value.tags };
    }
  }
  return { id, info };
}

export async function runWithSchemaRetry<T>(
  url: string,
  onSchemaRefreshed: (schema: RefreshedSchema) => void,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!isMissingSchemaError(msg)) throw err;
  }

  const refresh = await refreshAnkiSchemaCache(url);
  if (refresh.ok) {
    onSchemaRefreshed({ decks: refresh.value.decks, models: refresh.value.models });
  }

  return await fn();
}
