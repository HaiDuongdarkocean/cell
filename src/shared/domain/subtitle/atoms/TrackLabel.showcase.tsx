import type { ReactElement } from 'react';
import { TrackLabel } from './TrackLabel';

export function Showcase(): ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <TrackLabel label="English" srclang="en" active={true} />
        <TrackLabel label="Spanish" srclang="es" active={false} />
        <TrackLabel label="Japanese" srclang="ja" active={false} />
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <TrackLabel label="French" srclang="fr" active={false} />
        <TrackLabel label="German" srclang="de" active={true} />
        <TrackLabel label="Vietnamese" srclang="vi" active={false} />
      </div>
    </div>
  );
}

export const showcaseMeta = {
  title: 'TrackLabel',
  level: 'atoms',
  category: 'Content',
  group: 'Domain — Subtitle',
  order: 74,
};
