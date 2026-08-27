import { useCallback, useEffect, useState, type KeyboardEvent, type ReactElement } from 'react';
import { Alert } from '@/shared/ui/Alert';
import { Box } from '@/shared/ui/Box';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Heading } from '@/shared/ui/Heading';
import { HStack, VStack } from '@/shared/ui/Stack';
import { InputField } from '@/shared/ui/InputField';
import { Spinner } from '@/shared/ui/Spinner';
import { StatusDot } from '@/shared/ui/StatusDot';
import { Text } from '@/shared/ui/Text';
import { Icon } from '@/shared/icons/Icon';
import styles from './PatternSubtitleAcquisition.module.css';

const DETECT_DELAY_MS = 500;
const ACQUIRE_DELAY_MS = 500;

type AcquisitionStatus = 'idle' | 'detecting' | 'candidates' | 'empty' | 'error' | 'acquiring' | 'success';

interface Candidate {
  id: string;
  label: string;
  language: string;
}

const MOCK_CANDIDATES: Candidate[] = [
  { id: '1', label: 'English', language: 'en' },
  { id: '2', label: 'Japanese', language: 'ja' },
  { id: '3', label: 'Vietnamese', language: 'vi' },
];

export function Showcase(): ReactElement {
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [status, setStatus] = useState<AcquisitionStatus>('idle');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [acquired, setAcquired] = useState<Candidate | null>(null);

  useEffect(() => {
    if (url.trim()) setError(undefined);
  }, [url]);

  const handleDetect = useCallback((): void => {
    if (!url.trim()) {
      setError('Video URL is required');
      return;
    }

    setError(undefined);
    setStatus('detecting');
    setAcquired(null);
    setCandidates([]);

    setTimeout(() => {
      const lower = url.toLowerCase();
      if (lower.includes('error')) {
        setStatus('error');
      } else if (lower.includes('empty')) {
        setStatus('empty');
      } else {
        setCandidates(MOCK_CANDIDATES);
        setStatus('candidates');
      }
    }, DETECT_DELAY_MS);
  }, [url]);

  const handleSelect = useCallback((candidate: Candidate): void => {
    setAcquired(candidate);
    setStatus('acquiring');
    setTimeout(() => {
      setStatus('success');
    }, ACQUIRE_DELAY_MS);
  }, []);

  const handleKeySelect = useCallback(
    (e: KeyboardEvent<HTMLDivElement>, candidate: Candidate): void => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleSelect(candidate);
      }
    },
    [handleSelect],
  );

  const renderContent = (): ReactElement | null => {
    switch (status) {
      case 'idle':
        return (
          <Box className={styles.centered}>
            <Text color="secondary">Paste a video URL and click Detect to find subtitles.</Text>
          </Box>
        );
      case 'detecting':
        return (
          <VStack gap="2" className={styles.centered}>
            <Spinner ariaLabel="Detecting subtitles" />
            <Text>Detecting subtitles…</Text>
          </VStack>
        );
      case 'empty':
        return (
          <Box className={styles.centered}>
            <EmptyState
              icon={<Icon name="search" size={48} />}
              title="No subtitles found"
              description="No subtitle candidates were detected for this URL."
              action={<Button onClick={() => setStatus('idle')} size="sm">Try another URL</Button>}
            />
          </Box>
        );
      case 'error':
        return (
          <Box className={styles.padded}>
            <Alert
              variant="error"
              title="Detection failed"
              description="Could not detect subtitle candidates. Check the URL and try again."
              icon={<Icon name="alertCircle" size={20} />}
            />
            <HStack gap="2" className={styles.retry}>
              <Button onClick={handleDetect} leadingIcon={<Icon name="rotateCcw" size={16} />}>
                Retry
              </Button>
            </HStack>
          </Box>
        );
      case 'candidates':
      case 'acquiring':
        return (
          <VStack gap="4" className={styles.padded}>
            <Text as="p" color="secondary">{candidates.length} subtitle candidates found</Text>
            <VStack
              gap="2"
              role="listbox"
              aria-label="Subtitle candidates"
              aria-busy={status === 'acquiring'}
            >
              {candidates.map((candidate) => (
                <Card
                  key={candidate.id}
                  role="option"
                  aria-selected={acquired?.id === candidate.id}
                  tabIndex={0}
                  variant={status === 'acquiring' && acquired?.id === candidate.id ? 'selected' : 'interactive'}
                  className={styles.candidate}
                  onClick={() => { if (status !== 'acquiring') handleSelect(candidate); }}
                  onKeyDown={(e) => handleKeySelect(e, candidate)}
                  data-cell-id={`candidate-${candidate.id}`}
                >
                  <HStack gap="3" align="center" className={styles.candidateRow}>
                    <StatusDot
                      status={acquired?.id === candidate.id ? 'success' : 'info'}
                      aria-label={acquired?.id === candidate.id ? 'Downloaded' : 'Available'}
                      pulse={status === 'acquiring' && acquired?.id === candidate.id}
                    />
                    <VStack gap="0">
                      <Text as="p" variant="label">{candidate.label}</Text>
                      <Text as="p" variant="supporting" color="secondary">{candidate.language}</Text>
                    </VStack>
                  </HStack>
                </Card>
              ))}
            </VStack>
            {status === 'acquiring' && (
              <HStack gap="2" align="center">
                <Spinner size="sm" ariaLabel="Acquiring" />
                <Text>Acquiring {acquired?.label}…</Text>
              </HStack>
            )}
          </VStack>
        );
      case 'success':
        if (!acquired) return null;
        return (
          <VStack gap="4" className={styles.padded}>
            <Alert
              variant="success"
              title="Subtitle acquired"
              description={`${acquired.label} subtitle is ready.`}
              icon={<Icon name="check" size={20} />}
              role="status"
            />
            <Card className={styles.result}>
              <HStack gap="2" align="center">
                <StatusDot status="success" aria-label="Downloaded" />
                <Text as="p" variant="label">{acquired.label}</Text>
                <Text as="p" color="secondary">{acquired.language}</Text>
              </HStack>
            </Card>
            <Button onClick={() => { setUrl(''); setStatus('idle'); setAcquired(null); }} variant="secondary">
              Acquire another
            </Button>
          </VStack>
        );
      default:
        return null;
    }
  };

  return (
    <VStack gap="6" className={styles.root}>
      <header>
        <Heading level={2} size={3}>Pattern: Subtitle acquisition</Heading>
        <Text color="secondary" as="p">
          Detect, list, and acquire subtitle candidates from a video source.
        </Text>
      </header>

      <VStack gap="2" className={styles.detectRow}>
        <InputField
          id="video-url"
          label="Video URL"
          placeholder="https://example.com/video"
          value={url}
          onChange={(e) => setUrl(e.currentTarget.value)}
          error={error}
          onKeyDown={(e) => { if (e.key === 'Enter') handleDetect(); }}
          className={styles.urlInput}
        />
        <Button onClick={handleDetect} leadingIcon={<Icon name="search" size={16} />} disabled={status === 'detecting'}>
          Detect
        </Button>
      </VStack>

      <section className={styles.stage} aria-label="Subtitle acquisition result">
        {renderContent()}
      </section>
    </VStack>
  );
}

export const showcaseMeta = {
  title: 'Pattern: Subtitle acquisition',
  description: 'Subtitle detection, candidate list, and acquisition flow composed from InputField, Button, Card, EmptyState, Alert, Spinner, StatusDot.',
  level: 'pages' as const,
  category: 'Pattern',
  order: 13,
};
