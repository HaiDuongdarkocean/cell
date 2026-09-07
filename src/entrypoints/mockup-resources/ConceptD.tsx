// Concept D — River Stream (chronological feed).
//
// IA: one calm river — every resource flows in a single chronological
// stream, newest at the top, grouped by day (Hôm nay / Hôm qua / Cũ hơn).
// A floating composer at the bottom-right adds new drops to the stream,
// and a bands strip reads like the riverbed along the bottom. Soft cards,
// quiet shadows, watery blue/cyan tints. No shared layout helpers — this
// file owns its own structure.

import { useMemo, useState, type ReactElement } from 'react';
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

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

type GroupKey = 'today' | 'yesterday' | 'older';

const GROUP_LABELS: Record<GroupKey, string> = {
  today: 'Hôm nay',
  yesterday: 'Hôm qua',
  older: 'Cũ hơn',
};

function groupOf(importedAt: number | undefined, todayStart: number): GroupKey {
  const ts = importedAt ?? 0;
  if (ts >= todayStart) return 'today';
  if (ts >= todayStart - DAY_MS) return 'yesterday';
  return 'older';
}

/* ---- expanded detail: sample terms + lookup tester + priority ---- */

interface StreamDetailProps {
  readonly resource: ResourceInfo;
  readonly typeIndex: number;
  readonly typeSize: number;
  readonly controls: UseMockResourcesReturn;
}

function StreamDetail({ resource, typeIndex, typeSize, controls }: StreamDetailProps): ReactElement {
  const [term, setTerm] = useState('');
  const [result, setResult] = useState<string | null>(null);

  const lookup = (): void => {
    const q = term.trim();
    setResult(q ? `"${q}" → hạng #${fakeRank(q, resource).toLocaleString('en-US')}` : null);
  };

  return (
    <div className={styles.mrDDetail}>
      <div className={styles.mrDSample}>
        {SAMPLE_TERMS.map((t) => (
          <span key={t} className={styles.mrDSampleTerm}>{t}</span>
        ))}
      </div>
      <div className={styles.mrDTest}>
        <input
          className={styles.mrDTestInput}
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
      {result && <p className={styles.mrDTestResult} role="status">{result}</p>}
      {typeSize > 1 && typeIndex >= 0 && (
        <div className={styles.mrDPriority}>
          <span className={styles.mrDPriorityLabel}>
            Ưu tiên {typeIndex + 1}/{typeSize} trong {SECTION_COPY[resource.type].noun}
          </span>
          <span className={styles.mrDPriorityActions}>
            <button
              type="button"
              className={styles.mrDIconBtn}
              onClick={() => controls.moveResource(resource.type, typeIndex, -1)}
              disabled={typeIndex === 0}
              aria-label={`Nâng ưu tiên ${resource.name}`}
            >
              <Icon name="chevronDown" size="xs" style={{ transform: 'rotate(180deg)' }} />
            </button>
            <button
              type="button"
              className={styles.mrDIconBtn}
              onClick={() => controls.moveResource(resource.type, typeIndex, 1)}
              disabled={typeIndex === typeSize - 1}
              aria-label={`Hạ ưu tiên ${resource.name}`}
            >
              <Icon name="chevronDown" size="xs" />
            </button>
          </span>
        </div>
      )}
    </div>
  );
}

/* ---- one drop in the stream ---- */

interface StreamCardProps {
  readonly resource: ResourceInfo;
  readonly typeIndex: number;
  readonly typeSize: number;
  readonly expanded: boolean;
  readonly onToggleExpand: () => void;
  readonly controls: UseMockResourcesReturn;
}

function StreamCard({ resource, typeIndex, typeSize, expanded, onToggleExpand, controls }: StreamCardProps): ReactElement {
  const enabled = resource.enabled !== false;
  const isDict = resource.type === 'DICTIONARY';

  return (
    <div
      className={`${styles.mrDCard} ${enabled ? '' : styles.mrDCardDisabled}`}
      data-type={isDict ? 'dict' : 'freq'}
      role="listitem"
    >
      <div className={styles.mrDCardRow}>
        <span className={styles.mrDBadge}>
          <Icon name={isDict ? 'bookOpen' : 'library'} size="xs" />
          {isDict ? 'Từ điển' : 'Tần suất'}
        </span>

        <div className={styles.mrDCardInfo}>
          <span className={styles.mrDCardName}>{resource.name}</span>
          <span className={styles.mrDCardMeta}>{formatResourceMeta(resource)}</span>
        </div>

        <Toggle
          size="md"
          checked={enabled}
          onChange={(next) => resource.id != null && controls.toggleResource(resource.id, next)}
          ariaLabel={enabled ? `Tắt ${resource.name}` : `Bật ${resource.name}`}
        />

        <button
          type="button"
          className={styles.mrDIconBtn}
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

        <button
          type="button"
          className={`${styles.mrDIconBtn} ${styles.mrDIconBtnDanger}`}
          onClick={() => controls.requestDelete(resource)}
          aria-label={`Xóa ${resource.name}`}
        >
          <Icon name="trash" size="xs" />
        </button>
      </div>

      {expanded && (
        <StreamDetail
          resource={resource}
          typeIndex={typeIndex}
          typeSize={typeSize}
          controls={controls}
        />
      )}
    </div>
  );
}

/* ---- an in-flight import drifting into the stream ---- */

function InflowCard({ type, importState }: { readonly type: ResourceType; readonly importState: MockSectionImport }): ReactElement {
  const copy = SECTION_COPY[type];
  return (
    <div className={styles.mrDInflow} data-type={type === 'DICTIONARY' ? 'dict' : 'freq'}>
      <span className={styles.mrDBadge}>
        <Icon name="loader" size="xs" />
        {copy.title}
      </span>
      <div className={styles.mrDInflowBody}>
        <span className={styles.mrDInflowLabel}>
          Đang thêm{importState.pendingName ? ` "${importState.pendingName}"` : ''}…
        </span>
        <Progress
          value={importState.progress}
          max={importState.progressTotal}
          size="sm"
          aria-label={`Đang thêm ${copy.title}`}
        />
        <span className={styles.mrDInflowMeta}>
          {importState.progress} / {importState.progressTotal} mục
        </span>
      </div>
    </div>
  );
}

/* ---- bands strip — the riverbed at the bottom ---- */

function BandsStrip({ bands, onChange }: { readonly bands: FrequencyBandThresholds; readonly onChange: (b: FrequencyBandThresholds) => void }): ReactElement {
  const commit = (key: keyof FrequencyBandThresholds, raw: string): void => {
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 0) return;
    onChange({ ...bands, [key]: n });
  };

  return (
    <footer className={styles.mrDBands}>
      <span className={styles.mrDBandsLabel}>
        <Icon name="slidersHorizontal" size="xs" />
        Ngưỡng độ phổ biến
      </span>
      <div className={styles.mrDBandGrid}>
        {BAND_FIELDS.map(({ key, label }) => (
          <label key={key} className={styles.mrDBandField}>
            <span className={styles.mrDBandLabel}>{label}</span>
            <input
              type="number"
              className={styles.mrDBandInput}
              min={0}
              step={100}
              value={bands[key]}
              onChange={(e) => commit(key, e.target.value)}
            />
          </label>
        ))}
      </div>
    </footer>
  );
}

/* ---- per-type alerts rendered above the stream ---- */

function StreamAlerts({ type, importState, controls }: { readonly type: ResourceType; readonly importState: MockSectionImport; readonly controls: UseMockResourcesReturn }): ReactElement | null {
  if (!importState.error && !importState.success && !importState.duplicate) return null;
  return (
    <div className={styles.mrDAlerts}>
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
            <span className={styles.mrDDupBody}>
              <span>
                Đã có sẵn &quot;{importState.duplicate.existingName}&quot; — chọn thay thế hoặc bỏ qua.
              </span>
              <span className={styles.mrDDupActions}>
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

export function ConceptD({ controls }: ConceptProps): ReactElement {
  const { state } = controls;
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<number>>(new Set());
  const [fabOpen, setFabOpen] = useState(false);

  const toggleExpand = (id: number): void => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // One chronological stream — newest imports float to the top.
  const grouped = useMemo(() => {
    const todayStart = startOfDay(Date.now());
    const sorted = [...state.resources].sort(
      (a, b) => (b.importedAt ?? 0) - (a.importedAt ?? 0),
    );
    const groups: Record<GroupKey, ResourceInfo[]> = { today: [], yesterday: [], older: [] };
    for (const r of sorted) groups[groupOf(r.importedAt, todayStart)].push(r);
    return (Object.keys(GROUP_LABELS) as GroupKey[])
      .map((key) => ({ key, label: GROUP_LABELS[key], items: groups[key] }))
      .filter((g) => g.items.length > 0);
  }, [state.resources]);

  const typeIndexOf = (r: ResourceInfo): { index: number; size: number } => {
    const list = r.type === 'DICTIONARY' ? controls.dictionaries : controls.frequencies;
    return { index: list.findIndex((s) => s.id === r.id), size: list.length };
  };

  const importingDict = state.importStates.DICTIONARY.importing;
  const importingFreq = state.importStates.FREQUENCY.importing;

  const add = (type: ResourceType): void => {
    controls.simulateImport(type);
    setFabOpen(false);
  };

  return (
    <div className={styles.mrDFrame}>
      <header className={styles.mrDHeader}>
        <Heading level={2} size={3} className={styles.mrDTitle}>Resources</Heading>
        <Text as="p" color="secondary" className={styles.mrDDesc}>
          Dòng chảy tra cứu — mọi tài nguyên theo thứ tự thời gian.
        </Text>
      </header>

      <StreamAlerts type="DICTIONARY" importState={state.importStates.DICTIONARY} controls={controls} />
      <StreamAlerts type="FREQUENCY" importState={state.importStates.FREQUENCY} controls={controls} />

      <div className={styles.mrDStream} role="list">
        {(importingDict || importingFreq) && (
          <div className={styles.mrDGroup}>
            <span className={styles.mrDGroupLabel}>Đang chảy vào</span>
            {importingDict && <InflowCard type="DICTIONARY" importState={state.importStates.DICTIONARY} />}
            {importingFreq && <InflowCard type="FREQUENCY" importState={state.importStates.FREQUENCY} />}
          </div>
        )}

        {grouped.length === 0 && !importingDict && !importingFreq && (
          <p className={styles.mrDEmpty}>Dòng chảy đang trống — thêm tài nguyên để bắt đầu.</p>
        )}

        {grouped.map((group) => (
          <div key={group.key} className={styles.mrDGroup}>
            <span className={styles.mrDGroupLabel}>{group.label}</span>
            {group.items.map((r) => {
              const { index, size } = typeIndexOf(r);
              return (
                <StreamCard
                  key={r.id}
                  resource={r}
                  typeIndex={index}
                  typeSize={size}
                  expanded={r.id != null && expandedIds.has(r.id)}
                  onToggleExpand={() => r.id != null && toggleExpand(r.id)}
                  controls={controls}
                />
              );
            })}
          </div>
        ))}
      </div>

      <div className={styles.mrDManage}>
        {controls.dictionaries.length > 0 && (
          <button
            type="button"
            className={styles.mrDManageBtn}
            onClick={() => controls.requestDeleteAll('DICTIONARY')}
          >
            <Icon name="trash" size="xs" />
            Xóa tất cả từ điển
          </button>
        )}
        {controls.frequencies.length > 0 && (
          <button
            type="button"
            className={styles.mrDManageBtn}
            onClick={() => controls.requestDeleteAll('FREQUENCY')}
          >
            <Icon name="trash" size="xs" />
            Xóa tất cả danh sách
          </button>
        )}
      </div>

      <BandsStrip bands={state.bands} onChange={controls.setBands} />

      {/* Floating composer — sticks to the lower-right while the stream scrolls. */}
      <div className={styles.mrDFabWrap}>
        {fabOpen && (
          <div className={styles.mrDFabMenu} role="menu">
            <button
              type="button"
              className={styles.mrDFabItem}
              disabled={importingDict}
              onClick={() => add('DICTIONARY')}
            >
              <Icon name="bookOpen" size="xs" />
              Thêm từ điển
            </button>
            <button
              type="button"
              className={styles.mrDFabItem}
              disabled={importingFreq}
              onClick={() => add('FREQUENCY')}
            >
              <Icon name="library" size="xs" />
              Thêm danh sách
            </button>
          </div>
        )}
        <button
          type="button"
          className={styles.mrDFab}
          onClick={() => setFabOpen((v) => !v)}
          aria-expanded={fabOpen}
          aria-label={fabOpen ? 'Đóng menu thêm' : 'Thêm tài nguyên'}
        >
          <Icon
            name="plus"
            size="sm"
            color="inverse"
            style={fabOpen ? { transform: 'rotate(45deg)' } : undefined}
          />
        </button>
      </div>

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
