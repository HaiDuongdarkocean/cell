// Concept E — Modular Pinboard (3-column board).
//
// IA: a cork board — three pinned columns: Từ điển (active dictionaries),
// Độ phổ biến (active frequency lists), and Tạm tắt (anything switched
// off). Cards move between columns with explicit buttons (mobile-friendly)
// and reorder inside a column with chevrons. Selecting a card opens an
// inspector — a bottom sheet on narrow stages, a side drawer on wide ones —
// with profile, sample terms, a lookup tester, and the frequency bands.
// Solid cards, soft tinted columns. No shared layout helpers — this file
// owns its own structure.

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

type ColumnId = 'dict' | 'freq' | 'off';

interface ColumnDef {
  readonly id: ColumnId;
  readonly title: string;
  readonly subtitle: string;
  readonly icon: 'bookOpen' | 'library' | 'pause';
  readonly type: ResourceType | null;
  readonly items: readonly ResourceInfo[];
}

/* ---- board-level alerts for one resource type ---- */

function BoardAlerts({ type, importState, controls }: { readonly type: ResourceType; readonly importState: MockSectionImport; readonly controls: UseMockResourcesReturn }): ReactElement | null {
  if (!importState.error && !importState.success && !importState.duplicate) return null;
  return (
    <div className={styles.mrEAlerts}>
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
            <span className={styles.mrEDupBody}>
              <span>
                Đã có sẵn &quot;{importState.duplicate.existingName}&quot; — chọn thay thế hoặc bỏ qua.
              </span>
              <span className={styles.mrEDupActions}>
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
    </div>
  );
}

/* ---- one pinned card ---- */

interface PinCardProps {
  readonly resource: ResourceInfo;
  readonly column: ColumnId;
  readonly typeIndex: number;
  readonly typeSize: number;
  readonly selected: boolean;
  readonly onSelect: () => void;
  readonly controls: UseMockResourcesReturn;
}

function PinCard({ resource, column, typeIndex, typeSize, selected, onSelect, controls }: PinCardProps): ReactElement {
  const enabled = resource.enabled !== false;

  return (
    <div
      className={`${styles.mrECard} ${selected ? styles.mrECardSelected : ''} ${enabled ? '' : styles.mrECardDisabled}`}
    >
      <button
        type="button"
        className={styles.mrECardMain}
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={`Chi tiết ${resource.name}`}
      >
        <span className={styles.mrECardGrip} aria-hidden="true">
          <Icon name="moveVertical" size="xs" />
        </span>
        <span className={styles.mrECardText}>
          <span className={styles.mrECardName}>{resource.name}</span>
          <span className={styles.mrECardMeta}>{formatResourceMeta(resource)}</span>
        </span>
        <Icon name="chevronRight" size="xs" color="secondary" />
      </button>

      <div className={styles.mrECardActions}>
        {column === 'off' ? (
          <button
            type="button"
            className={styles.mrEMoveBtn}
            onClick={() => resource.id != null && controls.toggleResource(resource.id, true)}
            aria-label={`Bật lại ${resource.name}`}
          >
            <Icon name="pin" size="xs" />
            Bật lại
          </button>
        ) : (
          <>
            {typeSize > 1 && typeIndex >= 0 && (
              <span className={styles.mrEReorder}>
                <button
                  type="button"
                  className={styles.mrEIconBtn}
                  onClick={() => controls.moveResource(resource.type, typeIndex, -1)}
                  disabled={typeIndex === 0}
                  aria-label={`Nâng ưu tiên ${resource.name}`}
                >
                  <Icon name="chevronDown" size="xs" style={{ transform: 'rotate(180deg)' }} />
                </button>
                <button
                  type="button"
                  className={styles.mrEIconBtn}
                  onClick={() => controls.moveResource(resource.type, typeIndex, 1)}
                  disabled={typeIndex === typeSize - 1}
                  aria-label={`Hạ ưu tiên ${resource.name}`}
                >
                  <Icon name="chevronDown" size="xs" />
                </button>
              </span>
            )}
            <button
              type="button"
              className={styles.mrEMoveBtn}
              onClick={() => resource.id != null && controls.toggleResource(resource.id, false)}
              aria-label={`Chuyển ${resource.name} sang Tạm tắt`}
            >
              <Icon name="pinOff" size="xs" />
              Tạm tắt
            </button>
          </>
        )}
        <button
          type="button"
          className={`${styles.mrEIconBtn} ${styles.mrEIconBtnDanger}`}
          onClick={() => controls.requestDelete(resource)}
          aria-label={`Xóa ${resource.name}`}
        >
          <Icon name="trash" size="xs" />
        </button>
      </div>
    </div>
  );
}

/* ---- one board column ---- */

interface PinColumnProps {
  readonly column: ColumnDef;
  readonly importState: MockSectionImport | null;
  readonly selectedId: number | null;
  readonly onSelect: (id: number) => void;
  readonly typeIndexOf: (r: ResourceInfo) => { index: number; size: number };
  readonly controls: UseMockResourcesReturn;
}

function PinColumn({ column, importState, selectedId, onSelect, typeIndexOf, controls }: PinColumnProps): ReactElement {
  const canAdd = column.type != null;
  const importing = importState?.importing ?? false;

  return (
    <section className={styles.mrEColumn} data-column={column.id}>
      <header className={styles.mrEColumnHead}>
        <span className={styles.mrEColumnIcon}>
          <Icon name={column.icon} size="xs" />
        </span>
        <div className={styles.mrEColumnText}>
          <span className={styles.mrEColumnTitle}>
            {column.title}
            <span className={styles.mrEColumnCount}>{column.items.length}</span>
          </span>
          <span className={styles.mrEColumnSub}>{column.subtitle}</span>
        </div>
        {canAdd && column.type && (
          <button
            type="button"
            className={styles.mrEIconBtn}
            disabled={importing}
            onClick={() => column.type && controls.simulateImport(column.type)}
            aria-label={SECTION_COPY[column.type].dropLabel}
          >
            <Icon name="plus" size="xs" />
          </button>
        )}
      </header>

      {importing && importState && column.type && (
        <div className={styles.mrEProgress}>
          <Progress
            value={importState.progress}
            max={importState.progressTotal}
            size="sm"
            aria-label={`Đang thêm ${SECTION_COPY[column.type].title}`}
          />
          <span className={styles.mrEProgressLabel}>
            {importState.pendingName ?? column.title} · {importState.progress}/{importState.progressTotal}
          </span>
        </div>
      )}

      <div className={styles.mrEColumnBody} role="list">
        {column.items.length === 0 ? (
          <p className={styles.mrEEmpty}>
            {column.id === 'off' ? 'Không có mục nào đang tắt.' : (column.type ? SECTION_COPY[column.type].empty : '')}
          </p>
        ) : (
          column.items.map((r) => {
            const { index, size } = typeIndexOf(r);
            return (
              <PinCard
                key={r.id}
                resource={r}
                column={column.id}
                typeIndex={index}
                typeSize={size}
                selected={r.id != null && r.id === selectedId}
                onSelect={() => r.id != null && onSelect(r.id)}
                controls={controls}
              />
            );
          })
        )}
      </div>

      {canAdd && column.type && column.items.length > 0 && (
        <button
          type="button"
          className={styles.mrEColumnClear}
          onClick={() => column.type && controls.requestDeleteAll(column.type)}
        >
          Xóa tất cả
        </button>
      )}
    </section>
  );
}

/* ---- inspector: bottom sheet (mobile) / side drawer (desktop) ---- */

interface InspectorProps {
  readonly resource: ResourceInfo;
  readonly typeIndex: number;
  readonly typeSize: number;
  readonly bands: FrequencyBandThresholds;
  readonly onClose: () => void;
  readonly controls: UseMockResourcesReturn;
}

function Inspector({ resource, typeIndex, typeSize, bands, onClose, controls }: InspectorProps): ReactElement {
  const [term, setTerm] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const enabled = resource.enabled !== false;
  const isDict = resource.type === 'DICTIONARY';

  const lookup = (): void => {
    const q = term.trim();
    setResult(q ? `"${q}" → hạng #${fakeRank(q, resource).toLocaleString('en-US')}` : null);
  };

  const commit = (key: keyof FrequencyBandThresholds, raw: string): void => {
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 0) return;
    controls.setBands({ ...bands, [key]: n });
  };

  return (
    <aside className={styles.mrEInspector} aria-label={`Chi tiết ${resource.name}`}>
      <header className={styles.mrEInspectorHead}>
        <span className={styles.mrEInspectorIcon} data-type={isDict ? 'dict' : 'freq'}>
          <Icon name={isDict ? 'bookOpen' : 'library'} size="sm" />
        </span>
        <div className={styles.mrEInspectorTitle}>
          <span className={styles.mrEInspectorName}>{resource.name}</span>
          <span className={styles.mrEInspectorMeta}>{formatResourceMeta(resource)}</span>
        </div>
        <button
          type="button"
          className={styles.mrEIconBtn}
          onClick={onClose}
          aria-label="Đóng chi tiết"
        >
          <Icon name="x" size="xs" />
        </button>
      </header>

      <div className={styles.mrEInspectorBody}>
        <div className={styles.mrEProfile}>
          <div className={styles.mrEProfileRow}>
            <span className={styles.mrEProfileKey}>Loại</span>
            <span className={styles.mrEProfileVal}>{SECTION_COPY[resource.type].title}</span>
          </div>
          <div className={styles.mrEProfileRow}>
            <span className={styles.mrEProfileKey}>Định dạng</span>
            <span className={styles.mrEProfileVal}>{resource.format}</span>
          </div>
          <div className={styles.mrEProfileRow}>
            <span className={styles.mrEProfileKey}>Số từ</span>
            <span className={styles.mrEProfileVal}>{resource.wordCount.toLocaleString('en-US')}</span>
          </div>
          <div className={styles.mrEProfileRow}>
            <span className={styles.mrEProfileKey}>Trạng thái</span>
            <span className={styles.mrEProfileVal}>{enabled ? 'Đang dùng' : 'Tạm tắt'}</span>
          </div>
          {typeIndex >= 0 && (
            <div className={styles.mrEProfileRow}>
              <span className={styles.mrEProfileKey}>Ưu tiên</span>
              <span className={styles.mrEProfileVal}>{typeIndex + 1}/{typeSize}</span>
            </div>
          )}
        </div>

        <div className={styles.mrESection}>
          <span className={styles.mrESectionLabel}>Từ mẫu</span>
          <div className={styles.mrESample}>
            {SAMPLE_TERMS.map((t) => (
              <span key={t} className={styles.mrESampleTerm}>{t}</span>
            ))}
          </div>
        </div>

        <div className={styles.mrESection}>
          <span className={styles.mrESectionLabel}>Thử tra</span>
          <div className={styles.mrETest}>
            <input
              className={styles.mrETestInput}
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') lookup(); }}
              placeholder="Nhập từ…"
              aria-label={`Thử tra từ trong ${resource.name}`}
            />
            <Button variant="outline" size="sm" onClick={lookup}>
              Tra
            </Button>
          </div>
          {result && <p className={styles.mrETestResult} role="status">{result}</p>}
        </div>

        <div className={styles.mrESection}>
          <span className={styles.mrESectionLabel}>
            <Icon name="slidersHorizontal" size="xs" />
            Ngưỡng độ phổ biến
          </span>
          <div className={styles.mrEBandGrid}>
            {BAND_FIELDS.map(({ key, label }) => (
              <label key={key} className={styles.mrEBandField}>
                <span className={styles.mrEBandLabel}>{label}</span>
                <input
                  type="number"
                  className={styles.mrEBandInput}
                  min={0}
                  step={100}
                  value={bands[key]}
                  onChange={(e) => commit(key, e.target.value)}
                />
              </label>
            ))}
          </div>
        </div>
      </div>

      <footer className={styles.mrEInspectorFoot}>
        <Toggle
          size="md"
          checked={enabled}
          onChange={(next) => resource.id != null && controls.toggleResource(resource.id, next)}
          ariaLabel={enabled ? `Tắt ${resource.name}` : `Bật ${resource.name}`}
        />
        <span className={styles.mrEFootSpacer} />
        <Button
          variant="destructive"
          size="sm"
          leadingIcon={<Icon name="trash" size="xs" />}
          onClick={() => controls.requestDelete(resource)}
        >
          Xóa
        </Button>
      </footer>
    </aside>
  );
}

export function ConceptE({ controls }: ConceptProps): ReactElement {
  const { state } = controls;
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const typeIndexOf = (r: ResourceInfo): { index: number; size: number } => {
    const list = r.type === 'DICTIONARY' ? controls.dictionaries : controls.frequencies;
    return { index: list.findIndex((s) => s.id === r.id), size: list.length };
  };

  const enabled = (r: ResourceInfo): boolean => r.enabled !== false;

  const columns: ColumnDef[] = [
    {
      id: 'dict',
      title: SECTION_COPY.DICTIONARY.title,
      subtitle: SECTION_COPY.DICTIONARY.subtitle,
      icon: 'bookOpen',
      type: 'DICTIONARY',
      items: controls.dictionaries.filter(enabled),
    },
    {
      id: 'freq',
      title: SECTION_COPY.FREQUENCY.title,
      subtitle: SECTION_COPY.FREQUENCY.subtitle,
      icon: 'library',
      type: 'FREQUENCY',
      items: controls.frequencies.filter(enabled),
    },
    {
      id: 'off',
      title: 'Tạm tắt',
      subtitle: 'Đã ghim sang một bên — bật lại để dùng.',
      icon: 'pause',
      type: null,
      items: state.resources.filter((r) => !enabled(r)),
    },
  ];

  const selected = state.resources.find((r) => r.id === selectedId) ?? null;

  return (
    <div className={styles.mrEFrame}>
      <header className={styles.mrEHeader}>
        <Heading level={2} size={3} className={styles.mrETitle}>Resources</Heading>
        <Text as="p" color="secondary" className={styles.mrESub}>
          Bảng ghim — chạm một thẻ để xem chi tiết, chuyển cột bằng nút.
        </Text>
      </header>

      <BoardAlerts type="DICTIONARY" importState={state.importStates.DICTIONARY} controls={controls} />
      <BoardAlerts type="FREQUENCY" importState={state.importStates.FREQUENCY} controls={controls} />

      <div className={styles.mrEBody}>
        <div className={styles.mrEBoard}>
          {columns.map((col) => (
            <PinColumn
              key={col.id}
              column={col}
              importState={col.type ? state.importStates[col.type] : null}
              selectedId={selectedId}
              onSelect={(id) => setSelectedId((prev) => (prev === id ? null : id))}
              typeIndexOf={typeIndexOf}
              controls={controls}
            />
          ))}
        </div>

        {selected && (
          <Inspector
            resource={selected}
            typeIndex={typeIndexOf(selected).index}
            typeSize={typeIndexOf(selected).size}
            bands={state.bands}
            onClose={() => setSelectedId(null)}
            controls={controls}
          />
        )}
      </div>

      {state.deleteTarget && (
        <DeleteConfirmModal
          resource={state.deleteTarget}
          onConfirm={() => {
            if (state.deleteTarget?.id === selectedId) setSelectedId(null);
            controls.confirmDelete();
          }}
          onCancel={controls.cancelDelete}
        />
      )}
      {state.deleteAllTarget && (
        <DeleteConfirmModal
          title={`Xóa tất cả ${state.resources.filter((r) => r.type === state.deleteAllTarget).length} ${SECTION_COPY[state.deleteAllTarget].noun}?`}
          description={`Xóa vĩnh viễn toàn bộ ${SECTION_COPY[state.deleteAllTarget].noun} trong mục này và dữ liệu của chúng.`}
          onConfirm={() => {
            if (selected && selected.type === state.deleteAllTarget) setSelectedId(null);
            controls.confirmDeleteAll();
          }}
          onCancel={controls.cancelDelete}
        />
      )}
    </div>
  );
}
