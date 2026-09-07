import type { KeyboardShortcut, ShortcutAction } from '@/entities/settings/types';

export type ShortcutBinding = Pick<KeyboardShortcut, 'key' | 'ctrl' | 'shift' | 'alt'>;

export function shortcutSignature(value: ShortcutBinding | null | undefined): string {
  if (!value || !value.key) return '';
  const parts: string[] = [];
  if (value.ctrl) parts.push('ctrl');
  if (value.shift) parts.push('shift');
  if (value.alt) parts.push('alt');
  parts.push(value.key);
  return parts.join('+');
}

export function isShortcutConflict(
  shortcuts: readonly KeyboardShortcut[],
  action: ShortcutAction,
): boolean {
  const current = shortcuts.find((s) => s.action === action);
  if (!current) return false;
  const sig = shortcutSignature(current);
  if (!sig) return false;
  return shortcuts.some(
    (s) => s.action !== action && shortcutSignature(s) === sig,
  );
}
