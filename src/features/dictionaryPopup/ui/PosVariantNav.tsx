import { Fragment } from 'react';
import { t, type MessageKey } from '@/shared/i18n';
import type { PosVariant } from '@/entities/dictionary';
import styles from './PosVariantNav.module.css';

const POS_LABEL_KEYS: Record<string, MessageKey> = {
  adjective: 'dict.meta.pos.adjective',
  adverb: 'dict.meta.pos.adverb',
  noun: 'dict.meta.pos.noun',
  verb: 'dict.meta.pos.verb',
};

export function posVariantLabel(pos: string): string {
  if (!pos) return t('dict.variant.other');
  const key = POS_LABEL_KEYS[pos];
  return key ? t(key) : pos;
}

export interface PosVariantNavProps {
  readonly variants: readonly PosVariant[];
  readonly selectedIndex: number;
  readonly onSelect: (index: number) => void;
}

export function PosVariantNav({ variants, selectedIndex, onSelect }: PosVariantNavProps): React.JSX.Element {
  return (
    <nav className={styles.nav} aria-label={t('dict.variant.selector')} data-cell-id="dictionary-pos-nav">
      {variants.map((variant, i) => (
        <Fragment key={variant.pos || 'other'}>
          {i > 0 && <span className={styles.sep} aria-hidden="true">|</span>}
          <button
            type="button"
            className={`${styles.link} ${i === selectedIndex ? styles.linkActive : ''}`}
            aria-pressed={i === selectedIndex}
            aria-current={i === selectedIndex ? 'true' : undefined}
            onClick={() => onSelect(i)}
            data-cell-id={`dictionary-pos-${variant.pos || 'other'}`}
            data-compact-hit
          >
            {posVariantLabel(variant.pos)}
          </button>
        </Fragment>
      ))}
    </nav>
  );
}
