import { SettingsGroup } from '@/shared/ui/SettingsGroup';
import { SettingsRow } from '@/shared/ui/SettingsRow';
import { SettingsSection } from '@/shared/ui/SettingsSection';
import { ShortcutInput, type ShortcutValue } from '@/shared/ui/ShortcutInput';
import { Surface } from '@/shared/ui/Surface';
import { isShortcutConflict } from '@/entities/settings/lib/shortcutConflicts';
import { t } from '@/shared/i18n';
import type { KeyboardShortcut, ShortcutAction } from '@/entities/settings/types';
import { ACTION_LABEL_KEYS, GROUPS } from './mockData';

interface ShortcutsBlockProps {
  readonly shortcuts: readonly KeyboardShortcut[];
  readonly onRebind: (action: ShortcutAction, value: ShortcutValue) => void;
}

/**
 * Redesigned Shortcuts section — every group is its own card, every row pins
 * its ShortcutInput to a single right-edge rail, and the cards flow in a
 * 2-column masonry (1 column under ~880px content width).
 */
export function ShortcutsBlock({ shortcuts, onRebind }: ShortcutsBlockProps): React.JSX.Element {
  return (
    <SettingsSection
      title={t('settings.shortcuts.title')}
      description="Focus a pill and press a key to rebind. Conflicting bindings are marked."
    >
      <div className="scrMasonry">
        {GROUPS.map((group) => (
          <Surface
            key={group.labelKey}
            variant="card"
            className="scrCard"
            aria-label={t(group.labelKey)}
          >
            <SettingsGroup label={t(group.labelKey)} className="scrGroup">
              {group.actions.map((action) => {
                const binding = shortcuts.find((s) => s.action === action);
                const conflict = isShortcutConflict(shortcuts, action);
                const label = t(ACTION_LABEL_KEYS[action]);
                const inputId = `mock-shortcut-${action}`;
                return (
                  <SettingsRow
                    key={action}
                    dense
                    divider
                    title={label}
                    labelFor={inputId}
                    className="scrRow"
                  >
                    <span className="scrInputWrap">
                      <ShortcutInput
                        id={inputId}
                        data-tihoka-id={`shortcut-${action}`}
                        value={
                          binding
                            ? { key: binding.key, ctrl: binding.ctrl, shift: binding.shift, alt: binding.alt }
                            : { key: '' }
                        }
                        onChange={(value) => onRebind(action, value)}
                        aria-label={label}
                        aria-invalid={conflict || undefined}
                        aria-describedby={conflict ? `${inputId}-conflict` : undefined}
                      />
                      {conflict && (
                        <span
                          id={`${inputId}-conflict`}
                          className="scrConflictDot"
                          role="img"
                          aria-label={t('settings.shortcuts.conflict.aria')}
                          title={t('settings.shortcuts.conflict.title')}
                        />
                      )}
                    </span>
                  </SettingsRow>
                );
              })}
            </SettingsGroup>
          </Surface>
        ))}
      </div>
    </SettingsSection>
  );
}
