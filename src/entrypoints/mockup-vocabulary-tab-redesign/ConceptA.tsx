import type React from 'react';
import { Icon } from '@/shared/icons/Icon';
import { hoursLeft, type MockStatus } from './mockData';
import { SEGMENT_ORDER, type Segment, type VocabMock } from './state';
import styles from './mockup.module.css';

const STATUS_LABEL: Record<MockStatus, string> = {
  tracking: 'Tracking',
  known: 'Known',
  ignore: 'Ignored',
};

const STATUS_CLASS: Record<MockStatus, string> = {
  tracking: styles.statusTracking,
  known: styles.statusKnown,
  ignore: styles.statusIgnore,
};

function segmentLabel(s: Segment): string {
  if (s === 'all') return 'All';
  if (s === 'trash') return 'Trash';
  return STATUS_LABEL[s];
}

export function ConceptA({ mock }: { readonly mock: VocabMock }): React.JSX.Element {
  const inTrash = mock.segment === 'trash';
  const segments: Segment[] = ['all', ...SEGMENT_ORDER];

  return (
    <div className={styles.frame} style={{ position: 'relative' }}>
      <div className={styles.caBody}>
        <div className={styles.caSegments} role="tablist" aria-label="Vocabulary filter">
          {segments.map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={mock.segment === s}
              className={styles.caSegment}
              onClick={() => mock.setSegment(s)}
            >
              {segmentLabel(s)}
              <span className={styles.caSegmentCount}>{mock.counts[s]}</span>
            </button>
          ))}
          <button
            type="button"
            role="tab"
            aria-selected={inTrash}
            className={`${styles.caSegment} ${styles.caSegmentTrash}`}
            onClick={() => mock.setSegment('trash')}
          >
            <Icon name="trash2" size={16} />
            Trash
            <span className={styles.caSegmentCount}>{mock.counts.trash}</span>
          </button>
        </div>

        <input
          className={styles.search}
          value={mock.query}
          onChange={(e) => mock.setQuery(e.target.value)}
          placeholder="Search words…"
          aria-label="Search words"
        />

        {!inTrash && (
          <div className={styles.caSubRow}>
            <select
              className={styles.select}
              value={mock.sort}
              onChange={(e) => mock.setSort(e.target.value as typeof mock.sort)}
              aria-label="Sort"
            >
              <option value="recent">Recently marked</option>
              <option value="alpha">A–Z</option>
              <option value="grouped">Grouped by status</option>
            </select>
            <button
              type="button"
              className={styles.textBtn}
              onClick={() => mock.setEditMode(!mock.editMode)}
            >
              {mock.editMode ? 'Done' : 'Edit'}
            </button>
          </div>
        )}

        {inTrash ? (
          mock.trashVisible.length === 0 ? (
            <div className={styles.empty}>Trash is empty</div>
          ) : (
            <ul className={styles.list}>
              {mock.trashVisible.map((entry) => (
                <li key={entry.term} className={styles.caRow}>
                  <button type="button" className={styles.termBtn}>{entry.term}</button>
                  <span className={`${styles.statusPill} ${styles.statusPillStatic} ${STATUS_CLASS[entry.previousStatus]}`}>
                    {STATUS_LABEL[entry.previousStatus]}
                  </span>
                  <span className={styles.meta}>{hoursLeft(entry.trashedAt)}</span>
                  <button
                    type="button"
                    className={styles.textBtn}
                    onClick={() => mock.restore(entry.term)}
                  >
                    Restore
                  </button>
                  <button
                    type="button"
                    className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                    aria-label={`Delete ${entry.term} forever`}
                    onClick={() => mock.setPendingPurge(entry.term)}
                  >
                    <Icon name="x" size={20} />
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : mock.visible.length === 0 ? (
          <div className={styles.empty}>No words match</div>
        ) : (
          <ul className={styles.list}>
            {mock.visible.map((entry) => (
              <li key={entry.term} className={styles.caRow}>
                <button type="button" className={styles.termBtn}>{entry.term}</button>
                <button
                  type="button"
                  className={`${styles.statusPill} ${STATUS_CLASS[entry.status]}`}
                  aria-label={`Cycle status for ${entry.term}`}
                  onClick={() => mock.cycle(entry.term)}
                >
                  {STATUS_LABEL[entry.status]}
                </button>
                <span className={styles.meta}>{new Date(entry.updatedAt).toLocaleDateString()}</span>
                {mock.editMode && (
                  <button
                    type="button"
                    className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                    aria-label={`Remove ${entry.term}`}
                    onClick={() => mock.setPendingDelete(entry.term)}
                  >
                    <Icon name="trash" size={20} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {mock.pendingDelete !== null && (
        <div className={styles.confirmOverlay}>
          <div className={styles.confirmCard}>
            <p className={styles.confirmTitle}>Remove word?</p>
            <p className={styles.confirmDesc}>
              “{mock.pendingDelete}” moves to Trash and is deleted after 24 hours.
            </p>
            <div className={styles.confirmActions}>
              <button
                type="button"
                className={`${styles.confirmBtn} ${styles.confirmBtnGhost}`}
                onClick={() => mock.setPendingDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${styles.confirmBtn} ${styles.confirmBtnDanger}`}
                onClick={() => mock.remove(mock.pendingDelete!)}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {mock.pendingPurge !== null && (
        <div className={styles.confirmOverlay}>
          <div className={styles.confirmCard}>
            <p className={styles.confirmTitle}>Delete forever?</p>
            <p className={styles.confirmDesc}>
              “{mock.pendingPurge}” is permanently deleted. This cannot be undone.
            </p>
            <div className={styles.confirmActions}>
              <button
                type="button"
                className={`${styles.confirmBtn} ${styles.confirmBtnGhost}`}
                onClick={() => mock.setPendingPurge(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${styles.confirmBtn} ${styles.confirmBtnDanger}`}
                onClick={() => mock.purge(mock.pendingPurge!)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
