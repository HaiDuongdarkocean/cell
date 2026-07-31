import { useState } from 'react';
import type { ReactElement } from 'react';
import { CaptionToggle } from './CaptionToggle';

export function Showcase(): ReactElement {
  const [enabled, setEnabled] = useState(true);
  const [disabled, setDisabled] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <CaptionToggle
          enabled={enabled}
          onChange={setEnabled}
          trackLabel="English"
        />
        <span>Captions: English — {enabled ? 'On' : 'Off'}</span>
      </div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <CaptionToggle
          enabled={false}
          onChange={() => {}}
          trackLabel="Spanish"
        />
        <span>Captions: Spanish — Off</span>
      </div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <CaptionToggle
          enabled={disabled}
          onChange={setDisabled}
          trackLabel="French"
          disabled
        />
        <span>Captions: French — Disabled</span>
      </div>
    </div>
  );
}

export const showcaseMeta = {
  title: 'CaptionToggle',
  level: 'atoms',
  category: 'Content',
  group: 'Domain — Subtitle',
  order: 71,
};
