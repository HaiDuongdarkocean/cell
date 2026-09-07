// Concept G — Catalog Storefront (app-store shelf).
//
// IA: a tiny store — a search bar and category tabs (Tất cả / Từ điển /
// Độ phổ biến / Đã cài) sit above a grid of product cards. Each card has
// a tinted icon tile, name, description, word count, format badge, and an
// install-style toggle. Tapping a card opens a product sheet — bottom
// sheet on narrow stages, side panel on wide ones — with a preview, a
// lookup tester, and a Preferences block for the frequency bands.
// No shared layout helpers — this file owns its own structure.

import { useMemo, useState, type ReactElement } from 'react';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { Heading } from '@/shared/ui/Heading';
import { Icon } from '@/shared/ui/Icon';
import { Progress } from '@/shared/ui/Progress';
import { Text } from '@/shared/ui/Text';
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

type TabId = 'all' | 'DICTIONARY' | 'FREQUENCY' | 'installed';

const TABS: readonly { id: TabId; label: string }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'DICTIONARY', label: 'Từ điển' },
  { id: 'FREQUENCY', label: 'Độ phổ biến' },
  { id: 'installed', label: 'Đã cài' },
];

/* ---- store-level alerts for one resource type ---- */

function StoreAlerts({ type, importState, controls }: { readonly type: ResourceType; readonly importState: MockSectionImport; readonly controls: UseMockResourcesReturn }): ReactElement | null {
  if (!importState.error && !importState.success && !importState.duplicate) return null;
  return (
    <div className={styles.mrGAlerts}>
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
            <span className={styles.mrGDupBody}>
              <span>
                Đã có sẵn &quot;{importState.duplicate.existingName}&quot; — chọn thay thế hoặc bỏ qua.
              </span>
              <span className={styles.mrGDupActions}>
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

/* ---- an in-flight import shown as an installing product card ---- */

function InstallingCard({ type, importState }: { readonly type: ResourceType; readonly importState: MockSectionImport }): ReactElement {
  const copy = SECTION_COPY[type];
  return (
    <div className={styles.mrGCard} data-type={type === 'DICTIONARY' ? 'dict' : 'freq'}>
      <div className={styles.mrGCardRow}>
        <span className={styles.mrGIconTile}>
          <Icon name="loader" size="sm" />
        </span>
        <div className={styles.mrGCardText}>
          <span className={styles.mrGCardName}>{importState.pendingName ?? copy.dropLabel}</span>
          <span className={styles.mrGCardSub}>Đang cài…</span>
        </div>
        <span className={styles.mrGInstallMeta}>
          {Math.round((importState.progress / Math.max(importState.progressTotal, 1)) * 100)}%
        </span>
      </div>
      <Progress
        value={importState.progress}
        max={importState.progressTotal}
        size="sm"
        aria-label={`Đang thêm ${copy.title}`}
      />
    </div>
  );
}

/* ---- one product card ---- */

interface ProductCardProps {
  readonly resource: ResourceInfo;
  readonly onOpen: () => void;
  readonly controls: UseMockResourcesReturn;
}

function ProductCard({ resource, onOpen, controls }: ProductCardProps): ReactElement {
  const enabled = resource.enabled !== false;
  const isDict = resource.type === 'DICTIONARY';
  const copy = SECTION_COPY[resource.type];

  return (
    <div className={styles.mrGCard} data-type={isDict ? 'dict' : 'freq'}>
      <button
        type="button"
        className={styles.mrGCardRow}
        onClick={onOpen}
        aria-label={`Xem ${resource.name}`}
      >
        <span className={styles.mrGIconTile}>
          <Icon name={isDict ? 'bookOpen' : 'library'} size="sm" />
        </span>
        <span className={styles.mrGCardText}>
          <span className={styles.mrGCardName}>{resource.name}</span>
          <span className={styles.mrGCardSub}>{copy.subtitle}</span>
        </span>
      </button>

      <div className={styles.mrGCardMeta}>
        <span className={styles.mrGBadge}>{isDict ? 'Từ điển' : 'Tần suất'}</span>
        <span className={styles.mrGBadgeFormat}>{resource.format}</span>
        {enabled && (
          <span className={styles.mrGBadgeInstalled}>
            <Icon name="check" size="xs" />
            Đã cài
          </span>
        )}
      </div>

      <div className={styles.mrGCardFoot}>
        <span className={styles.mrGCardCount}>
          {resource.wordCount.toLocaleString('en-US')} từ
        </span>
        <span className={styles.mrGFootSpacer} />
        <button
          type="button"
          className={styles.mrGIconBtn}
          onClick={() => controls.requestDelete(resource)}
          aria-label={`Gỡ hẳn ${resource.name}`}
        >
          <Icon name="trash" size="xs" />
        </button>
        <Button
          variant={enabled ? 'outline' : 'primary'}
          size="sm"
          leadingIcon={enabled ? <Icon name="check" size="xs" /> : <Icon name="download" size="xs" />}
          onClick={() => resource.id != null && controls.toggleResource(resource.id, !enabled)}
        >
          {enabled ? 'Đã cài' : 'Cài đặt'}
        </Button>
      </div>
    </div>
  );
}

/* ---- product sheet: bottom sheet (mobile) / side panel (desktop) ---- */

interface ProductSheetProps {
  readonly resource: ResourceInfo;
  readonly bands: FrequencyBandThresholds;
  readonly onClose: () => void;
  readonly controls: UseMockResourcesReturn;
}

function ProductSheet({ resource, bands, onClose, controls }: ProductSheetProps): ReactElement {
  const [term, setTerm] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const enabled = resource.enabled !== false;
  const isDict = resource.type === 'DICTIONARY';
  const copy = SECTION_COPY[resource.type];
  const siblings = isDict ? controls.dictionaries : controls.frequencies;
  const typeIndex = siblings.findIndex((s) => s.id === resource.id);

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
    <aside className={styles.mrGSheet} aria-label={`Chi tiết ${resource.name}`}>
      <header className={styles.mrGSheetHead} data-type={isDict ? 'dict' : 'freq'}>
        <span className={styles.mrGSheetIcon}>
          <Icon name={isDict ? 'bookOpen' : 'library'} size="md" />
        </span>
        <div className={styles.mrGSheetTitle}>
          <span className={styles.mrGSheetName}>{resource.name}</span>
          <span className={styles.mrGSheetMeta}>{formatResourceMeta(resource)}</span>
        </div>
        <button
          type="button"
          className={styles.mrGIconBtn}
          onClick={onClose}
          aria-label="Đóng chi tiết"
        >
          <Icon name="x" size="xs" />
        </button>
      </header>

      <div className={styles.mrGSheetBody}>
        <p className={styles.mrGSheetDesc}>
          {copy.subtitle} Định dạng {resource.format} · {resource.wordCount.toLocaleString('en-US')} từ.
        </p>

        <Button
          variant={enabled ? 'outline' : 'primary'}
          size="md"
          fullWidth
          leadingIcon={enabled ? <Icon name="check" size="xs" /> : <Icon name="download" size="xs" />}
          onClick={() => resource.id != null && controls.toggleResource(resource.id, !enabled)}
        >
          {enabled ? 'Đã cài — chạm để gỡ' : 'Cài đặt'}
        </Button>

        {siblings.length > 1 && typeIndex >= 0 && (
          <div className={styles.mrGPriority}>
            <span className={styles.mrGPriorityLabel}>
              Ưu tiên {typeIndex + 1}/{siblings.length} trong {copy.noun}
            </span>
            <span className={styles.mrGPriorityActions}>
              <button
                type="button"
                className={styles.mrGIconBtn}
                onClick={() => controls.moveResource(resource.type, typeIndex, -1)}
                disabled={typeIndex === 0}
                aria-label={`Nâng ưu tiên ${resource.name}`}
              >
                <Icon name="chevronDown" size="xs" style={{ transform: 'rotate(180deg)' }} />
              </button>
              <button
                type="button"
                className={styles.mrGIconBtn}
                onClick={() => controls.moveResource(resource.type, typeIndex, 1)}
                disabled={typeIndex === siblings.length - 1}
                aria-label={`Hạ ưu tiên ${resource.name}`}
              >
                <Icon name="chevronDown" size="xs" />
              </button>
            </span>
          </div>
        )}

        <div className={styles.mrGSection}>
          <span className={styles.mrGSectionLabel}>Xem trước</span>
          <div className={styles.mrGSample}>
            {SAMPLE_TERMS.map((t) => (
              <span key={t} className={styles.mrGSampleTerm}>{t}</span>
            ))}
          </div>
        </div>

        <div className={styles.mrGSection}>
          <span className={styles.mrGSectionLabel}>Thử tra</span>
          <div className={styles.mrGTest}>
            <input
              className={styles.mrGTestInput}
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
          {result && <p className={styles.mrGTestResult} role="status">{result}</p>}
        </div>

        <div className={styles.mrGSection}>
          <span className={styles.mrGSectionLabel}>
            <Icon name="slidersHorizontal" size="xs" />
            Preferences — ngưỡng độ phổ biến
          </span>
          <div className={styles.mrGBandGrid}>
            {BAND_FIELDS.map(({ key, label }) => (
              <label key={key} className={styles.mrGBandField}>
                <span className={styles.mrGBandLabel}>{label}</span>
                <input
                  type="number"
                  className={styles.mrGBandInput}
                  min={0}
                  step={100}
                  value={bands[key]}
                  onChange={(e) => commit(key, e.target.value)}
                />
              </label>
            ))}
          </div>
        </div>

        <button
          type="button"
          className={styles.mrGRemove}
          onClick={() => controls.requestDelete(resource)}
        >
          <Icon name="trash" size="xs" />
          Gỡ hẳn khỏi thư viện
        </button>
      </div>
    </aside>
  );
}

export function ConceptG({ controls }: ConceptProps): ReactElement {
  const { state } = controls;
  const [tab, setTab] = useState<TabId>('all');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.resources
      .filter((r) => (tab === 'all' ? true : tab === 'installed' ? r.enabled !== false : r.type === tab))
      .filter((r) => (q ? r.name.toLowerCase().includes(q) : true))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [state.resources, tab, query]);

  const opened = state.resources.find((r) => r.id === openId) ?? null;
  const importingDict = state.importStates.DICTIONARY.importing;
  const importingFreq = state.importStates.FREQUENCY.importing;

  return (
    <div className={styles.mrGFrame}>
      <header className={styles.mrGHeader}>
        <Heading level={2} size={3} className={styles.mrGTitle}>
          <Icon name="layoutGrid" size="sm" />
          Resource Store
        </Heading>
        <div className={styles.mrGHeaderActions}>
          <Button
            variant="outline"
            size="sm"
            leadingIcon={<Icon name="plus" size="xs" />}
            disabled={importingDict}
            onClick={() => controls.simulateImport('DICTIONARY')}
          >
            Thêm từ điển
          </Button>
          <Button
            variant="outline"
            size="sm"
            leadingIcon={<Icon name="plus" size="xs" />}
            disabled={importingFreq}
            onClick={() => controls.simulateImport('FREQUENCY')}
          >
            Thêm danh sách
          </Button>
        </div>
      </header>

      <div className={styles.mrGSearch}>
        <Icon name="search" size="xs" color="secondary" />
        <input
          className={styles.mrGSearchInput}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm tài nguyên…"
          aria-label="Tìm tài nguyên"
        />
        {query && (
          <button
            type="button"
            className={styles.mrGIconBtn}
            onClick={() => setQuery('')}
            aria-label="Xóa tìm kiếm"
          >
            <Icon name="x" size="xs" />
          </button>
        )}
      </div>

      <div className={styles.mrGTabs} role="tablist" aria-label="Danh mục">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={styles.mrGTab}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <StoreAlerts type="DICTIONARY" importState={state.importStates.DICTIONARY} controls={controls} />
      <StoreAlerts type="FREQUENCY" importState={state.importStates.FREQUENCY} controls={controls} />

      <div className={styles.mrGBody}>
        <div className={styles.mrGMain}>
          <div className={styles.mrGGrid} role="list">
            {importingDict && (tab === 'all' || tab === 'DICTIONARY') && (
              <InstallingCard type="DICTIONARY" importState={state.importStates.DICTIONARY} />
            )}
            {importingFreq && (tab === 'all' || tab === 'FREQUENCY') && (
              <InstallingCard type="FREQUENCY" importState={state.importStates.FREQUENCY} />
            )}
            {visible.length === 0 && !importingDict && !importingFreq && (
              <p className={styles.mrGEmpty}>
                {query ? `Không có kết quả cho "${query}".` : 'Chưa có tài nguyên nào trong mục này.'}
              </p>
            )}
            {visible.map((r) => (
              <ProductCard
                key={r.id}
                resource={r}
                onOpen={() => r.id != null && setOpenId(r.id)}
                controls={controls}
              />
            ))}
          </div>

          <footer className={styles.mrGFooter}>
            <Text as="span" color="secondary" className={styles.mrGFooterNote}>
              {visible.length} mục · {state.resources.filter((r) => r.enabled !== false).length} đã cài
            </Text>
            <span className={styles.mrGFootSpacer} />
            {controls.dictionaries.length > 0 && (
              <button
                type="button"
                className={styles.mrGClearBtn}
                onClick={() => controls.requestDeleteAll('DICTIONARY')}
              >
                Xóa tất cả từ điển
              </button>
            )}
            {controls.frequencies.length > 0 && (
              <button
                type="button"
                className={styles.mrGClearBtn}
                onClick={() => controls.requestDeleteAll('FREQUENCY')}
              >
                Xóa tất cả danh sách
              </button>
            )}
          </footer>
        </div>

        {opened && (
          <ProductSheet
            resource={opened}
            bands={state.bands}
            onClose={() => setOpenId(null)}
            controls={controls}
          />
        )}
      </div>

      {state.deleteTarget && (
        <DeleteConfirmModal
          resource={state.deleteTarget}
          onConfirm={() => {
            if (state.deleteTarget?.id === openId) setOpenId(null);
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
            if (opened && opened.type === state.deleteAllTarget) setOpenId(null);
            controls.confirmDeleteAll();
          }}
          onCancel={controls.cancelDelete}
        />
      )}
    </div>
  );
}
