// Concept A — Stillwater Shelf (editorial list).
//
// IA: a quiet bookshelf — each resource is a card on a shelf, ordered by
// priority. Solid editorial surfaces, large section headings, soft cards,
// dropzones as "trays", and the frequency bands sit at the bottom like a
// ruler. No shared layout helpers — this file owns its own structure.

import { useState, type ReactElement } from 'react';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { Heading } from '@/shared/ui/Heading';
import { Icon } from '@/shared/ui/Icon';
import { Progress } from '@/shared/ui/Progress';
import { Text } from '@/shared/ui/Text';
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

/* ---- expanded detail: sample terms + a tiny lookup tester ---- */

function ShelfDetail({ resource }: { readonly resource: ResourceInfo }): ReactElement {
  const [term, setTerm] = useState('');
  const [result, setResult] = useState<string | null>(null);

  const lookup = (): void => {
    const q = term.trim();
    setResult(q ? `"${q}" → hạng #${fakeRank(q, resource).toLocaleString('en-US')}` : null);
  };

  return (
    <div className={styles.mrADetail}>
      <span className={styles.mrADetailLabel}>
        {resource.type === 'DICTIONARY' ? 'Mục từ mẫu' : 'Từ mẫu'}
      </span>
      <div className={styles.mrASample}>
        {SAMPLE_TERMS.map((t) => (
          <span key={t} className={styles.mrASampleTerm}>{t}</span>
        ))}
      </div>
      <div className={styles.mrATest}>
        <input
          className={styles.mrATestInput}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') lookup(); }}
          placeholder="Thử tra từ…"
          aria-label={`Thử tra từ trong ${resource.name}`}
        />
        <Button variant="outline" size="sm" onClick={lookup}>
          Tra
        </Button>
      </div>
      {result && (
        <p className={styles.mrATestResult} role="status">{result}</p>
      )}
    </div>
  );
}

/* ---- one book on the shelf ---- */

interface ShelfCardProps {
  readonly resource: ResourceInfo;
  readonly index: number;
  readonly sectionSize: number;
  readonly expanded: boolean;
  readonly onToggleExpand: () => void;
  readonly controls: UseMockResourcesReturn;
}

function ShelfCard({ resource, index, sectionSize, expanded, onToggleExpand, controls }: ShelfCardProps): ReactElement {
  const enabled = resource.enabled !== false;
  const canReorder = sectionSize > 1;

  return (
    <div className={`${styles.mrACard} ${enabled ? '' : styles.mrACardDisabled}`}>
      <div className={styles.mrACardRow}>
        <button
          type="button"
          className={styles.mrAIconBtn}
          onClick={onToggleExpand}
          aria-expanded={expanded}
          aria-label={expanded ? `Thu gọn ${resource.name}` : `Chi tiết ${resource.name}`}
        >
          <Icon
            name="chevronDown"
            size="xs"
            style={expanded ? { transform: 'rotate(180deg)' } : undefined}
          />
        </button>

        <div className={styles.mrACardInfo}>
          <span className={styles.mrACardName}>{resource.name}</span>
          <span className={styles.mrACardMeta}>{formatResourceMeta(resource)}</span>
        </div>

        {sectionSize > 1 && (
          <span className={styles.mrAPriority}>Ưu tiên {index + 1}</span>
        )}

        {canReorder && (
          <div className={styles.mrAReorder}>
            <button
              type="button"
              className={styles.mrAIconBtn}
              onClick={() => controls.moveResource(resource.type, index, -1)}
              disabled={index === 0}
              aria-label={`Nâng ưu tiên ${resource.name}`}
            >
              <Icon name="chevronDown" size="xs" style={{ transform: 'rotate(180deg)' }} />
            </button>
            <button
              type="button"
              className={styles.mrAIconBtn}
              onClick={() => controls.moveResource(resource.type, index, 1)}
              disabled={index === sectionSize - 1}
              aria-label={`Hạ ưu tiên ${resource.name}`}
            >
              <Icon name="chevronDown" size="xs" />
            </button>
          </div>
        )}

        <Toggle
          size="md"
          checked={enabled}
          onChange={(next) => resource.id != null && controls.toggleResource(resource.id, next)}
          ariaLabel={enabled ? `Tắt ${resource.name}` : `Bật ${resource.name}`}
        />

        <button
          type="button"
          className={`${styles.mrAIconBtn} ${styles.mrAIconBtnDanger}`}
          onClick={() => controls.requestDelete(resource)}
          aria-label={`Xóa ${resource.name}`}
        >
          <Icon name="trash" size="xs" />
        </button>
      </div>

      {expanded && <ShelfDetail resource={resource} />}
    </div>
  );
}

/* ---- one shelf (section) ---- */

interface ShelfSectionProps {
  readonly type: ResourceType;
  readonly resources: readonly ResourceInfo[];
  readonly importState: MockSectionImport;
  readonly expandedIds: ReadonlySet<number>;
  readonly onToggleExpand: (id: number) => void;
  readonly controls: UseMockResourcesReturn;
  readonly footer?: ReactElement;
}

function ShelfSection({ type, resources, importState, expandedIds, onToggleExpand, controls, footer }: ShelfSectionProps): ReactElement {
  const copy = SECTION_COPY[type];

  return (
    <section className={styles.mrAShelf}>
      <div className={styles.mrAShelfHead}>
        <Heading level={3} size={4} className={styles.mrAShelfTitle}>
          <Icon name={type === 'DICTIONARY' ? 'bookOpen' : 'library'} size="sm" />
          {copy.title}
        </Heading>
        <span className={styles.mrAShelfMeta}>
          {resources.length > 0 ? `${resources.length} · ${copy.subtitle}` : copy.subtitle}
        </span>
      </div>

      {importState.error && (
        <Alert
          variant="error"
          description={importState.error}
          onDismiss={() => controls.dismissError(type)}
        />
      )}
      {importState.success && (
        <Alert
          variant="success"
          role="status"
          description={importState.success}
          onDismiss={() => controls.dismissSuccess(type)}
        />
      )}
      {importState.duplicate && (
        <Alert
          variant="warning"
          description={
            <span className={styles.mrADupBody}>
              <span>
                Đã có sẵn &quot;{importState.duplicate.existingName}&quot; — chọn thay thế hoặc bỏ qua.
              </span>
              <span className={styles.mrADupActions}>
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
      )}

      {importState.importing ? (
        <div className={styles.mrAProgress}>
          <Progress
            value={importState.progress}
            max={importState.progressTotal}
            aria-label={`Đang thêm ${copy.title}`}
          />
          <span className={styles.mrAProgressLabel}>
            Đang thêm{importState.pendingName ? ` "${importState.pendingName}"` : ''}… {importState.progress} / {importState.progressTotal} mục
          </span>
        </div>
      ) : (
        <button
          type="button"
          className={styles.mrADrop}
          onClick={() => controls.simulateImport(type)}
        >
          <span className={styles.mrADropIcon}>
            <Icon name="plus" size="sm" color="primary" />
          </span>
          <span className={styles.mrADropText}>
            <span className={styles.mrADropLabel}>{copy.dropLabel}</span>
            <span className={styles.mrADropHint}>
              {resources.length === 0 ? copy.empty : copy.dropHint}
            </span>
          </span>
        </button>
      )}

      {resources.length > 0 && (
        <div className={styles.mrAList} role="list">
          {resources.map((r, i) => (
            <ShelfCard
              key={r.id}
              resource={r}
              index={i}
              sectionSize={resources.length}
              expanded={r.id != null && expandedIds.has(r.id)}
              onToggleExpand={() => r.id != null && onToggleExpand(r.id)}
              controls={controls}
            />
          ))}
        </div>
      )}

      <div className={styles.mrAShelfFoot}>
        {resources.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className={styles.mrADeleteAll}
            onClick={() => controls.requestDeleteAll(type)}
          >
            <Icon name="trash" size="xs" />
            Xóa tất cả
          </Button>
        )}
        {footer}
      </div>
    </section>
  );
}

/* ---- the ruler at the bottom of the frequency shelf ---- */

function BandsRuler({ bands, onChange }: { readonly bands: FrequencyBandThresholds; readonly onChange: (b: FrequencyBandThresholds) => void }): ReactElement {
  const commit = (key: keyof FrequencyBandThresholds, raw: string): void => {
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 0) return;
    onChange({ ...bands, [key]: n });
  };

  return (
    <div className={styles.mrABands}>
      <div className={styles.mrABandsHead}>
        <Icon name="slidersHorizontal" size="xs" />
        <span>Ngưỡng độ phổ biến</span>
      </div>
      <div className={styles.mrABandGrid}>
        {BAND_FIELDS.map(({ key, label }) => (
          <label key={key} className={styles.mrABandField}>
            <span className={styles.mrABandLabel}>{label}</span>
            <input
              type="number"
              className={styles.mrABandInput}
              min={0}
              step={100}
              value={bands[key]}
              onChange={(e) => commit(key, e.target.value)}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

export function ConceptA({ controls }: ConceptProps): ReactElement {
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

  return (
    <div className={styles.mrAFrame}>
      <header className={styles.mrAHeader}>
        <Heading level={2} size={2} className={styles.mrATitle}>Resources</Heading>
        <Text as="p" color="secondary" className={styles.mrADesc}>
          Kệ sách tra cứu — thêm, sắp xếp và bật tắt từ điển cùng danh sách tần suất.
        </Text>
      </header>

      <ShelfSection
        type="DICTIONARY"
        resources={controls.dictionaries}
        importState={state.importStates.DICTIONARY}
        expandedIds={expandedIds}
        onToggleExpand={toggleExpand}
        controls={controls}
      />
      <ShelfSection
        type="FREQUENCY"
        resources={controls.frequencies}
        importState={state.importStates.FREQUENCY}
        expandedIds={expandedIds}
        onToggleExpand={toggleExpand}
        controls={controls}
        footer={<BandsRuler bands={state.bands} onChange={controls.setBands} />}
      />

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
