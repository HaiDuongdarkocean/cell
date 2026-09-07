import { useState, useRef, useEffect, type ReactElement } from 'react';
import { PopupDictionary } from '@/features/dictionaryPopup/ui/PopupDictionary';
import { OrbitalBadge } from '@/features/dictionaryPopup/ui/OrbitalBadge';
import { Button } from '@/shared/ui/Button';
import type { PopupAnchor } from '@/features/dictionaryPopup/ui/usePopupPosition';
import { installMockDictionarySendMessage } from '../mockDictionary';
import { getMockLookupResult } from '../mockDictionary';
import styles from './DictionaryPopupPage.module.css';

installMockDictionarySendMessage();

const MOCK_RESULT = getMockLookupResult(undefined, 'serendipity');

export function Showcase(): ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const markerRef = useRef<HTMLDivElement | null>(null);
  const [anchor, setAnchor] = useState<PopupAnchor | null>(null);

  useEffect(() => {
    if (!markerRef.current) return;
    const rect = markerRef.current.getBoundingClientRect();
    const wrapperRect = markerRef.current.closest(`.${styles.wrapper}`)?.getBoundingClientRect();
    if (!wrapperRect) return;
    setAnchor({
      top: rect.top - wrapperRect.top,
      left: rect.left - wrapperRect.left,
      right: rect.right - wrapperRect.left,
      bottom: rect.bottom - wrapperRect.top,
    });
  }, []);

  return (
    <div className={styles.wrapper}>
      <div className={styles.pageFrame}>
        <div className={styles.pageContent}>
          <p className={styles.paragraph}>
            Select any word on the page to look it up. Try clicking{' '}
            <span ref={markerRef} className={styles.highlight}>serendipity</span>{' '}
            — a fortunate accident. The orbital badge floats on the right edge.
          </p>
          {!isOpen && (
            <Button onClick={() => setIsOpen(true)} size="sm">Open Dictionary Popup</Button>
          )}
        </div>

        <OrbitalBadge
          persistPosition={false}
          onClick={() => setIsOpen(true)}
        />

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
            onSendToCard={() => {}}
            onQuickAdd={() => {}}
          />
        )}
      </div>
    </div>
  );
}

export const showcaseMeta = {
  title: 'Dictionary Popup Page',
  description: 'In-page dictionary popup: OrbitalBadge (draggable floating badge) + PopupDictionary (popup window with DictionaryToolbar, DictionaryPanelView with Audio/Image/Links/Translate tabs, resize + drag positioning). Triggered by text selection or badge click.',
  level: 'pages' as const,
  category: 'Overlay',
  order: 15,
};
