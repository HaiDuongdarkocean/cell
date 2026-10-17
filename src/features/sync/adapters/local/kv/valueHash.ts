import { canonicalJson } from '@/features/sync/domain/merge';
import { bytesToHex } from '@/shared/lib/codec';

export async function kvValueHash(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return bytesToHex(digest);
}
