/**
 * profileDataClient — content-script side of PROFILE_DATA_*.
 * Counts and wipes the data bound to a profile's target lang so the settings
 * panel can warn before a retarget destroys it.
 */
import { requestMessage } from '@/shared/lib/chrome-apis/runtime';
import { MESSAGE_TYPES } from '@/shared/config/messages';

export interface ProfileDataStatus {
  readonly vocab: number;
  readonly resources: number;
  readonly srs: boolean;
}

export async function checkProfileData(langCode: string, profileId: string): Promise<ProfileDataStatus> {
  const res = await requestMessage<ProfileDataStatus>(
    MESSAGE_TYPES.PROFILE_DATA_CHECK,
    { langCode, profileId },
    { fallback: 'PROFILE_DATA_CHECK failed' },
  );
  return res;
}

export async function wipeProfileData(langCode: string, profileId: string): Promise<void> {
  await requestMessage<Record<string, never>>(
    MESSAGE_TYPES.PROFILE_DATA_WIPE,
    { langCode, profileId },
    { fallback: 'PROFILE_DATA_WIPE failed' },
  );
}
