import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/shared/ui';
import {
  createTtsEngine,
  type TtsEngine,
} from '@/features/dictionaryPopup/services/ttsEngineService';
import { tokenizeTextBlock } from '@/features/tokenize/logic/textTokenizer';
import { getSentenceText } from '@/features/reader/logic/sentenceText';
import styles from './TtsControlBar.module.css';

export interface TtsControlBarProps {
  readonly paragraph: string;
  readonly sentenceIndex: number;
  readonly langCode: string;
}

export function TtsControlBar({
  paragraph,
  sentenceIndex,
  langCode,
}: TtsControlBarProps): React.JSX.Element {
  const [currentIndex, setCurrentIndex] = useState(sentenceIndex);
  const [isPlaying, setIsPlaying] = useState(false);
  const [engine, setEngine] = useState<TtsEngine | null>(null);

  useEffect(() => {
    try {
      setEngine(createTtsEngine());
    } catch {
      setEngine(null);
    }
  }, []);

  useEffect(() => {
    setCurrentIndex(sentenceIndex);
  }, [sentenceIndex]);

  const tokens = useMemo(() => tokenizeTextBlock(paragraph, langCode), [paragraph, langCode]);
  const maxSentence = useMemo(
    () => tokens.reduce((max, token) => Math.max(max, token.sentenceIndex), 0),
    [tokens],
  );

  const sentenceText = useMemo(
    () => getSentenceText(tokens, paragraph, currentIndex),
    [tokens, paragraph, currentIndex],
  );

  const speak = useCallback(
    async (text: string) => {
      if (!engine) return;
      setIsPlaying(true);
      try {
        await engine.speak(text, { langCode });
      } catch {
        // TTS errors are non-fatal; just stop the UI spinner.
      } finally {
        setIsPlaying(false);
      }
    },
    [engine, langCode],
  );

  const handlePlay = useCallback(() => {
    if (isPlaying) {
      engine?.stop();
      setIsPlaying(false);
    } else {
      void speak(sentenceText);
    }
  }, [engine, isPlaying, sentenceText, speak]);

  const handlePrev = useCallback(() => {
    if (currentIndex <= 0) return;
    const next = currentIndex - 1;
    setCurrentIndex(next);
    engine?.stop();
    setIsPlaying(false);
    void speak(getSentenceText(tokens, paragraph, next));
  }, [currentIndex, engine, tokens, paragraph, speak]);

  const handleNext = useCallback(() => {
    if (currentIndex >= maxSentence) return;
    const next = currentIndex + 1;
    setCurrentIndex(next);
    engine?.stop();
    setIsPlaying(false);
    void speak(getSentenceText(tokens, paragraph, next));
  }, [currentIndex, maxSentence, engine, tokens, paragraph, speak]);

  const handleRepeat = useCallback(() => {
    engine?.stop();
    setIsPlaying(false);
    void speak(sentenceText);
  }, [engine, sentenceText, speak]);

  return (
    <div className={styles.bar}>
      <Button
        variant="primary"
        size="sm"
        onClick={handlePlay}
        disabled={!engine}
      >
        {isPlaying ? 'Stop' : 'Play'}
      </Button>
      <Button variant="outline" size="sm" onClick={handlePrev} disabled={currentIndex <= 0}>
        Prev
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleNext}
        disabled={currentIndex >= maxSentence}
      >
        Next
      </Button>
      <Button variant="outline" size="sm" onClick={handleRepeat} disabled={!engine}>
        Repeat
      </Button>
      <span className={styles.sentence}>{sentenceText}</span>
    </div>
  );
}
