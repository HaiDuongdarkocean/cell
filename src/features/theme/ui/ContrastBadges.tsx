// ContrastBadges — WCAG AA/AAA/Fail badges per contrast pair (spec F4).
//
// Click badge → tooltip ratio. validateTheme trả 3 pair.

import type { ValidationResult } from '@/features/theme/logic/contrastValidator';
import styles from './ContrastBadges.module.css';

interface ContrastBadgesProps {
  /** Validation result (3 pairs). */
  result: ValidationResult;
}

export function ContrastBadges({ result }: ContrastBadgesProps): React.JSX.Element {
  return (
    <div className={styles.badges} data-cell-id="contrast-badges">
      {result.pairs.map((pair) => (
        <span
          key={pair.label}
          className={`${styles.badge} ${pair.rating.level === 'AAA' ? styles.aaa : pair.rating.level === 'AA' ? styles.aa : styles.fail}`}
          title={`${pair.label}: ${pair.ratio.toFixed(2)}:1 (${pair.rating.level})`}
          data-cell-id={`contrast-badge-${pair.label}`}
        >
          {pair.label}: {pair.rating.level}
          <span className={styles.ratio}>{pair.ratio.toFixed(2)}:1</span>
        </span>
      ))}
    </div>
  );
}
