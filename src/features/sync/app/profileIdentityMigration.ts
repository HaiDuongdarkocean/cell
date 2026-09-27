import { profileIdForTarget } from '@/entities/settings';
import type { LanguageProfile } from '@/entities/settings';
import { baseLangCode, toIso6391 } from '@/shared/config/languageRegistry';
import { logger } from '@/shared/lib/logger';
import { loadSettings, saveSettings } from '@/shared/lib/storage/settingsStore';
import type { SrsSyncAccess } from '../ports/srsSyncAccess';

export interface ProfileIdentityMigrationDeps {
  readonly srs: SrsSyncAccess;
}

export async function migrateProfileIdentity(
  deps: ProfileIdentityMigrationDeps,
): Promise<boolean> {
  const settings = await loadSettings();
  if (settings.syncMigrations?.profileIdentity === 'done') return false;

  const groups = new Map<string, LanguageProfile[]>();
  for (const profile of settings.languageProfiles) {
    const target = toIso6391(baseLangCode(profile.target));
    const members = groups.get(target) ?? [];
    members.push(profile);
    groups.set(target, members);
  }

  const rename = new Map<string, string>();
  const survivors: LanguageProfile[] = [];
  for (const [target, members] of groups) {
    const survivor = [...members].sort(
      (a, b) => a.order - b.order || a.id.localeCompare(b.id),
    )[0]!;
    const nextId = profileIdForTarget(target);
    for (const member of members) rename.set(member.id, nextId);
    survivors.push({ ...survivor, id: nextId });
  }
  survivors.sort((a, b) => a.order - b.order || a.target.localeCompare(b.target));
  const reordered = survivors.map((profile, index) => ({ ...profile, order: index + 1 }));

  await deps.srs.rewriteCollectionProfileIds(rename);

  const remapped = (id: string | null): string | null =>
    id === null ? null : (rename.get(id) ?? id);
  await saveSettings({
    languageProfiles: reordered,
    activeProfileId: remapped(settings.activeProfileId),
    srs: {
      ...settings.srs,
      activeLanguageProfileId: remapped(settings.srs.activeLanguageProfileId),
    },
    syncMigrations: { ...settings.syncMigrations, profileIdentity: 'done' },
  });

  const moves = [...rename.entries()].filter(([from, to]) => from !== to);
  logger.info('sync: profile identity migration', { rename: Object.fromEntries(moves) });
  return true;
}
