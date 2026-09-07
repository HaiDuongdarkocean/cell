import type { ShortcutAction } from '@/entities/settings';
import type { ShortcutValue } from '@/shared/ui/ShortcutInput';

/** Action groups mirror the shipped SettingsDialogContent grouping. */
export interface ShortcutGroup {
  readonly label: string;
  readonly actions: readonly ShortcutAction[];
}

export const SHORTCUT_GROUPS: readonly ShortcutGroup[] = [
  { label: 'Playback', actions: ['prev-cue', 'next-cue', 'replay-cue', 'play-pause'] },
  { label: 'Display', actions: ['toggle-overlay', 'toggle-panel', 'toggle-translate', 'toggle-player-mode'] },
  { label: 'Translation', actions: ['generate-native'] },
  { label: 'Flashcards', actions: ['quick-update', 'edit-card'] },
];

/** Human labels for every mappable action. */
export const SHORTCUT_LABELS: Record<ShortcutAction, string> = {
  'prev-cue': 'Previous sentence',
  'next-cue': 'Next sentence',
  'replay-cue': 'Replay sentence',
  'play-pause': 'Play/pause video',
  'toggle-overlay': 'Show/hide subtitles',
  'toggle-panel': 'Show/hide subtitle list',
  'toggle-translate': 'Auto-translate subtitles',
  'toggle-player-mode': 'Full-screen viewing mode',
  'generate-native': 'Translate to native language',
  'quick-update': 'Quick add words',
  'edit-card': 'Create card from sentence',
};

/** Map form used by the mockup concepts — easier to look up and mutate than an array. */
export type ShortcutMap = Record<ShortcutAction, ShortcutValue | null>;

/** Shipped defaults from config.ts. */
export const DEFAULT_SHORTCUTS: ShortcutMap = {
  'prev-cue': { key: 'a' },
  'next-cue': { key: 'd' },
  'replay-cue': { key: 's' },
  'play-pause': { key: ' ' },
  'toggle-overlay': { key: 'w' },
  'toggle-panel': { key: 't' },
  'toggle-translate': { key: 't', ctrl: true, shift: true },
  'toggle-player-mode': { key: 'g' },
  'generate-native': { key: 'h' },
  'quick-update': { key: 'q' },
  'edit-card': { key: 'e' },
};

/** Normalized signature for conflict comparison. */
export function shortcutSignature(value: ShortcutValue | null): string {
  if (!value || !value.key) return '';
  const parts = [];
  if (value.ctrl) parts.push('ctrl');
  if (value.shift) parts.push('shift');
  if (value.alt) parts.push('alt');
  parts.push(value.key);
  return parts.join('+');
}

/** Set or clear a shortcut for an action. */
export function setShortcut(map: ShortcutMap, action: ShortcutAction, value: ShortcutValue | null): ShortcutMap {
  return { ...map, [action]: value };
}

/** Build a set of duplicated signatures in the current map. */
export function buildConflictSet(map: ShortcutMap): Set<string> {
  const counts = new Map<string, number>();
  for (const value of Object.values(map)) {
    const sig = shortcutSignature(value);
    if (sig) counts.set(sig, (counts.get(sig) ?? 0) + 1);
  }
  const conflicts = new Set<string>();
  for (const [sig, count] of counts) {
    if (count > 1) conflicts.add(sig);
  }
  return conflicts;
}

/** Is this specific binding in conflict with another action? */
export function isConflict(map: ShortcutMap, action: ShortcutAction): boolean {
  const sig = shortcutSignature(map[action]);
  if (!sig) return false;
  let count = 0;
  for (const value of Object.values(map)) {
    if (shortcutSignature(value) === sig) count++;
  }
  return count > 1;
}

/** Readable display label for a single key. */
export function keyDisplayLabel(key: string): string {
  if (key === 'arrowleft') return '←';
  if (key === 'arrowright') return '→';
  if (key === 'arrowup') return '↑';
  if (key === 'arrowdown') return '↓';
  if (key === ' ') return '␣';
  if (key === 'backspace') return '⌫';
  if (key === 'enter') return '↵';
  if (key === 'escape') return 'Esc';
  return key.toUpperCase();
}

/** The QWERTY rows we render in the keyboard map. */
export const KEYBOARD_ROWS: readonly string[][] = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
];

/** All single keys that appear on the map. */
export const MAP_KEYS: readonly string[] = KEYBOARD_ROWS.flat();

/** Convert a map back to the array form used by the real panel. */
export function toShortcutArray(map: ShortcutMap): { action: ShortcutAction; key: string; ctrl?: boolean; shift?: boolean; alt?: boolean }[] {
  return Object.entries(map)
    .filter(([, value]) => value && value.key)
    .map(([action, value]) => ({ action: action as ShortcutAction, ...value! }));
}
