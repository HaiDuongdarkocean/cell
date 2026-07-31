import type { ReactElement } from 'react';
import { SubtitleText } from './SubtitleText';

export function Showcase(): ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        background: '#000',
        padding: 16,
        borderRadius: 8,
        position: 'relative',
        minHeight: 120,
      }}
    >
      <SubtitleText backgroundOpacity={0.5}>
        This is a subtitle line over video.
      </SubtitleText>
      <SubtitleText backgroundOpacity={0.2}>
        Low opacity background subtitle.
      </SubtitleText>
      <SubtitleText backgroundOpacity={0.8} fontSize="var(--font-size-xl)">
        High opacity, larger font subtitle.
      </SubtitleText>
    </div>
  );
}

export const showcaseMeta = {
  title: 'SubtitleText',
  level: 'atoms',
  category: 'Content',
  group: 'Domain — Subtitle',
  order: 70,
};
