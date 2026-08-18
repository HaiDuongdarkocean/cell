import { useState } from 'react';
import { SubtitleManagerFooter } from './SubtitleManagerFooter';
import type { ReactElement } from 'react';

export function Showcase(): ReactElement {
  const [bothHidden, setBothHidden] = useState(false);
  const [generateDisabled, setGenerateDisabled] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 480 }}>
      <div>
        <h3 style={{ fontSize: 12, color: '#737373', marginBottom: 8 }}>Full footer — all 4 slots</h3>
        <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-card)', overflow: 'hidden', border: '1px solid var(--color-border-subtle)' }}>
          <div style={{ padding: 48, fontSize: 12, color: '#737373', textAlign: 'center' }}>
            Track list + offset stepper (placeholder)
          </div>
          <SubtitleManagerFooter
            onSearch={() => console.log('search')}
            onCustomize={() => console.log('customize')}
            onHideBoth={() => setBothHidden((v) => !v)}
            bothHidden={bothHidden}
            onGenerateNative={() => console.log('generate')}
            generateNativeDisabled={generateDisabled}
          />
        </div>
      </div>

      <div>
        <h3 style={{ fontSize: 12, color: '#737373', marginBottom: 8 }}>Minimal — Search + Generate only</h3>
        <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-card)', overflow: 'hidden', border: '1px solid var(--color-border-subtle)' }}>
          <div style={{ padding: 24, fontSize: 12, color: '#737373', textAlign: 'center' }}>
            Minimal footer (2 slots)
          </div>
          <SubtitleManagerFooter
            onSearch={() => console.log('search')}
            onGenerateNative={() => console.log('generate')}
            generateNativeDisabled={false}
          />
        </div>
      </div>

      <div>
        <h3 style={{ fontSize: 12, color: '#737373', marginBottom: 8 }}>Toggle states — click Hide to toggle</h3>
        <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-card)', overflow: 'hidden', border: '1px solid var(--color-border-subtle)' }}>
          <div style={{ padding: 24, fontSize: 12, color: '#737373', textAlign: 'center' }}>
            bothHidden = {String(bothHidden)}
          </div>
          <SubtitleManagerFooter
            onSearch={() => {}}
            onCustomize={() => {}}
            onHideBoth={() => setBothHidden((v) => !v)}
            bothHidden={bothHidden}
            onGenerateNative={() => setGenerateDisabled((v) => !v)}
            generateNativeDisabled={generateDisabled}
          />
        </div>
      </div>
    </div>
  );
}

export const showcaseMeta = {
  title: 'SubtitleManagerFooter',
  description: 'Footer organism for SubtitleManagerPanel — 4 Button atoms (vertical orientation, ZaloPay pattern). Slots: Search, Customize, Hide (toggle), Generate (primarySubtle). Reusable template for other panel footers.',
  level: 'organisms',
  category: 'Layout',
  group: 'Subtitle — Layout',
  order: 20,
};
