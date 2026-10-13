import { useEffect, useRef, useState, type ReactElement } from 'react';
import { t } from '@/shared/i18n';
import {
  Button,
  Card,
  Chip,
  ConfirmDialog,
  Dialog,
  Dropzone,
  EmptyState,
  Icon,
  Menu,
  MenuItem,
  SettingsGroup,
  SettingsRow,
} from '@/shared/ui';
import { parsePhonemePack, type PhonemePack, type PhonemePackMeta } from '../services/phonemePack';
import {
  listPhonemePacks,
  removePhonemePack,
  savePhonemePack,
} from '../services/phonemePackStorage';
import { invalidatePhonemePacks, loadBuiltinPhonemePack } from '../services/phonemePackAudio';
import styles from './PhonemePacksPanel.module.css';

interface PackDetail {
  readonly name: string;
  readonly symbols: number;
  readonly license?: string;
  readonly version?: number;
  readonly addedAt?: number;
}

interface PackRowProps {
  readonly detail: PackDetail;
  readonly tag: string;
  readonly tagColor: 'muted' | 'primary';
  readonly onDelete?: () => void;
}

function PackRow({ detail, tag, tagColor, onDelete }: PackRowProps): ReactElement {
  const moreRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  return (
    <Card className={styles.card} role="listitem">
      <div className={styles.row}>
        <span className={styles.iconWrap} aria-hidden="true">
          <Icon name="volumeHigh" size="sm" />
        </span>
        <div className={styles.info}>
          <button
            type="button"
            className={styles.nameButton}
            onClick={() => setDetailOpen(true)}
            aria-label={t('audio.phonemePacks.detailAria', [detail.name])}
            data-tihoka-id={`phoneme-pack-name-${detail.name}`}
          >
            <span className={styles.name}>{detail.name}</span>
          </button>
          <span className={styles.meta} title={detail.license}>
            {t('audio.phonemePacks.symbols', [String(detail.symbols)])}
            {detail.license ? ` · ${detail.license}` : ''}
          </span>
        </div>
        <Chip size="sm" variant="outline" color={tagColor}>{tag}</Chip>
        <Button
          ref={moreRef}
          variant="ghost"
          size="sm"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={t('audio.phonemePacks.menuAria', [detail.name])}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          data-tihoka-id={`phoneme-pack-menu-${detail.name}`}
        >
          <Icon name="ellipsisVertical" size="xs" />
        </Button>
      </div>

      <Menu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        triggerRef={moreRef}
        ariaLabel={t('audio.phonemePacks.menuAria', [detail.name])}
      >
        <MenuItem
          icon={<Icon name="info" size="xs" />}
          onSelect={() => { setMenuOpen(false); setDetailOpen(true); }}
          data-tihoka-id={`phoneme-pack-detail-${detail.name}`}
        >
          {t('audio.phonemePacks.detail')}
        </MenuItem>
        {onDelete && (
          <MenuItem
            icon={<Icon name="trash" size="xs" />}
            onSelect={() => { setMenuOpen(false); onDelete(); }}
            data-tihoka-id={`phoneme-pack-delete-${detail.name}`}
          >
            {t('audio.phonemePacks.delete')}
          </MenuItem>
        )}
      </Menu>

      <Dialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        title={detail.name}
        showCloseButton
        data-tihoka-id={`phoneme-pack-dialog-${detail.name}`}
      >
        <dl className={styles.detailList}>
          <div className={styles.detailRow}>
            <dt>{t('audio.phonemePacks.field.symbols')}</dt>
            <dd>{detail.symbols}</dd>
          </div>
          {detail.license && (
            <div className={styles.detailRow}>
              <dt>{t('audio.phonemePacks.field.license')}</dt>
              <dd>{detail.license}</dd>
            </div>
          )}
          {detail.version != null && (
            <div className={styles.detailRow}>
              <dt>{t('audio.phonemePacks.field.version')}</dt>
              <dd>{detail.version}</dd>
            </div>
          )}
          {detail.addedAt != null && (
            <div className={styles.detailRow}>
              <dt>{t('audio.phonemePacks.field.added')}</dt>
              <dd>{new Date(detail.addedAt).toLocaleDateString()}</dd>
            </div>
          )}
        </dl>
      </Dialog>
    </Card>
  );
}

export function PhonemePacksPanel(): ReactElement {
  const [builtin, setBuiltin] = useState<PhonemePack | null>(null);
  const [packs, setPacks] = useState<readonly PhonemePackMeta[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PhonemePackMeta | null>(null);

  useEffect(() => {
    let alive = true;
    void loadBuiltinPhonemePack().then((p) => { if (alive) setBuiltin(p); });
    void listPhonemePacks().then((m) => { if (alive) setPacks(m); });
    return () => { alive = false; };
  }, []);

  const refresh = async (): Promise<void> => {
    invalidatePhonemePacks();
    setPacks(await listPhonemePacks());
  };

  const handleImport = async (file: File): Promise<void> => {
    try {
      const pack = parsePhonemePack(JSON.parse(await file.text()));
      const meta = await savePhonemePack(pack);
      if (!meta) {
        setStatus(t('audio.phonemePacks.importUnavailable'));
        return;
      }
      await refresh();
      setStatus(t('audio.phonemePacks.imported', [meta.name, String(meta.symbolCount)]));
    } catch (e) {
      setStatus(t('audio.phonemePacks.importError', [e instanceof Error ? e.message : String(e)]));
    }
  };

  const confirmDelete = async (): Promise<void> => {
    if (!deleteTarget) return;
    const meta = deleteTarget;
    setDeleteTarget(null);
    await removePhonemePack(meta.id);
    await refresh();
    setStatus(t('audio.phonemePacks.removed', [meta.name]));
  };

  return (
    <SettingsGroup label={<span className={styles.groupLabel}>{t('audio.phonemePacks.group')}</span>}>
      <SettingsRow dense stacked description={t('audio.phonemePacks.hint')}>
        <Dropzone
          compact
          label={t('audio.phonemePacks.import')}
          hint={t('audio.phonemePacks.dropHint')}
          accept=".json,application/json"
          disabled={false}
          onFiles={(files) => { if (files[0]) void handleImport(files[0]); }}
        />
        <div className={styles.packList} role="list" data-tihoka-id="phoneme-pack-list">
          {builtin && (
            <PackRow
              detail={{
                name: builtin.name,
                symbols: Object.keys(builtin.files).length,
                license: builtin.license,
                version: builtin.version,
              }}
              tag={t('audio.phonemePacks.bundled')}
              tagColor="muted"
            />
          )}
          {!builtin && packs.length === 0 && (
            <EmptyState
              size="sm"
              bordered
              description={t('audio.phonemePacks.empty')}
              data-tihoka-id="phoneme-packs-empty"
            />
          )}
          {packs.map((meta) => (
            <PackRow
              key={meta.id}
              detail={{
                name: meta.name,
                symbols: meta.symbolCount,
                license: meta.license,
                addedAt: meta.addedAt,
              }}
              tag={t('audio.phonemePacks.custom')}
              tagColor="primary"
              onDelete={() => setDeleteTarget(meta)}
            />
          ))}
        </div>
        {status && (
          <p className={styles.status} role="status" data-tihoka-id="phoneme-pack-status">
            {status}
          </p>
        )}
      </SettingsRow>

      <ConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title={t('audio.phonemePacks.deleteTitle', [deleteTarget?.name ?? ''])}
        description={t('audio.phonemePacks.deleteBody')}
        cancelLabel={t('audio.phonemePacks.cancel')}
        confirmLabel={t('audio.phonemePacks.delete')}
        onConfirm={() => void confirmDelete()}
      />
    </SettingsGroup>
  );
}
