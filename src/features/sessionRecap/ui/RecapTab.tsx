import { useCallback, useEffect, useState } from 'react';
import { Alert } from '@/shared/ui/Alert';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Chip } from '@/shared/ui/Chip';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Heading } from '@/shared/ui/Heading';
import { Icon } from '@/shared/ui/Icon';
import { ListItem } from '@/shared/ui/ListItem';
import { SectionHeader } from '@/shared/ui/SectionHeader';
import { Spinner } from '@/shared/ui/Spinner';
import { Text } from '@/shared/ui/Text';
import { Timestamp } from '@/shared/ui/Timestamp';
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import { t, type MessageKey } from '@/shared/i18n';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { GetSessionRecapResult, MessageResponse } from '@/entities/message';
import type { SessionRecap, SessionRecapStatus } from '../types';
import styles from './RecapTab.module.css';

const STATUS_LABEL: Record<SessionRecapStatus, MessageKey> = {
  learning: 'vocabulary.status.learning',
  known: 'vocabulary.status.known',
  tracking: 'vocabulary.status.tracking',
  ignore: 'vocabulary.status.ignore',
};

const MINUTE_MS = 60_000;

function formatMinutes(durationMs: number): string {
  return t('recap.duration.minutes', [Math.max(1, Math.round(durationMs / MINUTE_MS))]);
}

interface MetricsProps {
  readonly session: SessionRecap;
  readonly onLookup: (term: string) => void;
}

function SessionMetrics({ session, onLookup }: MetricsProps): React.JSX.Element {
  return (
    <div className={styles.metrics}>
      {session.lookups && (
        <div className={styles.group}>
          <Text variant="supporting" color="secondary" className={styles.groupLabel}>
            {t('recap.lookups.count', [session.lookups.count])}
          </Text>
          <div className={styles.chips}>
            {session.lookups.terms.map((term) => (
              <Chip key={term} as="button" size="sm" onClick={() => onLookup(term)}>
                {term}
              </Chip>
            ))}
            {session.lookups.moreCount > 0 && <Chip size="sm">+{session.lookups.moreCount}</Chip>}
          </div>
        </div>
      )}
      {session.statusChanges && (
        <div className={styles.group}>
          <div className={styles.groupHead}>
            <Text variant="supporting" color="secondary" className={styles.groupLabel}>
              {t('recap.marked.count', [session.statusChanges.count])}
            </Text>
            {session.statusChanges.derived && (
              <Badge variant="muted" size="sm" aria-label={t('recap.derived.aria')}>
                <Icon name="info" size="sm" />
                {t('recap.derived')}
              </Badge>
            )}
          </div>
          {session.statusChanges.groups.map((group) => (
            <div key={group.status} className={styles.statusRow}>
              <Text variant="supporting" color="secondary" className={styles.statusLabel}>
                {t(STATUS_LABEL[group.status])}
              </Text>
              <div className={styles.chips}>
                {group.terms.map((term) => (
                  <button
                    key={term}
                    type="button"
                    className={`${styles.statusChip} ${styles[`status-${group.status}`]}`}
                    onClick={() => onLookup(term)}
                  >
                    {term}
                  </button>
                ))}
                {group.moreCount > 0 && <Chip size="sm">+{group.moreCount}</Chip>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HeroSession({ session, onLookup }: MetricsProps): React.JSX.Element {
  return (
    <Card className={styles.hero} data-cell-id="recap-hero">
      <div className={styles.heroTop}>
        <Heading level={3} size={2} className={styles.duration}>
          {formatMinutes(session.durationMs)}
        </Heading>
        {session.coverage && (
          <Chip size="sm" className={styles.coverage}>
            <Icon name="gauge" size="sm" />
            {Math.round(session.coverage.value * 100)}% · {session.coverage.band}
          </Chip>
        )}
      </div>
      <div className={styles.source}>
        <Icon name={session.kind === 'local' ? 'video' : 'captions'} size="sm" />
        <Text variant="body" color="secondary" truncate className={styles.sourceLabel}>
          {session.sourceLabel}
        </Text>
        <Timestamp value={session.startMs} className={styles.when} />
      </div>
      <SessionMetrics session={session} onLookup={onLookup} />
    </Card>
  );
}

interface RowProps extends MetricsProps {
  readonly expanded: boolean;
  readonly onToggle: () => void;
}

function SessionRow({ session, onLookup, expanded, onToggle }: RowProps): React.JSX.Element {
  const markCount = session.statusChanges?.count;
  const summary = [
    formatMinutes(session.durationMs),
    session.lookups ? t('recap.summary.lookups', [session.lookups.count]) : null,
    markCount != null ? t('recap.summary.marked', [markCount]) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <div className={styles.row}>
      <button
        type="button"
        className={styles.rowToggle}
        aria-expanded={expanded}
        onClick={onToggle}
      >
        <ListItem
          className={styles.rowItem}
          leading={<Icon name={session.kind === 'local' ? 'video' : 'captions'} size="sm" />}
          trailing={
            <span className={styles.rowTrailing}>
              <Text variant="supporting" color="secondary">
                {summary}
              </Text>
              <Icon
                name="chevronDown"
                size="sm"
                className={`${styles.chevron} ${expanded ? styles.chevronOpen : ''}`}
              />
            </span>
          }
        >
          <div className={styles.rowMain}>
            <Text variant="body" truncate>
              {session.sourceLabel}
            </Text>
            <Timestamp value={session.startMs} className={styles.when} />
          </div>
        </ListItem>
      </button>
      {expanded && (
        <div className={styles.rowDetail}>
          <SessionMetrics session={session} onLookup={onLookup} />
        </div>
      )}
    </div>
  );
}

export interface RecapTabProps {
  readonly onLookup: (term: string) => void;
}

export function RecapTab({ onLookup }: RecapTabProps): React.JSX.Element {
  const [sessions, setSessions] = useState<readonly SessionRecap[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setFailed(false);
    try {
      const res = await sendMessage<MessageResponse<GetSessionRecapResult>>({
        type: MESSAGE_TYPES.GET_SESSION_RECAP,
        payload: {},
      });
      if (res?.success && res.data) setSessions(res.data.sessions);
      else setFailed(true);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (failed) {
    return (
      <div className={styles.stateWrap}>
        <Alert
          role="alert"
          icon={<Icon name="alertCircle" size="sm" />}
          title={t('recap.error.title')}
          description={t('recap.error.description')}
        />
        <Button
          size="sm"
          variant="secondary"
          leadingIcon={<Icon name="rotateCcw" size="sm" />}
          onClick={() => {
            setSessions(null);
            void load();
          }}
        >
          {t('jobs.action.retry')}
        </Button>
      </div>
    );
  }
  if (sessions === null) {
    return (
      <div className={styles.center} role="status" aria-label={t('recap.loading.aria')}>
        <Spinner size="lg" />
        <Text variant="supporting" color="secondary">
          {t('recap.loading')}
        </Text>
      </div>
    );
  }
  if (sessions.length === 0) {
    return (
      <div className={styles.stateWrap}>
        <EmptyState
          size="compact"
          icon={<Icon name="clock" />}
          title={t('recap.empty.title')}
          description={t('recap.empty.description')}
        />
      </div>
    );
  }

  const [latest, ...rest] = sessions;
  return (
    <div className={styles.body}>
      <SectionHeader
        title={
          <span className={styles.headRow}>
            {t('recap.latest')}
            {latest.live && (
              <Badge variant="warning" size="sm" aria-label={t('recap.live.aria')}>
                {t('recap.live')}
              </Badge>
            )}
          </span>
        }
        level={4}
      />
      <HeroSession session={latest} onLookup={onLookup} />
      {rest.length > 0 && (
        <>
          <SectionHeader title={t('recap.previous')} level={4} />
          <div className={styles.list}>
            {rest.map((s) => (
              <SessionRow
                key={s.id}
                session={s}
                onLookup={onLookup}
                expanded={expandedId === s.id}
                onToggle={() => setExpandedId((id) => (id === s.id ? null : s.id))}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
