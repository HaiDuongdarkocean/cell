import { loadSettings, saveSettings } from '@/shared/lib/storage/settingsStore';
import { autoMapFields, type FieldMapping } from './fieldMapping';

export interface ResolvedFieldMapping {
  readonly mapping: FieldMapping;
  readonly shouldPersist: boolean;
}

export function resolveFieldMapping(
  ankiFields: readonly string[],
  savedMapping: FieldMapping | undefined,
  restoredMapping?: FieldMapping,
): ResolvedFieldMapping {
  if (savedMapping) return { mapping: savedMapping, shouldPersist: false };
  return {
    mapping: restoredMapping ?? autoMapFields(ankiFields),
    shouldPersist: true,
  };
}

export class FieldMappingWriter {
  private queue: Promise<void> = Promise.resolve();

  persist(noteType: string, mapping: FieldMapping): void {
    if (!noteType) return;
    this.queue = this.queue
      .then(async () => {
        const s = await loadSettings();
        await saveSettings({
          cardCreator: {
            ...s.cardCreator,
            fieldMappings: {
              ...(s.cardCreator.fieldMappings ?? {}),
              [noteType]: mapping,
            },
          },
        });
      })
      .catch(() => {});
  }
}
