import { DEFAULT_SRS_SETTINGS } from '@/shared/config/config';
import { loadSettings, saveSettings } from '@/shared/lib/storage/settingsStore';
import { generateId } from '@/features/srs/lib/helpers';
import { createDefaultNotetype } from '@/features/srs/lib/defaultNotetype';
import { createDefaultStudyConfig } from '@/features/srs/lib/defaultStudyConfig';
import { putCollection, getCollectionByLanguageProfileId } from '@/features/srs/repositories/collectionRepository';
import { putDeck } from '@/features/srs/repositories/deckRepository';
import { putNotetype } from '@/features/srs/repositories/notetypeRepository';
import { putStudyConfig } from '@/features/srs/repositories/studyConfigRepository';

export interface FirstRunResult {
  readonly collectionId: string;
  readonly deckId: string;
  readonly notetypeId: string;
  readonly studyConfigId: string;
  readonly created: boolean;
}

/** Ensure an SRS collection/deck/notetype/study-config exists for the active language profile. */
export async function ensureFirstRun(): Promise<FirstRunResult> {
  const settings = await loadSettings();

  const languageProfileId = settings.srs.activeLanguageProfileId ?? settings.activeProfileId;
  const profile = settings.languageProfiles.find((p) => p.id === languageProfileId);
  if (!profile) {
    // No active profile — caller should prompt user to create/select a language profile.
    throw new Error('No active language profile for SRS first run');
  }

  const existing = await getCollectionByLanguageProfileId(profile.id);
  if (existing) {
    return {
      collectionId: existing.id,
      deckId: existing.defaultDeckId,
      notetypeId: existing.defaultNotetypeId,
      studyConfigId: existing.defaultStudyConfigId,
      created: false,
    };
  }

  const collectionId = generateId();
  const studyConfigId = `sc-${collectionId}`;
  const deckId = `deck-${collectionId}`;
  const notetype = createDefaultNotetype(collectionId);

  const collection = {
    id: collectionId,
    languageProfileId: profile.id,
    targetLanguage: profile.target,
    name: 'My SRS',
    defaultStudyConfigId: studyConfigId,
    defaultDeckId: deckId,
    defaultNotetypeId: notetype.id,
    createdAt: Date.now(),
  };

  const studyConfig = createDefaultStudyConfig(studyConfigId);
  const deck = {
    id: deckId,
    collectionId,
    parentId: null,
    name: 'Default',
    order: 0,
    studyConfigId,
  };

  await putStudyConfig(studyConfig);
  await putNotetype(notetype);
  await putDeck(deck);
  await putCollection(collection);

  await saveSettings({
    srs: {
      ...DEFAULT_SRS_SETTINGS,
      ...settings.srs,
      activeLanguageProfileId: profile.id,
      activeCollectionId: collectionId,
      activeDeckId: deckId,
      activeNotetypeId: notetype.id,
      defaultStudyConfigId: studyConfigId,
    },
  });

  return {
    collectionId,
    deckId,
    notetypeId: notetype.id,
    studyConfigId,
    created: true,
  };
}
