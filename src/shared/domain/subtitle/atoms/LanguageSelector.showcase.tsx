import { useState } from 'react';
import type { ReactElement } from 'react';
import { LanguageSelector } from './LanguageSelector';

const showcaseLanguages = [
  { srclang: 'en', label: 'English' },
  { srclang: 'es', label: 'Spanish' },
  { srclang: 'ja', label: 'Japanese' },
  { srclang: 'fr', label: 'French' },
  { srclang: 'de', label: 'German' },
  { srclang: 'vi', label: 'Vietnamese' },
];

export function Showcase(): ReactElement {
  const [value, setValue] = useState('en');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <LanguageSelector
          languages={showcaseLanguages}
          value={value}
          onChange={setValue}
        />
        <span>Selected: {value}</span>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <LanguageSelector
          languages={showcaseLanguages}
          value="en"
          onChange={() => {}}
          disabled
        />
        <span>Disabled</span>
      </div>
    </div>
  );
}

export const showcaseMeta = {
  title: 'LanguageSelector',
  group: 'Domain — Subtitle',
  order: 72,
};
