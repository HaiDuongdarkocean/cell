// Concept B — Bento Garden (dashboard bento tiles).
//
// IA: a bento box — each resource kind is a colored tile you open, fill, and
// rearrange. Grid of solid tiles with tinted top borders, compact labels,
// counts up front, and tuning (frequency bands) as its own tile.
// No shared layout helpers — this file owns its own structure.

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

/* ---- expanded detail inside a tile row ---- */

function TileDetail({ resource }: { readonly resource: ResourceInfo }): ReactElement {
  const [term, setTerm] = useState('');
  const [result, setResult] = useState<string | null>(null);

  const lookup = (): void => {
    const q = term.trim();
    setResult(q ? `"${q}" → #${fakeRank(q, resource).toLocaleString('en-US')}` : null);
  };

  return (
    <div className={styles.mrBDetail}>
      <div className={styles.mrBSample}>
        {SAMPLE_TERMS.slice(0, 4).map((t) => (
          <span key={t} className={styles.mrBSampleTerm}>{t}</span>
        ))}
      </div>
      <div className={styles.mrBTest}>
        <input
          className={styles.mrBTestInput}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') lookup(); }}
          placeholder="Thử tra…"
          aria-label={`Thử tra từ trong ${resource.name}`}
        />
        <Button variant="secondary" size="sm" onClick={lookup}>
          Tra
        </Button>
      </div>
      {result && <p className={styles.mrBTestResult} role="status">{result}</p>}
    </div>
  );
}

/* ---- one compact row inside a tile ---- */

interface TileRowProps {
  readonly resource: ResourceInfo;
  readonly index: number;
  readonly sectionSize: number;
  readonly expanded: boolean;
  readonly onToggleExpand: () => void;
  readonly controls: UseMockResourcesReturn;
}

function TileRow({ resource, index, sectionSize, expanded, onToggleExpand, controls }: TileRowProps): ReactElement {
  const enabled = resource.enabled !== false;

  return (
    <div className={`${styles.mrBRow} ${expanded ? styles.mrBRowOpen : ''}`}>
      <div className={`${styles.mrBRowLine} ${enabled ? '' : styles.mrBRowDisabled}`}>
        <button
          type="button"
          className={styles.mrBRowToggle}
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

        <div className={styles.mrBRowInfo}>
          <span className={styles.mrBRowName}>{resource.name}</span>
          <span className={styles.mrBRowMeta}>{formatResourceMeta(resource)}</span>
        </div>

        {sectionSize > 1 && (
          <div className={styles.mrBReorder}>
            <button
              type="button"
              className={styles.mrBMiniBtn}
              onClick={() => controls.moveResource(resource.type, index, -1)}
              disabled={index === 0}
              aria-label={`Nâng ưu tiên ${resource.name}`}
            >
              <Icon name="chevronDown" size="xs" style={{ transform: 'rotate(180deg)' }} />
            </button>
            <button
              type="button"
              className={styles.mrBMiniBtn}
              onClick={() => controls.moveResource(resource.type, index, 1)}
              disabled={index === sectionSize - 1}
              aria-label={`Hạ ưu tiên ${resource.name}`}
            >
              <Icon name="chevronDown" size="xs" />
            </button>
          </div>
        )}

        <Toggle
          size="sm"
          checked={enabled}
          onChange={(next) => resource.id != null && controls.toggleResource(resource.id, next)}
          ariaLabel={enabled ? `Tắt ${resource.name}` : `Bật ${resource.name}`}
        />

        <button
          type="button"
          className={styles.mrBMiniBtn}
          onClick={() => controls.requestDelete(resource)}
          aria-label={`Xóa ${resource.name}`}
        >
          <Icon name="trash" size="xs" />
        </button>
      </div>

      {expanded && <TileDetail resource={resource} />}
    </div>
  );
}

/* ---- a bento tile for one resource kind ---- */

interface ResourceTileProps {
  readonly type: ResourceType;
  readonly accent: 'dict' | 'freq';
  readonly icon: 'bookOpen' | 'library';
  readonly resources: readonly ResourceInfo[];
  readonly importState: MockSectionImport;
  readonly expandedIds: ReadonlySet<number>;
  readonly onToggleExpand: (id: number) => void;
  readonly controls: UseMockResourcesReturn;
}

function ResourceTile({ type, accent, icon, resources, importState, expandedIds, onToggleExpand, controls }: ResourceTileProps): ReactElement {
  const copy = SECTION_COPY[type];
  const activeCount = resources.filter((r) => r.enabled !== false).length;

  return (
    <section className={styles.mrBTile} data-accent={accent}>
      <header className={styles.mrBTileHead}>
        <span className={styles.mrBTileIcon}>
          <Icon name={icon} size="sm" />
        </span>
        <div className={styles.mrBTileText}>
          <span className={styles.mrBTileTitle}>{copy.title}</span>
          <span className={styles.mrBTileSub}>{copy.subtitle}</span>
        </div>
        <span className={styles.mrBCount} aria-label={`${resources.length} mục`}>
          {activeCount}<span className={styles.mrBCountTotal}>/{resources.length}</span>
        </span>
      </header>

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
            <span className={styles.mrBDupBody}>
              <span>Trùng &quot;{importState.duplicate.existingName}&quot;.</span>
              <span className={styles.mrBDupActions}>
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

      {importState.importing && (
        <div className={styles.mrBProgress}>
          <Progress
            value={importState.progress}
            max={importState.progressTotal}
            size="sm"
            aria-label={`Đang thêm ${copy.title}`}
          />
          <span className={styles.mrBProgressLabel}>
            {importState.pendingName ?? copy.dropLabel} · {importState.progress}/{importState.progressTotal}
          </span>
        </div>
      )}

      {resources.length === 0 ? (
        <p className={styles.mrBEmpty}>{copy.empty}</p>
      ) : (
        <div className={styles.mrBList} role="list">
          {resources.map((r, i) => (
            <TileRow
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

      <div className={styles.mrBTileFoot}>
        <Button
          variant="outline"
          size="sm"
          fullWidth
          leadingIcon={<Icon name="plus" size="xs" />}
          disabled={importState.importing}
          onClick={() => controls.simulateImport(type)}
        >
          {copy.dropLabel}
        </Button>
        {resources.length > 0 && (
          <button
            type="button"
            className={styles.mrBClear}
            onClick={() => controls.requestDeleteAll(type)}
          >
            Xóa tất cả
          </button>
        )}
      </div>
    </section>
  );
}

/* ---- the tuning tile (frequency bands) ---- */

function TuningTile({ bands, onChange }: { readonly bands: FrequencyBandThresholds; readonly onChange: (b: FrequencyBandThresholds) => void }): ReactElement {
  const commit = (key: keyof FrequencyBandThresholds, raw: string): void => {
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 0) return;
    onChange({ ...bands, [key]: n });
  };

  return (
    <section className={`${styles.mrBTile} ${styles.mrBTileWide}`} data-accent="tune">
      <header className={styles.mrBTileHead}>
        <span className={styles.mrBTileIcon}>
          <Icon name="slidersHorizontal" size="sm" />
        </span>
        <div className={styles.mrBTileText}>
          <span className={styles.mrBTileTitle}>Ngưỡng tần suất</span>
          <span className={styles.mrBTileSub}>Phân nhóm từ hay gặp theo hạng</span>
        </div>
      </header>
      <div className={styles.mrBBandGrid}>
        {BAND_FIELDS.map(({ key, label }) => (
          <label key={key} className={styles.mrBBandField}>
            <span className={styles.mrBBandLabel}>{label}</span>
            <input
              type="number"
              className={styles.mrBBandInput}
              min={0}
              step={100}
              value={bands[key]}
              onChange={(e) => commit(key, e.target.value)}
            />
          </label>
        ))}
      </div>
    </section>
  );
}

export function ConceptB({ controls }: ConceptProps): ReactElement {
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
    <div className={styles.mrBFrame}>
      <header className={styles.mrBTop}>
        <Heading level={2} size={3} className={styles.mrBTitle}>Resources</Heading>
        <Text as="p" color="secondary" className={styles.mrBSub}>
          {controls.dictionaries.length} từ điển · {controls.frequencies.length} danh sách tần suất
        </Text>
      </header>

      <div className={styles.mrBGrid}>
        <ResourceTile
          type="DICTIONARY"
          accent="dict"
          icon="bookOpen"
          resources={controls.dictionaries}
          importState={state.importStates.DICTIONARY}
          expandedIds={expandedIds}
          onToggleExpand={toggleExpand}
          controls={controls}
        />
        <ResourceTile
          type="FREQUENCY"
          accent="freq"
          icon="library"
          resources={controls.frequencies}
          importState={state.importStates.FREQUENCY}
          expandedIds={expandedIds}
          onToggleExpand={toggleExpand}
          controls={controls}
        />
        <TuningTile bands={state.bands} onChange={controls.setBands} />
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
