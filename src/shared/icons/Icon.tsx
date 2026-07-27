import type { CSSProperties } from 'react';
import { ICON_CATALOG } from './index';
import styles from './Icon.module.css';

/**
 * Icon — renders an SVG from the ICON_CATALOG registry via innerHTML.
 *
 * The catalog SVGs are raw markup strings (Lucide convention: 24×24, stroke 2,
 * currentColor). This wrapper injects the string into a span so components can
 * use `<Icon name="play" />` instead of inlining `<svg>…</svg>`.
 *
 * The wrapper forces the inner `<svg>` to fill the span (`width/height: 100%`),
 * so CSS classes that previously set `width`/`height` on the `<svg>` element
 * continue to control the rendered size when applied to the span via
 * `className`.
 *
 * For icons that need a different stroke-width, custom path, or attributes the
 * registry doesn't support, keep the inline SVG in the component and add a
 * `// FIXME: extract to registry once … supported` comment.
 */
export function Icon({
  name,
  size,
  className,
  style,
}: {
  name: keyof typeof ICON_CATALOG;
  size?: number;
  className?: string;
  style?: CSSProperties;
}): React.JSX.Element {
  const entry = ICON_CATALOG[name];
  return (
    <span
      aria-hidden="true"
      className={[styles.wrap, className].filter(Boolean).join(' ')}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, ...style }}
      dangerouslySetInnerHTML={{ __html: entry.svg }}
    />
  );
}
