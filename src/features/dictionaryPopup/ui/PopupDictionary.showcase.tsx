import { useState, useRef, useEffect, type ReactElement } from 'react';
import { PopupDictionary } from './PopupDictionary';
import { Button } from '@/shared/ui/Button';
import type { PopupAnchor } from './usePopupPosition';
import type { LookupResult } from '@/features/dictionaryPopup/types';

const MOCK_RESULT: LookupResult = {
  term: 'serendipity',
  langCode: 'en',
  reading: '/ˌser.ənˈdɪp.ə.ti/',
  readingKind: 'ipa',
  frequency: { rank: 1234, source: 'wordfreq' },
  status: 'unknown',
  partsOfSpeech: ['noun'],
  definitions: [
    {
      id: '1',
      pos: 'noun',
      text: 'the occurrence of events by chance in a happy or beneficial way',
      examples: ['We found the restaurant by pure serendipity.'],
      source: 'cambridge',
      defaultSelected: true,
    },
    {
      id: '2',
      pos: 'noun',
      text: 'a fortunate accident',
      examples: [],
      source: 'wiktionary',
      defaultSelected: false,
    },
  ],
  rawDefinitions: [
    'the occurrence of events by chance in a happy or beneficial way',
    'a fortunate accident',
  ],
  detectedPhrase: null,
  matchSource: 'dictionary',
};

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
  level: 'atoms',
  category: 'Display',
  group: 'Features',
  order: 103,
};
