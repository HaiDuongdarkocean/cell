import type { ReactElement, CSSProperties } from 'react';
import styles from './SubtitleText.module.css';

export interface SubtitleTextProps {
  /** Subtitle text content to display over the video. */
  children: string;
  /** Background opacity behind text (0–1). Default: 0.5. */
  backgroundOpacity?: number;
  /** Font size token override. Default: var(--font-size-lg). */
  fontSize?: string;
  /** Optional HTML id. */
  id?: string;
  /** Optional data-cell-id for testing. */
  dataTestId?: string;
  /** Optional extra class name. */
  className?: string;
}

/**
 * SubtitleText — displays subtitle text absolutely positioned over a video
 * element. Uses text-shadow for readability against any background and a
 * semi-transparent backdrop controlled by `backgroundOpacity`.
 */
export function SubtitleText({
  children,
  backgroundOpacity = 0.5,
  fontSize,
  id,
  dataTestId,
  className,
}: SubtitleTextProps): ReactElement {
  const styleVars = {
    '--subtitle-bg-opacity': backgroundOpacity,
    ...(fontSize ? { '--subtitle-font-size': fontSize } : {}),
  } as CSSProperties;

  const cls = [styles.subtitleText, className ?? ''].filter(Boolean).join(' ');

  return (
    <span
      id={id}
      data-cell-id={dataTestId}
      className={cls}
      style={styleVars}
      role="text"
    >
      {children}
    </span>
  );
}
