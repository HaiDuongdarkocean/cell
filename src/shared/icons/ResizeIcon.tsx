import type { IconRenderProps } from './index';

export function ResizeIcon({
  size = 24,
  className,
  style,
  'aria-hidden': ariaHidden,
}: IconRenderProps): React.JSX.Element {
  const s = typeof size === 'number' ? size : 24;
  return (
    <svg
      className={className}
      style={style}
      aria-hidden={ariaHidden ?? true}
      xmlns="http://www.w3.org/2000/svg"
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 6 6 21" />
      <path d="M21 11 11 21" />
      <path d="M21 16 16 21" />
    </svg>
  );
}
