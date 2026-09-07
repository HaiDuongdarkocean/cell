import { useState, type ReactElement } from 'react';
import { Card, Heading, Text } from '@/shared/ui';
import { AudioPanel } from '@/features/audio/ui/AudioPanel';
import { DEFAULT_TTS_SETTINGS } from '@/features/tts/ui/TtsVoiceManagerPanel';
import { DEFAULT_PRONUNCIATION_SETTINGS } from '@/shared/config/config';
import type { PronunciationSettings, TtsSettings } from '@/entities/settings/types';
import styles from './mockup.module.css';

export function RealPanel(): ReactElement {
  const [pronunciation, setPronunciation] = useState<PronunciationSettings>(DEFAULT_PRONUNCIATION_SETTINGS);
  const [tts, setTts] = useState<TtsSettings>(DEFAULT_TTS_SETTINGS);

  return (
    <Card className={styles.maRealFrame}>
      <div className={styles.maRealHeader}>
        <Heading level={4} size={4}>Audio</Heading>
        <Text as="p" color="secondary">
          The production Audio card — the merged panel that shipped from the
          Concept H (pipeline) direction.
        </Text>
      </div>

      <AudioPanel
        pronunciation={pronunciation}
        tts={tts}
        onPronunciationChange={setPronunciation}
        onTtsChange={setTts}
      />
    </Card>
  );
}
