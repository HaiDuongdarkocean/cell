import { useState, type ReactElement } from 'react';
import { Alert } from '@/shared/ui/Alert';
import { Box } from '@/shared/ui/Box';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Heading } from '@/shared/ui/Heading';
import { HStack, VStack } from '@/shared/ui/Stack';
import { Skeleton } from '@/shared/ui/Skeleton';
import { Spinner } from '@/shared/ui/Spinner';
import { StatusDot } from '@/shared/ui/StatusDot';
import { Text } from '@/shared/ui/Text';
import { Icon } from '@/shared/icons/Icon';
import styles from './PatternAsyncStates.module.css';

type AsyncState = 'idle' | 'loading' | 'empty' | 'error' | 'success';

export function Showcase(): ReactElement {
  const [state, setState] = useState<AsyncState>('idle');

  const stateButtons: { label: string; value: AsyncState }[] = [
    { label: 'Idle', value: 'idle' },
    { label: 'Loading', value: 'loading' },
    { label: 'Empty', value: 'empty' },
    { label: 'Error', value: 'error' },
    { label: 'Success', value: 'success' },
  ];

  const renderContent = (): ReactElement => {
    switch (state) {
      case 'idle':
        return (
          <Box className={styles.centered}>
            <Text color="secondary">Click a state button to simulate an async data flow.</Text>
          </Box>
        );
      case 'loading':
        return (
          <VStack gap="4" className={styles.padded}>
            <HStack gap="3" align="center">
              <Spinner ariaLabel="Loading results" />
              <Text>Loading results…</Text>
            </HStack>
            <VStack gap="2" className={styles.skeletonList} data-cell-id="skeleton-list">
              <Skeleton width="100%" height={40} />
              <Skeleton width="80%" height={40} />
              <Skeleton width="90%" height={40} />
            </VStack>
          </VStack>
        );
      case 'empty':
        return (
          <Box className={styles.centered}>
            <EmptyState
              icon={<Icon name="folderOpen" size={48} />}
              title="No results"
              description="Try changing your search or filters."
              action={<Button onClick={() => setState('idle')} size="sm">Back to search</Button>}
            />
          </Box>
        );
      case 'error':
        return (
          <Box className={styles.padded}>
            <Alert
              variant="error"
              title="Network error"
              description="Could not load results. Check your connection and try again."
              icon={<Icon name="alertCircle" />}
            />
            <HStack gap="2" className={styles.retry}>
              <Button onClick={() => setState('loading')} leadingIcon={<Icon name="rotateCcw" size={16} />}>
                Retry
              </Button>
            </HStack>
          </Box>
        );
      case 'success':
        return (
          <VStack gap="3" className={styles.padded}>
            <HStack gap="2" align="center">
              <StatusDot status="success" aria-label="Success" />
              <Text>3 results found</Text>
            </HStack>
            <Card className={styles.result}>
              <Text as="p" variant="label">Result one</Text>
            </Card>
            <Card className={styles.result}>
              <Text as="p" variant="label">Result two</Text>
            </Card>
            <Card className={styles.result}>
              <Text as="p" variant="label">Result three</Text>
            </Card>
          </VStack>
        );
      default:
        return <></>;
    }
  };

  return (
    <VStack gap="6" className={styles.root}>
      <header>
        <Heading level={2} size={3}>Pattern: Async states</Heading>
        <Text color="secondary" as="p">
          Loading, empty, error, and success composed from Spinner, Skeleton, EmptyState, Alert, and Card.
        </Text>
      </header>

      <HStack gap="2" className={styles.controls}>
        {stateButtons.map((btn) => (
          <Button
            key={btn.value}
            variant={state === btn.value ? 'primary' : 'secondary'}
            onClick={() => setState(btn.value)}
            data-cell-id={`state-${btn.value}`}
          >
            {btn.label}
          </Button>
        ))}
      </HStack>

      <section className={styles.stage} aria-label="Async state preview">
        {renderContent()}
      </section>
    </VStack>
  );
}

export const showcaseMeta = {
  title: 'Pattern: Async states',
  description: 'Loading, empty, error, and success states composed from existing shared UI components.',
  level: 'pages' as const,
  category: 'Pattern',
  order: 10,
};
