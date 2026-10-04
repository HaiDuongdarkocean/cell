// ResourceCard — resource list item (spec F11 + Resources management upgrade).
//
// Row: left-edge DragHandle (vertical 2×3 grip — drag = pointer reorder via
// the section's useSectionDrag, tap/Enter = opens the ⋮ menu; ArrowUp/Down =
// keyboard reorder; grip hidden in edit mode) · name (click = inline rename;
// section edit mode: toggles selection) · component chips · enable Toggle ·
// icon-only delete (edit mode only — the idle list carries no delete
// affordances). Menu → "Chi tiết" opens the detail dialog.
// Disabled resources are dimmed visually — controls stay usable.

import { useEffect, useRef, useState, type ReactElement } from 'react';
import { getLocale, t, type MessageKey } from '@/shared/i18n';
import { Card, Checkbox, Chip, Dialog, Input } from '@/shared/ui';
import { Button } from '@/shared/ui/Button';
import { DragHandle } from '@/shared/ui/DragHandle';
import { Menu, MenuItem } from '@/shared/ui/Menu';
import { Toggle } from '@/shared/ui/Toggle';
import { Spinner } from '@/shared/ui/Spinner';
import { Icon } from '@/shared/ui/Icon';
import {
  getResourceComponents,
  renameResource,
  setResourceComponents,
  setResourceEnabled,
} from '@/features/dictionary/services/resourceClient';
import type { DictionaryComponent, ResourceInfo } from '@/entities/dictionary';
import { displayResourceName } from './displayResourceName';
import type { ResourceImportProgress } from './importJobTypes';
import styles from './ResourceCard.module.css';

const COMPONENT_LABEL: Record<DictionaryComponent, MessageKey> = {
  definitions: 'resources.component.definitions',
  examples: 'resources.component.examples',
  translations: 'resources.component.translations',
  synonyms: 'resources.component.synonyms',
  pronunciation: 'resources.component.pronunciation',
  inflections: 'resources.component.inflections',
  etymology: 'resources.component.etymology',
  wordFamily: 'resources.component.wordFamily',
  wordNet: 'resources.component.wordNet',
  derivedTerms: 'resources.component.derivedTerms',
  related: 'resources.component.related',
  level: 'resources.component.level',
  frequencyStars: 'resources.component.frequencyStars',
  frequency: 'resources.component.frequency',
};

const GRIP_TAP_THRESHOLD = 4;

interface ResourceCardProps {
  readonly resource: ResourceInfo;
  /** Total resources in the section — reorder needs >1. */
  readonly sectionSize: number;
  readonly onDelete: () => void;
  /** Keyboard reorder within the section: -1 = up (higher priority), +1 = down. */
  readonly onMove?: (direction: -1 | 1) => void;
  /** Grip pointerdown → the section's useSectionDrag takes over the session. */
  readonly onGripPointerDown?: (e: React.PointerEvent<HTMLElement>) => void;
  /** Section drag session is lifting this card (ghost styling). */
  readonly dragging?: boolean;
  /** Called after card-side mutations (enable toggle, rename) to refresh. */
  readonly onChanged?: () => void;
  /** Section edit mode: name toggles selection; delete appears. */
  readonly editing?: boolean;
  readonly selected?: boolean;
  readonly onSelect?: () => void;
  /** Live progress for a resource the importer is still filling. */
  readonly importProgress?: ResourceImportProgress | null;
}

export function ResourceCard({
  resource,
  sectionSize,
  onDelete,
  onMove,
  onGripPointerDown,
  dragging = false,
  onChanged,
  editing = false,
  selected = false,
  onSelect,
  importProgress,
}: ResourceCardProps): ReactElement {
  const importing = resource.installationFinished === false;
  const busy = importing;
  const pct = importing && importProgress != null && importProgress.total > 0
    ? Math.min(100, Math.round((importProgress.done / importProgress.total) * 100))
    : null;
  const importMeta = !importing
    ? null
    : importProgress == null
      ? t('jobs.status.running')
      : importProgress.phase === 'wait'
        ? t('resources.job.waiting')
        : importProgress.phase === 'upload'
          ? t('resources.job.uploading', [String(pct ?? 0)])
          : importProgress.total > 0
            ? t('resources.job.importingOf', [
                importProgress.done.toLocaleString(),
                importProgress.total.toLocaleString(),
              ])
            : importProgress.done > 0
              ? t('resources.job.importing', [importProgress.done.toLocaleString()])
              : t('jobs.status.running');
  const enabled = resource.enabled !== false;
  const resourceId = resource.id;
  const langCode = resource.langCode;
  const [toggling, setToggling] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const committingRef = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const gripWrapRef = useRef<HTMLSpanElement>(null);

  const gripDownY = useRef<number | null>(null);
  const displayName = displayResourceName(resource.name);

  const [components, setComponents] = useState<readonly DictionaryComponent[] | null>(
    resource.components ?? null,
  );
  const [disabledComponents, setDisabledComponents] = useState<ReadonlySet<DictionaryComponent>>(
    new Set(resource.disabledComponents ?? []),
  );

  useEffect(() => {
    if (importing || resourceId == null || components != null) return;
    let alive = true;
    getResourceComponents(langCode, resourceId)
      .then((list) => { if (alive) setComponents(list); })
      .catch(() => { if (alive) setComponents([]); });
    return () => { alive = false; };
  }, [importing, langCode, resourceId, components]);

  const handleToggle = (next: boolean): void => {
    if (busy || resourceId == null || toggling) return;
    setToggling(true);
    void setResourceEnabled(langCode, resourceId, next)
      .then(() => onChanged?.())
      .catch(() => { /* refresh restores the persisted state */ onChanged?.(); })
      .finally(() => setToggling(false));
  };

  const startRename = (): void => {
    if (editing || busy) return;
    committingRef.current = false;
    setDraft(displayName);
    setRenaming(true);
  };

  const commitRename = (): void => {
    if (busy || committingRef.current) return;
    committingRef.current = true;
    const next = draft.trim();
    if (!next || next === displayName || resourceId == null) {
      setRenaming(false);
      return;
    }
    void renameResource(langCode, resourceId, next)
      .then(() => onChanged?.())
      .catch(() => onChanged?.())
      .finally(() => setRenaming(false));
  };

  const toggleComponent = (component: DictionaryComponent): void => {
    if (busy || resourceId == null) return;
    const next = new Set(disabledComponents);
    if (next.has(component)) next.delete(component);
    else next.add(component);
    setDisabledComponents(next);
    void setResourceComponents(langCode, resourceId, [...next])
      .then(() => onChanged?.())
      .catch(() => onChanged?.());
  };

  const canReorder = sectionSize > 1 && !editing && !importing && onGripPointerDown != null;

  const onGripPointerDownLocal = (e: React.PointerEvent<HTMLElement>): void => {
    if (busy) return;
    gripDownY.current = e.clientY;
    onGripPointerDown?.(e);
  };

  const onGripPointerUp = (e: React.PointerEvent<HTMLElement>): void => {
    if (busy) { gripDownY.current = null; return; }
    const downY = gripDownY.current;
    gripDownY.current = null;
    if (downY != null && Math.abs(e.clientY - downY) <= GRIP_TAP_THRESHOLD) {
      setMenuOpen((v) => !v);
    }
  };

  const onGripKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (busy) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setMenuOpen((v) => !v);
      return;
    }
    if (!onMove) return;
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      onMove(-1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      onMove(1);
    }
  };

  return (
    <Card
      ref={cardRef}
      variant={editing && selected ? 'selected' : 'default'}
      className={`${styles.card} ${enabled ? '' : styles.cardDisabled} ${dragging ? styles.cardDragging : ''}`}
      data-cell-id={`resource-card-${resourceId}`}
      aria-busy={busy || undefined}
    >
      {importing && (
        <span
          className={styles.importFill}
          style={{ height: pct == null ? '8%' : `${pct}%` }}
          aria-hidden="true"
          data-cell-id={`importing-${resourceId}`}
        />
      )}
      <div className={styles.row}>
        {editing ? (
          !importing && (
            <Checkbox
              checked={selected}
              onChange={() => onSelect?.()}
              aria-label={t('resources.card.select', [displayName])}
              className={styles.selectCheck}
              data-cell-id={`check-${resourceId}`}
            />
          )
        ) : canReorder && (
          <span ref={gripWrapRef} className={styles.gripWrap}>
            <DragHandle
              size="sm"
              orientation="vertical"
              aria-label={t('resources.card.drag', [displayName])}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              draggable={false}
              className={styles.grip}
              data-cell-id={`drag-${resourceId}`}
              onPointerDown={onGripPointerDownLocal}
              onPointerUp={onGripPointerUp}
              onPointerCancel={() => { gripDownY.current = null; }}
              onKeyDown={onGripKeyDown}
            />
          </span>
        )}

        <div className={styles.info}>
          <div className={styles.nameLine}>
            {renaming ? (
              <Input
                size="sm"
                variant="ghost"
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); commitRename(); }
                  else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setRenaming(false); }
                }}
                onBlur={commitRename}
                aria-label={t('resources.card.rename', [displayName])}
                data-cell-id={`rename-input-${resourceId}`}
              />
            ) : (
              <button
                type="button"
                className={styles.nameButton}
                onClick={busy ? undefined : editing ? onSelect : startRename}
                aria-pressed={editing ? selected : undefined}
                aria-label={editing ? t('resources.card.select', [displayName]) : t('resources.card.rename', [displayName])}
                data-cell-id={editing ? `select-${resourceId}` : `name-${resourceId}`}
              >
                <span className={styles.name}>{displayName}</span>
              </button>
            )}
          </div>
          {importing && (
            <span className={styles.rowMeta} data-cell-id={`import-meta-${resourceId}`}>
              {importMeta}
            </span>
          )}
          {!busy && components != null && components.length > 0 && (
            <div
              className={styles.componentList}
              role="group"
              aria-label={t('resources.components.title')}
              data-cell-id={`resource-components-${resourceId}`}
            >
              {components.map((component) => {
                const off = disabledComponents.has(component);
                return (
                  <Chip
                    key={component}
                    as="button"
                    size="sm"
                    variant="outline"
                    selected={!off}
                    title={t(off ? 'resources.component.enable' : 'resources.component.disable', [t(COMPONENT_LABEL[component])])}
                    onClick={() => toggleComponent(component)}
                    data-cell-id={`component-${component}-${resourceId}`}
                  >
                    {t(COMPONENT_LABEL[component])}
                  </Chip>
                );
              })}
            </div>
          )}
        </div>

        {busy ? (
          <>
            {pct != null && <span className={styles.rowPct}>{pct}%</span>}
            <Spinner size="sm" ariaLabel={importMeta ?? undefined} />
          </>
        ) : (
          <>
            <Toggle
              checked={enabled}
              onChange={handleToggle}
              ariaLabel={t(enabled ? 'resources.card.disable' : 'resources.card.enable', [displayName])}
              dataTestId={`enable-toggle-${resourceId}`}
            />

            {editing && (
              <Button
                variant="ghost"
                size="sm"
                className={styles.editActionIn}
                onClick={onDelete}
                aria-label={t('resources.card.delete', [displayName])}
                data-cell-id={`delete-button-${resourceId}`}
              >
                <Icon name="trash" size="xs" />
              </Button>
            )}
          </>
        )}
      </div>

      <Menu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        triggerRef={gripWrapRef}
        ariaLabel={t('resources.card.menu', [displayName])}
      >
        <MenuItem
          icon={<Icon name="info" size="xs" />}
          onSelect={() => { setMenuOpen(false); setDetailOpen(true); }}
          data-cell-id={`menu-detail-${resourceId}`}
        >
          {t('resources.menu.detail')}
        </MenuItem>
      </Menu>

      <Dialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        title={displayName}
        showCloseButton
        data-cell-id={`resource-detail-${resourceId}`}
      >
        <dl className={styles.detailList}>
          <div className={styles.detailRow}>
            <dt>{t('resources.detail.file')}</dt>
            <dd>{resource.name}</dd>
          </div>
          <div className={styles.detailRow}>
            <dt>{t('resources.detail.format')}</dt>
            <dd>{resource.format}</dd>
          </div>
          <div className={styles.detailRow}>
            <dt>{t('resources.detail.words')}</dt>
            <dd>{resource.wordCount.toLocaleString()}</dd>
          </div>
          <div className={styles.detailRow}>
            <dt>{t('resources.detail.imported')}</dt>
            <dd>{new Date(resource.importedAt).toLocaleString(getLocale())}</dd>
          </div>
          <div className={styles.detailRow}>
            <dt>{t('resources.detail.status')}</dt>
            <dd>{t(enabled ? 'resources.detail.enabled' : 'resources.detail.disabled')}</dd>
          </div>
          {components != null && components.length > 0 && (
            <div className={styles.detailRow}>
              <dt>{t('resources.detail.components')}</dt>
              <dd>{components.map((c) => t(COMPONENT_LABEL[c])).join(', ')}</dd>
            </div>
          )}
        </dl>
      </Dialog>
    </Card>
  );
}

export function ResourceCardSkeleton(): ReactElement {
  return <div className={styles.skeleton} data-cell-id="resource-card-skeleton" aria-hidden="true" />;
}
