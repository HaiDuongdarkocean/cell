// Concept C — Stone Console (command deck / ledger).
//
// IA: a mechanical control deck — a command bar up top (orders + status
// chips), a ledger of resource rows in the middle, and a tuning strip of
// numeric dials at the bottom. Hard edges, uppercase tracking, direct snap
// motion. No shared layout helpers — this file owns its own structure.

import { useState, type ReactElement } from 'react';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { Progress } from '@/shared/ui/Progress';
import { Toggle } from '@/shared/ui/Toggle';
import { DeleteConfirmModal } from '@/features/dictionary/ui/DeleteConfirmModal';
import type { FrequencyBandThresholds } from '@/shared/lib/frequencyBand';
import type { ResourceInfo, ResourceType } from '@/entities/dictionary';
import {
  BAND_FIELDS,
  SAMPLE_TERMS,
  SECTION_COPY,
  fakeRank,
  formatResourceMeta,
  type MockSectionImport,
} from './mockData';
import type { UseMockResourcesReturn } from './state';
import styles from './mockup.module.css';

interface ConceptProps {
  readonly controls: UseMockResourcesReturn;
}

/* ---- expanded readout under a ledger row ---- */

function RowReadout({ resource }: { readonly resource: ResourceInfo }): ReactElement {
  const [term, setTerm] = useState('');
  const [result, setResult] = useState<string | null>(null);

  const lookup = (): void => {
    const q = term.trim();
    setResult(
      q
        ? `LOOKUP "${q.toUpperCase()}" → RANK #${fakeRank(q, resource).toLocaleString('en-US')}`
        : null,
    );
  };

  return (
    <div className={styles.mrCDetail}>
      <div className={styles.mrCDetailRow}>
        <span className={styles.mrCDetailKey}>SAMPLE</span>
        <span className={styles.mrCDetailVal}>{SAMPLE_TERMS.join(' · ')}</span>
      </div>
      <div className={styles.mrCDetailRow}>
        <span className={styles.mrCDetailKey}>FORMAT</span>
        <span className={styles.mrCDetailVal}>{resource.format}</span>
      </div>
      <div className={styles.mrCTest}>
        <input
          className={styles.mrCTestInput}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') lookup(); }}
          placeholder="TEST LOOKUP…"
          aria-label={`Thử tra từ trong ${resource.name}`}
        />
        <Button variant="outline" size="sm" onClick={lookup}>
          Run
        </Button>
      </div>
      {result && <p className={styles.mrCTestResult} role="status">{result}</p>}
    </div>
  );
}

/* ---- one ledger row ---- */

interface LedgerRowProps {
  readonly resource: ResourceInfo;
  readonly index: number;
  readonly sectionSize: number;
  readonly expanded: boolean;
  readonly onToggleExpand: () => void;
  readonly controls: UseMockResourcesReturn;
}

function LedgerRow({ resource, index, sectionSize, expanded, onToggleExpand, controls }: LedgerRowProps): ReactElement {
  const enabled = resource.enabled !== false;

  return (
    <div className={styles.mrCRowWrap} role="listitem">
      <div className={`${styles.mrCRow} ${expanded ? styles.mrCRowOpen : ''} ${enabled ? '' : styles.mrCRowDisabled}`}>
        <button
          type="button"
          className={styles.mrCRowHead}
          onClick={onToggleExpand}
          aria-expanded={expanded}
          aria-label={expanded ? `Thu gọn ${resource.name}` : `Chi tiết ${resource.name}`}
        >
          <Icon
            name={resource.type === 'DICTIONARY' ? 'bookOpen' : 'library'}
            size="xs"
            color="secondary"
          />
          <span className={styles.mrCRowText}>
            <span className={styles.mrCRowName}>{resource.name}</span>
            <span className={styles.mrCRowMeta}>{formatResourceMeta(resource)}</span>
          </span>
          <Icon
            name="chevronDown"
            size="xs"
            color="secondary"
            style={expanded ? { transform: 'rotate(180deg)' } : undefined}
          />
        </button>

        <span className={styles.mrCRowOrd}>#{index + 1}</span>

        {sectionSize > 1 && (
          <span className={styles.mrCReorder}>
            <button
              type="button"
              className={styles.mrCCmdBtn}
              onClick={() => controls.moveResource(resource.type, index, -1)}
              disabled={index === 0}
              aria-label={`Nâng ưu tiên ${resource.name}`}
            >
              <Icon name="chevronDown" size="xs" style={{ transform: 'rotate(180deg)' }} />
            </button>
            <button
              type="button"
              className={styles.mrCCmdBtn}
              onClick={() => controls.moveResource(resource.type, index, 1)}
              disabled={index === sectionSize - 1}
              aria-label={`Hạ ưu tiên ${resource.name}`}
            >
              <Icon name="chevronDown" size="xs" />
            </button>
          </span>
        )}

        <Toggle
          size="md"
          checked={enabled}
          onChange={(next) => resource.id != null && controls.toggleResource(resource.id, next)}
          ariaLabel={enabled ? `Tắt ${resource.name}` : `Bật ${resource.name}`}
        />

        <button
          type="button"
          className={`${styles.mrCCmdBtn} ${styles.mrCCmdBtnDanger}`}
          onClick={() => controls.requestDelete(resource)}
          aria-label={`Xóa ${resource.name}`}
        >
          <Icon name="trash" size="xs" />
        </button>
      </div>

      {expanded && <RowReadout resource={resource} />}
    </div>
  );
}

/* ---- one ledger group (section) ---- */

interface LedgerGroupProps {
  readonly type: ResourceType;
  readonly resources: readonly ResourceInfo[];
  readonly importState: MockSectionImport;
  readonly expandedIds: ReadonlySet<number>;
  readonly onToggleExpand: (id: number) => void;
  readonly controls: UseMockResourcesReturn;
}

function LedgerGroup({ type, resources, importState, expandedIds, onToggleExpand, controls }: LedgerGroupProps): ReactElement {
  const copy = SECTION_COPY[type];

  return (
    <section className={styles.mrCGroup}>
      <div className={styles.mrCGroupHead}>
        <span className={styles.mrCGroupLabel}>
          <Icon name={type === 'DICTIONARY' ? 'bookOpen' : 'library'} size="xs" />
          {copy.title} — {resources.length}
        </span>
        {resources.length > 0 && (
          <button
            type="button"
            className={styles.mrCGroupClear}
            onClick={() => controls.requestDeleteAll(type)}
          >
            Xóa tất cả
          </button>
        )}
      </div>

      {importState.error && (
        <div className={styles.mrCBanner}>
          <Alert
            variant="error"
            description={importState.error}
            onDismiss={() => controls.dismissError(type)}
          />
        </div>
      )}
      {importState.success && (
        <div className={styles.mrCBanner}>
          <Alert
            variant="success"
            role="status"
            description={importState.success}
            onDismiss={() => controls.dismissSuccess(type)}
          />
        </div>
      )}
      {importState.duplicate && (
        <div className={styles.mrCBanner}>
          <Alert
            variant="warning"
            description={
              <span className={styles.mrCDupBody}>
                <span>
                  DUPLICATE — đã có &quot;{importState.duplicate.existingName}&quot;.
                </span>
                <span className={styles.mrCDupActions}>
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => controls.resolveDuplicate(type, 'replace')}
                  >
                    Thay thế
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => controls.resolveDuplicate(type, 'skip')}
                  >
                    Bỏ qua
                  </Button>
                </span>
              </span>
            }
          />
        </div>
      )}
      {importState.importing && (
        <div className={styles.mrCBanner}>
          <div className={styles.mrCProgress}>
            <span className={styles.mrCProgressLabel}>
              IMPORT {importState.pendingName ? `"${importState.pendingName}"` : ''} — {importState.progress}/{importState.progressTotal}
            </span>
            <Progress
              value={importState.progress}
              max={importState.progressTotal}
              size="sm"
              aria-label={`Đang thêm ${copy.title}`}
            />
          </div>
        </div>
      )}

      <div className={styles.mrCLedger} role="list">
        {resources.length === 0 ? (
          <p className={styles.mrCEmpty}>{copy.empty}</p>
        ) : (
          resources.map((r, i) => (
            <LedgerRow
              key={r.id}
              resource={r}
              index={i}
              sectionSize={resources.length}
              expanded={r.id != null && expandedIds.has(r.id)}
              onToggleExpand={() => r.id != null && onToggleExpand(r.id)}
              controls={controls}
            />
          ))
        )}
      </div>
    </section>
  );
}

export function ConceptC({ controls }: ConceptProps): ReactElement {
  const { state } = controls;
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<number>>(new Set());

  const toggleExpand = (id: number): void => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const commitBand = (key: keyof FrequencyBandThresholds, raw: string): void => {
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 0) return;
    controls.setBands({ ...state.bands, [key]: n });
  };

  const dictActive = controls.dictionaries.filter((r) => r.enabled !== false).length;
  const freqActive = controls.frequencies.filter((r) => r.enabled !== false).length;

  return (
    <div className={styles.mrCFrame}>
      <header className={styles.mrCHeader}>
        <span className={styles.mrCTitle}>Resources</span>
        <span className={styles.mrCHeaderMeta}>EN · Lookup deck</span>
      </header>

      <div className={styles.mrCCommand}>
        <Button
          variant="outline"
          size="sm"
          leadingIcon={<Icon name="plus" size="xs" />}
          disabled={state.importStates.DICTIONARY.importing}
          onClick={() => controls.simulateImport('DICTIONARY')}
        >
          Thêm từ điển
        </Button>
        <Button
          variant="outline"
          size="sm"
          leadingIcon={<Icon name="plus" size="xs" />}
          disabled={state.importStates.FREQUENCY.importing}
          onClick={() => controls.simulateImport('FREQUENCY')}
        >
          Thêm danh sách
        </Button>
        <span className={styles.mrCStats}>
          <span className={styles.mrCStat}>
            <Icon name="bookOpen" size="xs" />
            {dictActive}/{controls.dictionaries.length} từ điển
          </span>
          <span className={styles.mrCStat}>
            <Icon name="library" size="xs" />
            {freqActive}/{controls.frequencies.length} danh sách
          </span>
        </span>
      </div>

      <LedgerGroup
        type="DICTIONARY"
        resources={controls.dictionaries}
        importState={state.importStates.DICTIONARY}
        expandedIds={expandedIds}
        onToggleExpand={toggleExpand}
        controls={controls}
      />
      <LedgerGroup
        type="FREQUENCY"
        resources={controls.frequencies}
        importState={state.importStates.FREQUENCY}
        expandedIds={expandedIds}
        onToggleExpand={toggleExpand}
        controls={controls}
      />

      <footer className={styles.mrCStrip}>
        <span className={styles.mrCStripLabel}>
          <Icon name="slidersHorizontal" size="xs" />
          Ngưỡng tần suất
        </span>
        <div className={styles.mrCBandGrid}>
          {BAND_FIELDS.map(({ key, label }) => (
            <label key={key} className={styles.mrCBandField}>
              <span className={styles.mrCBandLabel}>{label}</span>
              <input
                type="number"
                className={styles.mrCBandInput}
                min={0}
                step={100}
                value={state.bands[key]}
                onChange={(e) => commitBand(key, e.target.value)}
              />
            </label>
          ))}
        </div>
      </footer>

      {state.deleteTarget && (
        <DeleteConfirmModal
          resource={state.deleteTarget}
          onConfirm={controls.confirmDelete}
          onCancel={controls.cancelDelete}
        />
      )}
      {state.deleteAllTarget && (
        <DeleteConfirmModal
          title={`Xóa tất cả ${state.resources.filter((r) => r.type === state.deleteAllTarget).length} ${SECTION_COPY[state.deleteAllTarget].noun}?`}
          description={`Xóa vĩnh viễn toàn bộ ${SECTION_COPY[state.deleteAllTarget].noun} trong mục này và dữ liệu của chúng.`}
          onConfirm={controls.confirmDeleteAll}
          onCancel={controls.cancelDelete}
        />
      )}
    </div>
  );
}
