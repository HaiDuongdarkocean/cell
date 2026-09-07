import { useState, useRef, useEffect, type ReactElement } from 'react';
import { PopupDictionary } from './PopupDictionary';
import { Button } from '@/shared/ui/Button';
import type { PopupAnchor } from './usePopupPosition';
import { getMockLookupResult } from '@/entrypoints/design-system-showcase/mockDictionary';

const MOCK_RESULT = getMockLookupResult(undefined, 'serendipity');

export function Showcase(): ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const markerRef = useRef<HTMLDivElement | null>(null);
  const [anchor, setAnchor] = useState<PopupAnchor | null>(null);

  useEffect(() => {
    if (!markerRef.current) return;
    const rect = markerRef.current.getBoundingClientRect();
    setAnchor({
      top: rect.top,
      left: rect.left,
      right: rect.right,
      bottom: rect.bottom,
    });
  }, []);

  return (
    <div style={{ position: 'relative', minHeight: 120 }}>
      {!isOpen && (
        <Button onClick={() => setIsOpen(true)}>Open Popup Dictionary</Button>
      )}
      <span
        ref={markerRef}
        style={{
          display: 'inline-block',
          padding: 'var(--space-1) var(--space-2)',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--color-primary-subtle)',
          color: 'var(--color-primary)',
          fontWeight: 'var(--font-weight-medium)',
        }}
      >
        serendipity
      </span>
      {isOpen && anchor && (
        <PopupDictionary
          langCode="en"
          sourceLang="en"
          targetLang="vi"
          anchor={anchor}
          initialTerm="serendipity"
          initialSize={{ width: 420, maxHeight: 360 }}
          initialResult={MOCK_RESULT}
          onClose={() => setIsOpen(false)}
          onSendToCard={(prefill) => { console.log('[PopupDictionary] Send to Card:', prefill.term); }}
          onQuickAdd={(prefill) => { console.log('[PopupDictionary] Quick Add:', prefill.term); }}
        />
      )}
    </div>
  );
}

export const showcaseMeta = {
  title: 'PopupDictionary',
  level: 'organisms',
  category: 'Display',
  group: 'Features',
  order: 103,
};
