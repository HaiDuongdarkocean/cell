import { useState } from 'react';
import type React from 'react';
import { Icon } from '@/shared/icons/Icon';
import { daysAgo, hoursLeft, type MockStatus } from './mockData';
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

const SORT_LABEL: Record<string, string> = {
  recent: 'Recent',
  alpha: 'A–Z',
  grouped: 'Grouped',
};

function segmentLabel(s: Segment): string {
  if (s === 'all') return 'All words';
  if (s === 'trash') return 'Trash';
  return STATUS_LABEL[s];
}

export function ConceptB({ mock }: { readonly mock: VocabMock }): React.JSX.Element {
  const [menu, setMenu] = useState<'filter' | 'sort' | null>(null);
  const inTrash = mock.segment === 'trash';
  const segments: Segment[] = ['all', ...SEGMENT_ORDER];

  return (
    <div className={styles.frame} style={{ position: 'relative' }}>
      <div className={styles.cbBody}>
        <div className={styles.cbToolbar}>
          <button
            type="button"
            className={`${styles.cbToolBtn} ${inTrash ? '' : styles.cbToolBtnActive}`}
            onClick={() => setMenu(menu === 'filter' ? null : 'filter')}
            aria-haspopup="menu"
            aria-expanded={menu === 'filter'}
          >
            <Icon name="slidersHorizontal" size={20} />
            {segmentLabel(mock.segment)}
            <Icon name="chevronDown" size={16} />
          </button>
          {!inTrash && (
            <button
              type="button"
              className={styles.cbToolBtn}
              onClick={() => setMenu(menu === 'sort' ? null : 'sort')}
              aria-haspopup="menu"
              aria-expanded={menu === 'sort'}
            >
              {SORT_LABEL[mock.sort]}
              <Icon name="chevronDown" size={16} />
            </button>
          )}
          <span className={styles.cbSpacer} />
          {!inTrash && (
            <button
              type="button"
              className={styles.cbToolBtn}
              onClick={() => mock.setEditMode(!mock.editMode)}
              aria-pressed={mock.editMode}
            >
              <Icon name="pencil" size={20} />
              {mock.editMode ? 'Done' : 'Edit'}
            </button>
          )}

          {menu === 'filter' && (
            <div className={styles.cbPopover} role="menu">
              {segments.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="menuitemradio"
                  aria-checked={mock.segment === s}
                  className={styles.cbPopItem}
                  onClick={() => { mock.setSegment(s); setMenu(null); }}
                >
                  {segmentLabel(s)}
                  <span className={styles.cbPopCount}>{mock.counts[s]}</span>
                </button>
              ))}
              <div className={styles.cbPopSep} />
              <button
                type="button"
                role="menuitemradio"
                aria-checked={inTrash}
                className={styles.cbPopItem}
                onClick={() => { mock.setSegment('trash'); setMenu(null); }}
              >
                Trash
                <span className={styles.cbPopCount}>{mock.counts.trash}</span>
              </button>
            </div>
          )}

          {menu === 'sort' && (
            <div className={styles.cbPopover} role="menu">
              {(['recent', 'alpha', 'grouped'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  role="menuitemradio"
                  aria-checked={mock.sort === s}
                  className={styles.cbPopItem}
                  onClick={() => { mock.setSort(s); setMenu(null); }}
                >
                  {SORT_LABEL[s]}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={styles.cbSearchRow}>
          <input
            className={styles.search}
            value={mock.query}
            onChange={(e) => mock.setQuery(e.target.value)}
            placeholder="Search words…"
            aria-label="Search words"
          />
        </div>

        {inTrash ? (
          mock.trashVisible.length === 0 ? (
            <div className={styles.empty}>Trash is empty</div>
          ) : (
            <ul className={styles.list}>
              {mock.trashVisible.map((entry) => (
                <li key={entry.term} className={styles.cbRow}>
                  <button type="button" className={styles.termBtn}>{entry.term}</button>
                  <span className={`${styles.statusPill} ${styles.statusPillStatic} ${STATUS_CLASS[entry.previousStatus]}`}>
                    {STATUS_LABEL[entry.previousStatus]}
                  </span>
                  <span className={styles.meta}>{hoursLeft(entry.trashedAt)}</span>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    aria-label={`Restore ${entry.term}`}
                    onClick={() => mock.restore(entry.term)}
                  >
                    <Icon name="rotateCcw" size={20} />
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
              <li key={entry.term} className={styles.cbRow}>
                <button type="button" className={styles.termBtn}>{entry.term}</button>
                <span className={styles.meta}>{daysAgo(entry.updatedAt)}</span>
                <button
                  type="button"
                  className={`${styles.statusPill} ${STATUS_CLASS[entry.status]}`}
                  aria-label={`Cycle status for ${entry.term}`}
                  onClick={() => mock.cycle(entry.term)}
                >
                  {STATUS_LABEL[entry.status]}
                </button>
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
