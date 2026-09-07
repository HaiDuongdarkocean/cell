import { useState, type ReactElement } from 'react';
import { CardCreatorDialog } from '@/features/cardCreator/ui/CardCreatorDialog';
import { CardCreatorBottomSheet } from '@/features/cardCreator/ui/CardCreatorBottomSheet';
import { Button } from '@/shared/ui/Button';
import { DEFAULT_CARD_CREATOR_SETTINGS } from '@/shared/config/config';
import type { CardCreatorOpenContext } from '@/features/cardCreator/types';
import { getMockCardCreatorQueue } from '../showcaseFixtures';
import styles from './CardCreatorDialogPage.module.css';

const MOCK_CONTEXT: CardCreatorOpenContext = {
  sourceLang: 'en',
  targetLang: 'vi',
  queue: getMockCardCreatorQueue(),
  prefill: {
    targetWord: 'serendipity',
    definitions: 'the occurrence of events by chance in a happy or beneficial way',
    sentence: 'We found the restaurant by pure serendipity.',
    sentenceTranslation: 'Chúng tôi tìm thấy nhà hàng một cách tình cờ may mắn.',
  },
};

export function Showcase(): ReactElement {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div className={styles.wrapper}>
      <div className={styles.controls}>
        <Button variant="primary" size="sm" onClick={() => setDialogOpen(true)}>
          Open Desktop Dialog
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setSheetOpen(true)}>
          Open Mobile Bottom Sheet
        </Button>
      </div>

      <div className={styles.pageFrame}>
        <div className={styles.pagePlaceholder}>
          <span>Web Page Content (behind dialog)</span>
        </div>
      </div>

      <CardCreatorDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        settings={DEFAULT_CARD_CREATOR_SETTINGS}
        openContext={MOCK_CONTEXT}
        initialAction="edit-card"
      />

      <CardCreatorBottomSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        settings={DEFAULT_CARD_CREATOR_SETTINGS}
        openContext={MOCK_CONTEXT}
        initialAction="edit-card"
      />
    </div>
  );
}

export const showcaseMeta = {
  title: 'Card Creator Dialog Page',
  description: 'Card Creator as standalone dialog (desktop: Dialog wrapper with overlay + focus trap) or bottom sheet (mobile: slide-up sheet with drag handle). Content: note type + deck selects, 10 field rows, media lists, preview block, queue sidebar, footer with Update mode + Add/Update.',
  level: 'pages' as const,
  category: 'Dialog',
  order: 25,
};
