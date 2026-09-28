import type { ICON_CATALOG } from '@/shared/icons';
import type { MessageKey } from '@/shared/i18n';

export interface LauncherTileItem {
  id: string;
  label: MessageKey;
  icon: keyof typeof ICON_CATALOG;
  keywords: string[];
}

export const LAUNCHER_TILES: readonly LauncherTileItem[] = [
  { id: 'dictionary', label: 'launcher.tile.dictionary', icon: 'bookOpen', keywords: ['dict', 'lookup', 'word'] },
  { id: 'subtitles', label: 'launcher.tile.subtitles', icon: 'captions', keywords: ['sub', 'subtitle', 'caption'] },
  { id: 'reader', label: 'launcher.tile.reader', icon: 'bookOpen', keywords: ['reader', 'text', 'read'] },
  { id: 'local-player', label: 'settings.localPlayer.title', icon: 'folderOpen', keywords: ['video', 'player', 'local'] },
  { id: 'history', label: 'launcher.tile.history', icon: 'clock', keywords: ['history', 'recent', 'past'] },
  { id: 'settings', label: 'settings.title', icon: 'settings', keywords: ['settings', 'config', 'preferences'] },
  { id: 'help', label: 'launcher.tile.help', icon: 'info', keywords: ['help', 'support', 'guide'] },
] as const;
