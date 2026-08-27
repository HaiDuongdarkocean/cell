import { useMemo, useState, useEffect, useCallback, type FormEvent, type ReactElement } from 'react';
import { Alert } from '@/shared/ui/Alert';
import { Box } from '@/shared/ui/Box';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Heading } from '@/shared/ui/Heading';
import { HStack, VStack } from '@/shared/ui/Stack';
import { SearchField } from '@/shared/ui/SearchField';
import { Skeleton } from '@/shared/ui/Skeleton';
import { Spinner } from '@/shared/ui/Spinner';
import { Tabs } from '@/shared/ui/Tabs';
import { Text } from '@/shared/ui/Text';
import { Icon } from '@/shared/icons/Icon';
import styles from './PatternSearchResult.module.css';

type SearchStatus = 'idle' | 'loading' | 'empty' | 'error' | 'results';

interface ResultItem {
  id: string;
  title: string;
  language: string;
}

const MOCK_RESULTS: ResultItem[] = [
  { id: '1', title: 'The Witcher - S01E01', language: 'en' },
  { id: '2', title: 'Crash Landing on You - E03', language: 'ja' },
  { id: '3', title: 'Squid Game - S01E02', language: 'en' },
  { id: '4', title: 'Demon Slayer - Mugen Train', language: 'ja' },
];

const LANGUAGE_TABS = [
  { value: 'all', label: 'All' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: 'Japanese' },
];

const LOADING_DELAY_MS = 500;

export function Showcase(): ReactElement {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [status, setStatus] = useState<SearchStatus>('idle');
  const [submittedQuery, setSubmittedQuery] = useState('');

  const filtered = useMemo(() => {
    if (!submittedQuery) return [];
    if (submittedQuery.toLowerCase() === 'error') return null;
    const q = submittedQuery.toLowerCase();
    return MOCK_RESULTS.filter(
      (item) =>
        item.title.toLowerCase().includes(q) &&
        (activeTab === 'all' || item.language === activeTab),
    );
  }, [submittedQuery, activeTab]);

  const handleSearch = useCallback((e?: FormEvent): void => {
    e?.preventDefault();
    if (!query.trim()) return;
    setActiveTab('all');
    setStatus('loading');
    setSubmittedQuery(query);
  }, [query]);

  useEffect(() => {
    if (status !== 'loading') return;

    const timeout = setTimeout(() => {
      if (submittedQuery.toLowerCase() === 'error') {
        setStatus('error');
        return;
      }
      const results = MOCK_RESULTS.filter(
        (item) =>
          item.title.toLowerCase().includes(submittedQuery.toLowerCase()) &&
          (activeTab === 'all' || item.language === activeTab),
      );
      setStatus(results.length > 0 ? 'results' : 'empty');
    }, LOADING_DELAY_MS);

    return () => clearTimeout(timeout);
  }, [status, submittedQuery, activeTab]);

  const renderContent = (): ReactElement => {
    switch (status) {
      case 'idle':
        return (
          <Box className={styles.centered}>
            <Text color="secondary">Type a title and press Search or Enter.</Text>
          </Box>
        );
      case 'loading':
        return (
          <VStack gap="4" className={styles.padded}>
            <HStack gap="3" align="center">
              <Spinner ariaLabel="Searching" />
              <Text>Searching…</Text>
            </HStack>
            <VStack gap="2" data-cell-id="skeleton-list">
              <Skeleton width="100%" height={40} />
              <Skeleton width="80%" height={40} />
              <Skeleton width="60%" height={40} />
            </VStack>
          </VStack>
        );
      case 'empty':
        return (
          <Box className={styles.centered}>
            <EmptyState
              icon={<Icon name="search" size={48} />}
              title="No results"
              description={`No matches for "${submittedQuery}".`}
              action={<Button onClick={() => { setQuery(''); setSubmittedQuery(''); setStatus('idle'); }} size="sm">Clear search</Button>}
            />
          </Box>
        );
      case 'error':
        return (
          <Box className={styles.padded}>
            <Alert
              variant="error"
              title="Search failed"
              description="Could not load search results. Check your connection and try again."
              icon={<Icon name="alertCircle" />}
            />
            <HStack gap="2" className={styles.retry}>
              <Button onClick={() => setStatus('loading')} leadingIcon={<Icon name="rotateCcw" size={16} />}>
                Retry
              </Button>
            </HStack>
          </Box>
        );
      case 'results':
        if (!filtered || filtered.length === 0) return <></>;
        return (
          <VStack gap="4" className={styles.padded}>
            <Text as="p" color="secondary">{filtered.length} results found</Text>
            <VStack gap="2" role="listbox" aria-label="Search results">
              {filtered.map((item) => (
                <Card
                  key={item.id}
                  role="option"
                  aria-selected={false}
                  variant="interactive"
                  className={styles.result}
                >
                  <Text as="p" variant="label">{item.title}</Text>
                  <Text as="p" variant="supporting" color="secondary">
                    {item.language === 'en' ? 'English' : 'Japanese'}
                  </Text>
                </Card>
              ))}
            </VStack>
          </VStack>
        );
      default:
        return <></>;
    }
  };

  return (
    <VStack gap="6" className={styles.root}>
      <header>
        <Heading level={2} size={3}>Pattern: Search → result</Heading>
        <Text color="secondary" as="p">
          Search field, loading, empty, error, and filterable results.
        </Text>
      </header>

      <form onSubmit={handleSearch} className={styles.form}>
        <HStack gap="2" className={styles.searchRow}>
          <SearchField
            value={query}
            onChange={setQuery}
            onClear={() => { setQuery(''); setSubmittedQuery(''); setStatus('idle'); }}
            placeholder="Search subtitles by title…"
            aria-label="Search subtitles by title"
            className={styles.searchInput}
          />
          <Button type="submit" leadingIcon={<Icon name="search" size={16} />}>
            Search
          </Button>
        </HStack>
      </form>

      <Tabs value={activeTab} onValueChange={(value) => { setActiveTab(value); if (submittedQuery) setStatus('loading'); }}>
        <Tabs.List className={styles.tabsList} aria-label="Filter results by language">
          {LANGUAGE_TABS.map((tab) => (
            <Tabs.Trigger key={tab.value} value={tab.value}>
              {tab.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        {LANGUAGE_TABS.map((tab) => (
          <Tabs.Content key={tab.value} value={tab.value}>{null}</Tabs.Content>
        ))}
      </Tabs>

      <section className={styles.stage} aria-label="Search result preview">
        {renderContent()}
      </section>
    </VStack>
  );
}

export const showcaseMeta = {
  title: 'Pattern: Search → result',
  description: 'Search field, tabs filter, loading, empty, error, and result list composed from existing shared UI components.',
  level: 'pages' as const,
  category: 'Pattern',
  order: 11,
};
