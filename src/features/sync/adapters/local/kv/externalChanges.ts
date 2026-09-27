import {
  onStorageChanged,
  removeOnStorageChangedListener,
} from '@/shared/lib/chrome-apis';
import { SYNCED_STORAGE_KEYS } from './keys';

export type StorageChangeListener = (
  changes: Record<string, unknown>,
  area: string,
) => void;

export interface ExternalChangeDeps {
  readonly keys?: readonly string[];
  readonly addListener?: (listener: StorageChangeListener) => void;
  readonly removeListener?: (listener: StorageChangeListener) => void;
}

export function scheduleOnExternalChange(
  onSyncedKey: () => void,
  deps: ExternalChangeDeps = {},
): () => void {
  const keys = new Set(deps.keys ?? SYNCED_STORAGE_KEYS);
  const addListener = deps.addListener ?? onStorageChanged;
  const removeListener = deps.removeListener ?? removeOnStorageChangedListener;
  const listener: StorageChangeListener = (changes, area) => {
    if (area !== 'local') return;
    for (const key of Object.keys(changes)) {
      if (keys.has(key)) {
        onSyncedKey();
        return;
      }
    }
  };
  addListener(listener);
  return () => removeListener(listener);
}
