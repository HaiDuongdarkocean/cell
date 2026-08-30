import type { CSSProperties } from 'react';
import { ICON_CATALOG } from './index';

/**
 * Icon — thin wrapper that renders the catalog's React component.
 *
 * The catalog holds both the React component (for TSX) and the raw SVG string
 * (for non-React DOM). This component uses the React component.
 */
export function Icon({
  name,
  size,
  className,
  style,
}: {
  name: keyof typeof ICON_CATALOG;
  size?: number | string;
  className?: string;
  style?: CSSProperties;
}): React.JSX.Element {
  const entry = ICON_CATALOG[name];
  const IconComponent = entry.component;
  return <IconComponent aria-hidden={true} className={className} size={size} style={style} />;
}
