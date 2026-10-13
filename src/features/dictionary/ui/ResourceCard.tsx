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
import { Card, Checkbox, Chip, Dialog, Input, Progress } from '@/shared/ui';
import { Button } from '@/shared/ui/Button';
import { DragHandle } from '@/shared/ui/DragHandle';
import { Menu, MenuItem } from '@/shared/ui/Menu';
import { pushEscapeLayer } from '@/shared/ui/escapeLayerStack';
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
import type { ResourceDeleteProgress, ResourceImportProgress } from './importJobTypes';
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
  /** Live progress for a resource the delete job is still draining — the
   *  card stays in place until removal finishes. */
  readonly deleteProgress?: ResourceDeleteProgress | null;
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
  deleteProgress,
}: ResourceCardProps): ReactElement {
  const importing = resource.installationFinished === false;
  const deleting = deleteProgress != null;
  const busy = importing || deleting;
  const pct = importing && importProgress != null && importProgress.total > 0
    ? Math.min(100, Math.round((importProgress.done / importProgress.total) * 100))
    : null;
  const deletePct = deleting && deleteProgress.total > 0
    ? Math.min(100, Math.round((deleteProgress.done / deleteProgress.total) * 100))
    : null;
  const deleteMeta = !deleting
    ? null
    : deleteProgress.status === 'queued'
      ? t('resources.job.waiting')
      : t('resources.job.removing');
  const importMeta = !importing
    ? null
    : importProgress == null
      ? t('jobs.status.running')
      : importProgress.phase === 'wait'
        ? t('resources.job.waiting')
        : importProgress.phase === 'upload'
          ? t('resources.job.uploadingState')
          : t('resources.job.addingState');
  const busyPct = pct ?? deletePct;
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
  const moreRef = useRef<HTMLButtonElement>(null);
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

  useEffect(() => renaming ? pushEscapeLayer(() => setRenaming(false)) : undefined, [renaming]);

  const canReorder = sectionSize > 1 && !editing && !importing && onGripPointerDown != null;

  const componentChips = components != null && components.length > 0 && (
    <div
      className={styles.componentList}
      role="group"
      aria-label={t('resources.components.title')}
      data-tihoka-id={`resource-components-${resourceId}`}
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
            data-tihoka-id={`component-${component}-${resourceId}`}
          >
            {t(COMPONENT_LABEL[component])}
          </Chip>
        );
      })}
    </div>
  );

  const moreButton = (
    <Button
      ref={moreRef}
      variant="ghost"
      size="sm"
      onClick={() => setMenuOpen((v) => !v)}
      aria-label={t('resources.card.menu', [displayName])}
      aria-haspopup="menu"
      aria-expanded={menuOpen}
      data-tihoka-id={`menu-trigger-${resourceId}`}
    >
      <Icon name="ellipsisVertical" size="xs" />
    </Button>
  );

  const onGripPointerDownLocal = (e: React.PointerEvent<HTMLElement>): void => {
    if (busy) return;
    onGripPointerDown?.(e);
  };

  const onGripKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (busy || !onMove) return;
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
      data-tihoka-id={`resource-card-${resourceId}`}
      aria-busy={busy || undefined}
    >
      <div className={styles.row}>
        {busy ? (
          <>
            <Spinner size="lg" ariaLabel={(importMeta ?? deleteMeta) ?? undefined} />
            <div className={styles.info}>
              <div className={styles.nameLine}>
                <span className={styles.name}>{displayName}</span>
                <span className={styles.metaSep} aria-hidden="true">·</span>
                <span className={`${styles.rowMeta}${deleting ? ` ${styles.deletingText}` : ''}`} data-tihoka-id={deleting ? `delete-meta-${resourceId}` : `import-meta-${resourceId}`}>
                  {deleting ? deleteMeta : importMeta}
                </span>
              </div>
              <Progress
                size="sm"
                color={deleting ? 'error' : 'accent'}
                value={busyPct ?? 0}
                indeterminate={busyPct == null || undefined}
                className={styles.busyProgress}
                aria-label={displayName}
                data-tihoka-id={deleting ? `deleting-${resourceId}` : `importing-${resourceId}`}
              />
              {componentChips}
            </div>
            {busyPct != null && <span className={`${styles.rowPct}${deleting ? ` ${styles.deletingText}` : ''}`}>{busyPct}%</span>}
            {moreButton}
          </>
        ) : (
          <>
            {editing ? (
              <Checkbox
                checked={selected}
                onChange={() => onSelect?.()}
                aria-label={t('resources.card.select', [displayName])}
                className={styles.selectCheck}
                data-tihoka-id={`check-${resourceId}`}
              />
            ) : canReorder && (
              <span className={styles.gripWrap}>
                <DragHandle
                  size="sm"
                  orientation="vertical"
                  aria-label={t('resources.card.drag', [displayName])}
                  draggable={false}
                  className={styles.grip}
                  data-tihoka-id={`drag-${resourceId}`}
                  onPointerDown={onGripPointerDownLocal}
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
                    }}
                    onBlur={commitRename}
                    aria-label={t('resources.card.rename', [displayName])}
                    data-tihoka-id={`rename-input-${resourceId}`}
                  />
                ) : (
                  <button
                    type="button"
                    className={styles.nameButton}
                    onClick={editing ? onSelect : startRename}
                    aria-pressed={editing ? selected : undefined}
                    aria-label={editing ? t('resources.card.select', [displayName]) : t('resources.card.rename', [displayName])}
                    data-tihoka-id={editing ? `select-${resourceId}` : `name-${resourceId}`}
                  >
                    <span className={styles.name}>{displayName}</span>
                  </button>
                )}
              </div>
              {componentChips}
            </div>

            <Toggle
              checked={enabled}
              onChange={handleToggle}
              ariaLabel={t(enabled ? 'resources.card.disable' : 'resources.card.enable', [displayName])}
              dataTestId={`enable-toggle-${resourceId}`}
            />

            {moreButton}

            {editing && (
              <Button
                variant="ghost"
                size="sm"
                className={styles.editActionIn}
                onClick={onDelete}
                aria-label={t('resources.card.delete', [displayName])}
                data-tihoka-id={`delete-button-${resourceId}`}
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
        triggerRef={moreRef}
        ariaLabel={t('resources.card.menu', [displayName])}
      >
        <MenuItem
          icon={<Icon name="info" size="xs" />}
          onSelect={() => { setMenuOpen(false); setDetailOpen(true); }}
          data-tihoka-id={`menu-detail-${resourceId}`}
        >
          {t('resources.menu.detail')}
        </MenuItem>
        <MenuItem
          icon={<Icon name="pencil" size="xs" />}
          disabled={busy || editing}
          onSelect={() => { setMenuOpen(false); startRename(); }}
          data-tihoka-id={`menu-rename-${resourceId}`}
        >
          {t('resources.menu.rename')}
        </MenuItem>
        <MenuItem
          icon={<Icon name="trash" size="xs" />}
          disabled={busy}
          onSelect={() => { setMenuOpen(false); onDelete(); }}
          data-tihoka-id={`menu-delete-${resourceId}`}
        >
          {t('resources.menu.delete')}
        </MenuItem>
      </Menu>

      <Dialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        title={displayName}
        showCloseButton
        data-tihoka-id={`resource-detail-${resourceId}`}
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
  return <div className={styles.skeleton} data-tihoka-id="resource-card-skeleton" aria-hidden="true" />;
}
