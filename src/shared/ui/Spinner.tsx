import type { SVGAttributes } from 'react';
import styles from './Spinner.module.css';

type SpinnerSize = 'sm' | 'md' | 'lg';
type SpinnerColor = 'primary' | 'secondary' | 'accent' | 'on-accent' | 'current';

export interface SpinnerProps extends Omit<SVGAttributes<SVGSVGElement>, 'size' | 'ref'> {
  /** Size. Default: md. */
  size?: SpinnerSize;
  /** Color token. Default: primary. */
  color?: SpinnerColor;
}

/**
 * Spinner — animated loading indicator.
 */
export function Spinner({ size = 'md', color = 'primary', className, ...rest }: SpinnerProps): React.JSX.Element {
  const cls = [styles.spinner, styles[size], styles[color], className ?? ''].filter(Boolean).join(' ');

  return (
    // FIXME: extract to registry once stroke-width variant supported — Spinner is an SVG primitive with SVGAttributes passthrough and CSS animation; Icon span wrapper would break the API
    <svg
      className={cls}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
