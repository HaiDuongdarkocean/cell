import { useCallback, useState, type KeyboardEvent, type ReactElement } from 'react';
import { Alert } from '@/shared/ui/Alert';
import { Box } from '@/shared/ui/Box';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Dialog } from '@/shared/ui/Dialog';
import { Heading } from '@/shared/ui/Heading';
import { HStack, VStack } from '@/shared/ui/Stack';
import { Label } from '@/shared/ui/Label';
import { Select } from '@/shared/ui/Select';
import { StatusDot } from '@/shared/ui/StatusDot';
import { Text } from '@/shared/ui/Text';
import { Icon } from '@/shared/icons/Icon';
import styles from './PatternVocabularyCapture.module.css';

const SENTENCE = ['The', 'quick', 'brown', 'error', 'jumps'];

const STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'learning', label: 'Learning' },
  { value: 'known', label: 'Known' },
];

const WORD_DEFINITIONS: Record<string, string> = {
  The: 'Definite article.',
  quick: 'Moving fast or doing something in a short time.',
  brown: 'A dark reddish-orange color.',
  fox: 'A small wild animal with a pointed face and bushy tail.',
  jumps: 'To push oneself off a surface into the air.',
};

const CAPTURE_DELAY_MS = 400;

type CaptureStatus = 'idle' | 'lookup' | 'lookup-error' | 'capturing' | 'success' | 'error';

interface CapturedWord {
  word: string;
  status: string;
  definition: string;
}

function dotStatus(status: string): 'success' | 'warning' | 'info' | 'neutral' {
  switch (status) {
    case 'known':
      return 'success';
    case 'learning':
      return 'warning';
    case 'new':
      return 'info';
    default:
      return 'neutral';
  }
}

export function Showcase(): ReactElement {
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState<CaptureStatus>('idle');
  const [wordStatus, setWordStatus] = useState('new');
  const [captured, setCaptured] = useState<CapturedWord[]>([]);

  const handleWordClick = useCallback((word: string): void => {
    setSelected(word);
    setWordStatus('new');
    if (word === 'error') {
      setStatus('lookup-error');
    } else {
      setStatus('lookup');
    }
  }, []);

  const handleKeyWord = useCallback(
    (e: KeyboardEvent<HTMLSpanElement>, word: string): void => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleWordClick(word);
      }
    },
    [handleWordClick],
  );

  const handleCapture = useCallback((): void => {
    if (!selected) return;
    if (selected === 'error') {
      setStatus('error');
      return;
    }
    setStatus('capturing');
    setTimeout(() => {
      setCaptured((prev) => [
        ...prev,
        { word: selected, status: wordStatus, definition: WORD_DEFINITIONS[selected] ?? '' },
      ]);
      setStatus('success');
      setSelected(null);
    }, CAPTURE_DELAY_MS);
  }, [selected, wordStatus]);

  const handleClose = useCallback((): void => {
    setSelected(null);
    setStatus('idle');
  }, []);

  const renderDialogContent = (): ReactElement => {
    if (status === 'lookup-error') {
      return (
        <Alert
          variant="error"
          title="Lookup failed"
          description="No definition found for this word."
          icon={<Icon name="alertCircle" size={20} />}
        />
      );
    }

    if (status === 'error') {
      return (
        <Alert
          variant="error"
          title="Capture failed"
          description="Could not save the word. Please try again."
          icon={<Icon name="alertCircle" size={20} />}
        />
      );
    }

    return (
      <VStack gap="4">
        <Text as="p">
          {selected ? WORD_DEFINITIONS[selected] : ''}
        </Text>
        <VStack gap="1">
          <Label htmlFor="word-status">Word status</Label>
          <Select
            id="word-status"
            value={wordStatus}
            onChange={setWordStatus}
            options={STATUS_OPTIONS}
            aria-label="Word status"
            menuAlign="left"
          />
        </VStack>
      </VStack>
    );
  };

  const renderFooter = (): ReactElement => {
    if (status === 'lookup-error') {
      return (
        <Button onClick={handleClose} variant="secondary">Close</Button>
      );
    }
    if (status === 'error') {
      return (
        <HStack gap="2">
          <Button onClick={handleCapture} leadingIcon={<Icon name="rotateCcw" size={16} />}>Retry</Button>
          <Button onClick={handleClose} variant="secondary">Close</Button>
        </HStack>
      );
    }
    return (
      <HStack gap="2">
        <Button onClick={handleCapture} loading={status === 'capturing'}>
          Capture
        </Button>
        <Button onClick={handleClose} variant="secondary">Cancel</Button>
      </HStack>
    );
  };

  return (
    <VStack gap="6" className={styles.root}>
      <header>
        <Heading level={2} size={3}>Pattern: Vocabulary capture</Heading>
        <Text as="p">
          Select a word from a subtitle, look it up, and capture it to your vocabulary list.
        </Text>
      </header>

      <Card className={styles.sentence}>
        <Text as="p" variant="body" data-cell-id="subtitle-sentence">
          {SENTENCE.map((word, index) => (
            <span key={`${word}-${index}`}>
              {index > 0 && ' '}
              <span
                role="button"
                tabIndex={0}
                className={styles.word}
                aria-label={`Look up ${word}`}
                onClick={() => handleWordClick(word)}
                onKeyDown={(e) => handleKeyWord(e, word)}
              >
                {word}
              </span>
            </span>
          ))}
        </Text>
      </Card>

      <section className={styles.list} aria-label="Captured vocabulary" aria-live="polite">
        {captured.length === 0 ? (
          <Box className={styles.empty}>
            <Text>No words captured yet. Select a word to start.</Text>
          </Box>
        ) : (
          <VStack gap="2" role="list" aria-label="Captured words">
            {captured.map((item, index) => (
              <Card key={`${item.word}-${index}`} role="listitem" aria-label={item.word} className={styles.wordCard}>
                <HStack gap="2" align="center">
                  <StatusDot status={dotStatus(item.status)} aria-label={item.status} />
                  <Text as="p" variant="label">{item.word}</Text>
                  <Text as="span">{item.status}</Text>
                </HStack>
                <Text as="p" variant="supporting">{item.definition}</Text>
              </Card>
            ))}
          </VStack>
        )}
      </section>

      <Dialog
        open={selected !== null}
        onOpenChange={(open) => { if (!open) handleClose(); }}
        title={selected ? selected : 'Word'}
        footer={renderFooter()}
        showCloseButton
      >
        {renderDialogContent()}
      </Dialog>
    </VStack>
  );
}

export const showcaseMeta = {
  title: 'Pattern: Vocabulary capture',
  description: 'Select a word, review definition, set status, and capture to vocabulary list using Dialog, Select, Badge, StatusDot, Alert.',
  level: 'pages' as const,
  category: 'Pattern',
  order: 14,
};
