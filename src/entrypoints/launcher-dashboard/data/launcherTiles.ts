import type { ICON_CATALOG } from '@/shared/icons';

export interface LauncherTileItem {
  id: string;
  label: string;
  icon: keyof typeof ICON_CATALOG;
  keywords: string[];
}

export const LAUNCHER_TILES: readonly LauncherTileItem[] = [
  { id: 'dictionary', label: 'Dictionary', icon: 'bookOpen', keywords: ['dict', 'lookup', 'word'] },
  { id: 'subtitles', label: 'Subtitle Manager', icon: 'captions', keywords: ['sub', 'subtitle', 'caption'] },
  { id: 'reader', label: 'Reader', icon: 'bookOpen', keywords: ['reader', 'text', 'read'] },
  { id: 'local-player', label: 'Local Player', icon: 'folderOpen', keywords: ['video', 'player', 'local'] },
  { id: 'history', label: 'History', icon: 'clock', keywords: ['history', 'recent', 'past'] },
  { id: 'settings', label: 'Settings', icon: 'settings', keywords: ['settings', 'config', 'preferences'] },
  { id: 'help', label: 'Help', icon: 'info', keywords: ['help', 'support', 'guide'] },
] as const;
