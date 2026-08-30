/**
 * Local Forvo/Lingvo DSL audio provider.
 *
 * Bridges the stored file handles, the `.dsl` index, and the zip resolver to
 * produce `AudioItem`s for the dictionary popup. When a term is present in the
 * local index, each referenced audio path is extracted from the configured zip
 * package and returned as raw `audioBytes`. The UI context is responsible for
 * creating and revoking blob URLs from these bytes.
 */

import type { LocalFileAudioSettings } from '@/entities/settings';
import type { AudioItem } from '@/features/dictionaryPopup/types';
import { getFileHandle, verifyPermission } from '@/shared/lib/storage/localFileHandleStorage';
import { getLingvoDslAudioPaths } from '../repositories/lingvoDslIndexRepository';
import { SingleZipAudioResolver, SplitZipAudioResolver, type ZipAudioResolver } from './zipAudioResolver';
import type { AudioEngineKind } from '../types';
import type { PronunciationAudioProvider } from './pronunciationAudioOrchestrator';

export class LingvoDslAudioProvider implements PronunciationAudioProvider {
  readonly kind: AudioEngineKind = 'localFile';
  private resolver: ZipAudioResolver | null = null;

  constructor(private readonly settings: LocalFileAudioSettings) {}

  async resolve(term: string, _langCode: string): Promise<readonly AudioItem[]> {
    const packageId = this.settings.dslFileHandleId ?? this.settings.audioArchiveHandleId ?? this.settings.splitArchiveDirectoryHandleId;
    if (!packageId) return [];

    const paths = await getLingvoDslAudioPaths(packageId, term);
    if (!paths || paths.length === 0) return [];

    const resolver = await this.getResolver();
    if (!resolver) return [];

    const items: AudioItem[] = [];
    for (const path of paths) {
      const audioBytes = await resolver.resolveAudio(term, path);
      if (!audioBytes) continue;
      items.push({
        id: `local-${packageId}-${term}-${path}`,
        kind: 'word',
        source: 'local',
        label: `Forvo · ${path}`,
        state: 'idle',
        audioBytes,
        defaultSelected: false,
      });
    }

    return items;
  }

  private async getResolver(): Promise<ZipAudioResolver | null> {
    if (this.resolver) return this.resolver;

    if (this.settings.packageType === 'single') {
      const { audioArchiveHandleId } = this.settings;
      if (!audioArchiveHandleId) return null;
      const handle = await getFileHandle(audioArchiveHandleId);
      if (!handle || handle.kind !== 'file') return null;
      if (!(await verifyPermission(handle, 'read'))) return null;
      this.resolver = new SingleZipAudioResolver(() => (handle as FileSystemFileHandle).getFile());
      return this.resolver;
    }

    const { splitArchiveDirectoryHandleId, splitArchivePattern } = this.settings;
    if (!splitArchiveDirectoryHandleId || !splitArchivePattern) return null;
    const handle = await getFileHandle(splitArchiveDirectoryHandleId);
    if (!handle || handle.kind !== 'directory') return null;
    if (!(await verifyPermission(handle, 'read'))) return null;
    this.resolver = new SplitZipAudioResolver(handle as FileSystemDirectoryHandle, splitArchivePattern);
    return this.resolver;
  }
}
