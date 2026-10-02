import type { ReactNode } from 'react';
import type { IconRenderProps } from './index';

const makeGlyph = (content: ReactNode) => {
  const Glyph = ({ size = 24, className, style, 'aria-hidden': ariaHidden }: IconRenderProps): React.JSX.Element => (
    <svg className={className} style={style} aria-hidden={ariaHidden ?? true} xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor">{content}</svg>
  );
  return Glyph;
};

export const RecPause = makeGlyph(
  <>
    <rect x="6.8" y="5" width="3.6" height="14" rx="1.6" />
    <rect x="13.6" y="5" width="3.6" height="14" rx="1.6" />
  </>,
);

export const RecPlay = makeGlyph(
  <path d="M8 5.4v13.2c0 1.1 1.2 1.8 2.2 1.2l10.2-6.6c.9-.6.9-1.9 0-2.5L10.2 4.1C9.2 3.6 8 4.3 8 5.4z" />,
);

export const RecStop = makeGlyph(
  <rect x="6.2" y="6.2" width="11.6" height="11.6" rx="2.8" />,
);

export const RecDiscard = makeGlyph(
  <path
    fillRule="evenodd"
    d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.84 8.56 12 10.72l2.16-2.16 1.28 1.28L13.28 12l2.16 2.16-1.28 1.28L12 13.28l-2.16 2.16-1.28-1.28L10.72 12 8.56 9.84z"
  />,
);
