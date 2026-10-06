// DictLinksManager — CRUD for settings.dictionaryPopup.externalDictLinks
// (spec dict-links-manager REQ-1..5).
//
// Row: DragHandle (pointer drag via shared useSectionDrag, ArrowUp/Down =
// keyboard reorder) · name (click = inline rename) · URL preview · pencil =
// edit dialog (name + URL) · trash = delete confirm dialog. Add button opens
// the same editor dialog empty. Row controls bind to the pointer-adaptive
// --touch-target floor (44px coarse / 40px fine).

import { useEffect, useRef, useState, type ReactElement } from 'react';
import { t } from '@/shared/i18n';
import { Button, Card, Dialog, EmptyState, HintIcon, Icon, Input, SectionHeader, Text } from '@/shared/ui';
import { DragHandle } from '@/shared/ui/DragHandle';
import { pushEscapeLayer } from '@/shared/ui/escapeLayerStack';
import { useSectionDrag } from '@/shared/lib/useSectionDrag';
import { reorderItems } from '@/shared/lib/reorderItems';
import {
  makeDictLink,
  validateDictLink,
  type ExternalDictLinkTemplate,
} from '@/entities/settings';
import styles from './DictLinksManager.module.css';

const SLOT_PREFIX = 'dict-link-slot-';

interface DictLinksManagerProps {
  readonly links: readonly ExternalDictLinkTemplate[];
  readonly onChange: (links: readonly ExternalDictLinkTemplate[]) => void;
}

interface EditorState {
  readonly id: string | null;
  readonly name: string;
  readonly urlTemplate: string;
}

export function DictLinksManager({ links, onChange }: DictLinksManagerProps): ReactElement {
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [error, setError] = useState<'name' | 'url' | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const committingRef = useRef(false);

  const { listRef, drag, beginDrag } = useSectionDrag((draggedId, toIndex) => {
    const from = links.findIndex((l) => l.id === draggedId);
    if (from >= 0) onChange(reorderItems(links, from, toIndex));
  }, { slotPrefix: SLOT_PREFIX });

  const openAdd = (): void => {
    setEditor({ id: null, name: '', urlTemplate: '' });
    setError(null);
  };

  const openEdit = (link: ExternalDictLinkTemplate): void => {
    setEditor({ id: link.id, name: link.name, urlTemplate: link.urlTemplate });
    setError(null);
  };

  const closeEditor = (): void => {
    setEditor(null);
    setError(null);
  };

  const submitEditor = (): void => {
    if (!editor || committingRef.current) return;
    const name = editor.name.trim();
    const urlTemplate = editor.urlTemplate.trim();
    if (!name) { setError('name'); return; }
    if (!validateDictLink(name, urlTemplate)) { setError('url'); return; }
    committingRef.current = true;
    if (editor.id) {
      onChange(links.map((l) => (l.id === editor.id ? { ...l, name, urlTemplate } : l)));
    } else {
      onChange([...links, makeDictLink(name, urlTemplate)]);
    }
    committingRef.current = false;
    closeEditor();
  };

  const commitRename = (id: string): void => {
    if (committingRef.current) return;
    committingRef.current = true;
    const next = draft.trim();
    if (next) {
      onChange(links.map((l) => (l.id === id ? { ...l, name: next } : l)));
    }
    committingRef.current = false;
    setRenamingId(null);
  };

  const confirmDelete = (): void => {
    if (!deletingId) return;
    onChange(links.filter((l) => l.id !== deletingId));
    setDeletingId(null);
  };

  const deleting = links.find((l) => l.id === deletingId);

  useEffect(() => renamingId !== null ? pushEscapeLayer(() => setRenamingId(null)) : undefined, [renamingId]);

  return (
    <section className={styles.section} data-cell-id="dict-links-manager">
      <SectionHeader
        level={5}
        title={t('settings.dictionaryPopup.links.title')}
        subtitle={t('settings.dictionaryPopup.links.desc')}
        action={
          <Button variant="outline" size="sm" onClick={openAdd} data-cell-id="dict-link-add">
            <Icon name="plus" size="xs" />
            {t('settings.dictionaryPopup.links.add')}
          </Button>
        }
      />

      <div className={styles.list} role="list" ref={listRef}>
        {links.length === 0 && (
          <EmptyState bordered size="sm" description={t('settings.dictionaryPopup.links.empty')} />
        )}
        {links.map((link, i) => {
          const dragged = drag != null && link.id === drag.draggedId;
          const dragFrom = drag ? links.findIndex((x) => x.id === drag.draggedId) : -1;
          const collapsedPos = drag && dragFrom >= 0 && i > dragFrom ? i - 1 : i;
          const shiftY = drag && !dragged && collapsedPos >= drag.toIndex
            ? drag.cardHeight + drag.gap
            : 0;
          return (
            <div
              key={link.id}
              data-cell-id={`${SLOT_PREFIX}${link.id}`}
              className={`${styles.slot} ${dragged ? styles.slotDragging : ''} ${drag?.settling ? styles.slotSettling : ''}`}
              style={drag
                ? dragged
                  ? { top: drag.fromTop, transform: `translateY(${drag.offsetY}px)` }
                  : { transform: `translateY(${shiftY}px)` }
                : undefined}
            >
              <Card className={`${styles.card} ${dragged ? styles.cardDragging : ''}`}>
                <div className={styles.row}>
                  {links.length > 1 && (
                    <span className={styles.gripWrap}>
                      <DragHandle
                        size="sm"
                        orientation="vertical"
                        aria-label={t('settings.dictionaryPopup.links.drag', [link.name])}
                        draggable={false}
                        className={styles.grip}
                        data-cell-id={`dict-link-drag-${link.id}`}
                        onPointerDown={(e) => beginDrag(i, link.id, e)}
                        onKeyDown={(e) => {
                          if (e.key === 'ArrowUp' && i > 0) {
                            e.preventDefault();
                            onChange(reorderItems(links, i, i - 1));
                          } else if (e.key === 'ArrowDown' && i < links.length - 1) {
                            e.preventDefault();
                            onChange(reorderItems(links, i, i + 1));
                          }
                        }}
                      />
                    </span>
                  )}

                  <div className={styles.info}>
                    <div className={styles.nameLine}>
                      {renamingId === link.id ? (
                        <Input
                          size="sm"
                          variant="ghost"
                          autoFocus
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); commitRename(link.id); }
                          }}
                          onBlur={() => commitRename(link.id)}
                          aria-label={t('settings.dictionaryPopup.links.rename', [link.name])}
                          data-cell-id={`dict-link-rename-${link.id}`}
                        />
                      ) : (
                        <button
                          type="button"
                          className={styles.nameButton}
                          onClick={() => {
                            committingRef.current = false;
                            setRenamingId(link.id);
                            setDraft(link.name);
                          }}
                          aria-label={t('settings.dictionaryPopup.links.rename', [link.name])}
                          data-cell-id={`dict-link-name-${link.id}`}
                        >
                          <span className={styles.name}>{link.name}</span>
                        </button>
                      )}
                    </div>
                    <span className={styles.url} dir="ltr">{link.urlTemplate}</span>
                  </div>

                  <Button
                    variant="ghost"
                    size="md"
                    shape="circle"
                    aria-label={t('settings.dictionaryPopup.links.edit', [link.name])}
                    onClick={() => openEdit(link)}
                    data-cell-id={`dict-link-edit-${link.id}`}
                  >
                    <Icon name="pencil" size="xs" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="md"
                    shape="circle"
                    className={styles.dangerBtn}
                    aria-label={t('settings.dictionaryPopup.links.delete', [link.name])}
                    onClick={() => setDeletingId(link.id)}
                    data-cell-id={`dict-link-delete-${link.id}`}
                  >
                    <Icon name="trash" size="xs" />
                  </Button>
                </div>
              </Card>
            </div>
          );
        })}
        {drag && (
          <div
            className={styles.dropPlaceholder}
            style={{ top: drag.slotTop, height: drag.cardHeight }}
            data-cell-id="dict-link-drag-placeholder"
            aria-hidden="true"
          />
        )}
      </div>

      <Dialog
        open={editor !== null}
        onOpenChange={(open) => { if (!open) closeEditor(); }}
        title={t(editor?.id ? 'settings.dictionaryPopup.links.editorEditTitle' : 'settings.dictionaryPopup.links.editorAddTitle')}
        showCloseButton
        footer={
          <>
            <Button variant="outline" onClick={closeEditor}>
              {t('settings.dictionaryPopup.links.cancel')}
            </Button>
            <Button variant="primary" onClick={submitEditor} data-cell-id="dict-link-editor-save">
              {editor?.id ? t('settings.dictionaryPopup.links.save') : t('settings.dictionaryPopup.links.add')}
            </Button>
          </>
        }
        data-cell-id="dict-link-editor"
      >
        <div className={styles.editorBody}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>{t('settings.dictionaryPopup.links.nameLabel')}</span>
            <Input
              size="sm"
              placeholder={t('settings.dictionaryPopup.links.namePlaceholder')}
              value={editor?.name ?? ''}
              onChange={(e) => setEditor((s) => s && { ...s, name: e.target.value })}
              autoFocus
              data-cell-id="dict-link-editor-name"
            />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>
              {t('settings.dictionaryPopup.links.urlLabel')}
              <HintIcon
                hint={t('settings.dictionaryPopup.links.hint')}
                ariaLabel={t('settings.hint.aria', [t('settings.dictionaryPopup.links.urlLabel')])}
              />
            </span>
            <Input
              size="sm"
              dir="ltr"
              placeholder={t('settings.dictionaryPopup.links.urlPlaceholder')}
              value={editor?.urlTemplate ?? ''}
              onChange={(e) => setEditor((s) => s && { ...s, urlTemplate: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitEditor(); } }}
              data-cell-id="dict-link-editor-url"
            />
          </label>
          {error === 'name' && (
            <p className={styles.error} role="alert">{t('settings.dictionaryPopup.links.errorName')}</p>
          )}
          {error === 'url' && (
            <p className={styles.error} role="alert">{t('settings.dictionaryPopup.links.errorUrl')}</p>
          )}
        </div>
      </Dialog>

      <Dialog
        open={deletingId !== null}
        onOpenChange={(open) => { if (!open) setDeletingId(null); }}
        title={deleting ? t('settings.dictionaryPopup.links.deleteTitle', [deleting.name]) : ''}
        showCloseButton
        footer={
          <>
            <Button variant="outline" onClick={() => setDeletingId(null)}>
              {t('settings.dictionaryPopup.links.keep')}
            </Button>
            <Button variant="destructive" onClick={confirmDelete} data-cell-id="dict-link-delete-confirm">
              {t('settings.dictionaryPopup.links.delete', [deleting?.name ?? ''])}
            </Button>
          </>
        }
        data-cell-id="dict-link-delete-dialog"
      >
        <Text as="p" color="secondary" className={styles.dialogText}>
          {t('settings.dictionaryPopup.links.deleteBody')}
        </Text>
      </Dialog>
    </section>
  );
}
