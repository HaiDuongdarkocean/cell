import type { HTMLAttributes } from 'react';
import styles from './Timestamp.module.css';

type TimestampFormat = 'relative' | 'absolute' | 'time' | 'datetime';

export interface TimestampProps extends HTMLAttributes<HTMLTimeElement> {
  /** Date value — Date object, epoch ms, or ISO string. */
  value: Date | number | string;
  /** Display format. Default: relative. */
  format?: TimestampFormat;
}

/** Convert input to a Date object. */
function toDate(value: Date | number | string): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);
  return new Date(value);
}

/** Format an ISO string for the `datetime` attribute. */
function toISO(value: Date | number | string): string {
  return toDate(value).toISOString();
}

const RELATIVE_UNITS: ReadonlyArray<{ limit: number; unit: Intl.RelativeTimeFormatUnit; divisor: number }> = [
  { limit: 60, unit: 'second', divisor: 1 },
  { limit: 3600, unit: 'minute', divisor: 60 },
  { limit: 86400, unit: 'hour', divisor: 3600 },
  { limit: 2592000, unit: 'day', divisor: 86400 },
  { limit: 31536000, unit: 'month', divisor: 2592000 },
  { limit: Infinity, unit: 'year', divisor: 31536000 },
];

/**
 * Format a timestamp for display — pure function, no side effects.
 * Uses Intl APIs for locale-aware formatting.
 */
export function formatTimestamp(
  value: Date | number | string,
  format: TimestampFormat = 'relative',
  locale: string = 'en',
): string {
  const date = toDate(value);

  switch (format) {
    case 'datetime':
      return date.toLocaleString(locale);
    case 'time':
      return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    case 'absolute':
      return date.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
    case 'relative': {
      const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
      const diffSec = (date.getTime() - Date.now()) / 1000;
      for (const { limit, unit, divisor } of RELATIVE_UNITS) {
        if (Math.abs(diffSec) < limit) {
          return rtf.format(Math.round(diffSec / divisor), unit);
        }
      }
      return rtf.format(Math.round(diffSec / 31536000), 'year');
    }
  }
}

/**
 * Timestamp — semantic `<time>` element with locale-aware formatting.
 * `datetime` attribute always set to the ISO string for machine readability.
 */
export function Timestamp({
  value,
  format = 'relative',
  className,
  ...rest
}: TimestampProps): React.JSX.Element {
  const cls = [styles.timestamp, styles[format], className ?? ''].filter(Boolean).join(' ');
  const display = formatTimestamp(value, format);
  const datetime = toISO(value);

  return (
    <time className={cls} dateTime={datetime} {...rest}>
      {display}
    </time>
  );
}
