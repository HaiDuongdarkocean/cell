import { Icon } from '@/shared/ui/Icon';
import { t } from '@/shared/i18n';
import type { ComprehensionKind } from '@/entities/comprehension';
import type { ComprehensionState } from '@/features/tokenize/services/comprehensionStore';
import { ComprehensionBadge } from './ComprehensionBadge';
import styles from './ComprehensionPill.module.css';

const KIND_ICON: Record<ComprehensionKind, 'video' | 'bookOpen'> = {
  media: 'video',
  text: 'bookOpen',
};

const KINDS: readonly ComprehensionKind[] = ['media', 'text'];

export interface ComprehensionPillProps {
  state: ComprehensionState;
  onSelect?: (kind: ComprehensionKind) => void;
}

export function ComprehensionPill({ state, onSelect }: ComprehensionPillProps): React.JSX.Element | null {
  const shown = state[state.active] ?? state.media ?? state.text;
  if (!shown) return null;
  const both = Boolean(state.media && state.text);

  return (
    <div className={styles.pill} role="group" aria-label={t('comprehension.aria')} data-tihoka-id="comprehension-pill">
      {both ? (
        <span className={styles.toggle} role="radiogroup" aria-label={t('comprehension.toggle')}>
          {KINDS.map((kind) => (
            <button
              key={kind}
              type="button"
              role="radio"
              aria-checked={shown.kind === kind}
              data-active={shown.kind === kind ? 'true' : 'false'}
              className={styles.toggleButton}
              title={t(`comprehension.kind.${kind}`)}
              onClick={() => onSelect?.(kind)}
            >
              <Icon name={KIND_ICON[kind]} size="xs" />
            </button>
          ))}
        </span>
      ) : (
        <Icon
          name={KIND_ICON[shown.kind]}
          size="xs"
          label={t(`comprehension.kind.${shown.kind}`)}
        />
      )}
      <ComprehensionBadge stats={shown} />
    </div>
  );
}
