import { useState, type ReactElement } from 'react';
import { TtsVoiceManagerPanel, DEFAULT_TTS_SETTINGS } from '@/features/tts/ui/TtsVoiceManagerPanel';
import type { TtsSettings } from '@/entities/settings/types';
import styles from './TtsVoiceManagerPanel.showcase.module.css';

export function Showcase(): ReactElement {
  const [ttsSettings, setTtsSettings] = useState<TtsSettings>(DEFAULT_TTS_SETTINGS);

  return (
    <div className={styles.wrapper}>
      <div className={styles.panelFrame}>
        <TtsVoiceManagerPanel
          settings={ttsSettings}
          onSave={setTtsSettings}
        />
      </div>
    </div>
  );
}

export const showcaseMeta = {
  title: 'TTS Voice Manager Panel',
  description: 'Text-to-Speech voice management: Card 1 (enable toggle, max display, 3-slot voice selection with play, autoplay), Card 2 (tester with sentence input, country filter, drag-drop reorder, checkbox select, play all, save voice list).',
  level: 'organisms' as const,
  category: 'TTS',
  order: 20,
};
