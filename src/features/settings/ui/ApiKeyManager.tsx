/**
 * ApiKeyManager — CRUD UI for subtitle search API keys (spec subtitle-search.md).
 *
 * Lists keys grouped by provider (SubDL / OpenSubtitles). Each key card shows
 * label, masked key (••••last4), status badge, remaining downloads (from
 * GET_KEY_QUOTA ledger), and Edit / Delete actions. Add-key form picks a
 * provider, enters the key (password-type) + optional label. New keys start
 * `unverified` → `active` on first 200 response (background marks them — no
 * validate-on-add, spec §Settings). Delete uses a focus-trapped confirm Dialog.
 *
 * Pure helpers (`maskKey`, `groupKeysByProvider`) are
 * exported for unit testing.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { Dialog } from '@/shared/ui/Dialog';
import { Input } from '@/shared/ui/Input';
import { Select } from '@/shared/ui/Select';
import { Icon } from '@/shared/icons/Icon';
import type {
  SubtitleApiKey,
  SubtitleApiKeyProvider,
  SubtitleApiKeyStatus,
} from '@/entities/settings';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import styles from './ApiKeyManager.module.css';

export interface ApiKeyManagerProps {
  readonly keys: SubtitleApiKey[];
  readonly onChange: (keys: SubtitleApiKey[]) => void;
}

// === Quota ledger response (background GET_KEY_QUOTA handler) ===

export interface KeyQuotaInfo {
  readonly keyId: string;
  readonly remainingDownloads: number;
  /** Quota window reset timestamp (ms epoch). */
  readonly resetAt: number;
}

export type KeyQuotaResponse = readonly KeyQuotaInfo[];

// === Constants ===

const PROVIDERS: readonly SubtitleApiKeyProvider[] = ['subdl', 'opensubtitles'];

const PROVIDER_LABELS: Record<SubtitleApiKeyProvider, string> = {
  subdl: 'SubDL',
  opensubtitles: 'OpenSubtitles',
};

const PROVIDER_URLS: Record<SubtitleApiKeyProvider, string> = {
  subdl: 'https://subdl.com/api',
  opensubtitles: 'https://www.opensubtitles.com/consumers',
};

const PROVIDER_OPTIONS = PROVIDERS.map((p) => ({ value: p, label: PROVIDER_LABELS[p] }));

const STATUS_LABELS: Record<SubtitleApiKeyStatus, string> = {
  active: 'Active',
  'rate-limited': 'Rate-limited',
  invalid: 'Invalid',
  unverified: 'Unverified',
};

// === Pure helpers (exported for testing) ===

/** Mask a key, showing only its last 4 chars prefixed with ••••. */
export function maskKey(key: string): string {
  if (key.length <= 4) return `••••${key}`;
  return `••••${key.slice(-4)}`;
}

/** Group keys by provider, preserving insertion order within each group. */
export function groupKeysByProvider(
  keys: readonly SubtitleApiKey[],
): Record<SubtitleApiKeyProvider, SubtitleApiKey[]> {
  const groups: Record<SubtitleApiKeyProvider, SubtitleApiKey[]> = {
    subdl: [],
    opensubtitles: [],
  };
  for (const k of keys) groups[k.provider].push(k);
  return groups;
}

const STATUS_DOT_CLASSES: Record<SubtitleApiKeyStatus, string> = {
  active: styles.statusDot_active,
  'rate-limited': styles['statusDot_rate-limited'],
  invalid: styles.statusDot_invalid,
  unverified: styles.statusDot_unverified,
};

function statusDotClass(status: SubtitleApiKeyStatus): string {
  return STATUS_DOT_CLASSES[status] ?? '';
}

// === Component ===

export function ApiKeyManager({ keys, onChange }: ApiKeyManagerProps): React.JSX.Element {
  // --- Quota ledger (fetched on mount) ---
  const [quota, setQuota] = useState<ReadonlyMap<string, KeyQuotaInfo>>(new Map());

  useEffect(() => {
    let cancelled = false;
    sendMessage<KeyQuotaResponse>({ type: MESSAGE_TYPES.GET_KEY_QUOTA })
      .then((res) => {
        if (cancelled || !Array.isArray(res)) return;
        const map = new Map<string, KeyQuotaInfo>();
        for (const entry of res) map.set(entry.keyId, entry);
        setQuota(map);
      })
      .catch(() => {
        /* quota is best-effort — silent on failure (no keys = no quota) */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // --- Add-key form state ---
  const [addOpen, setAddOpen] = useState(false);
  const [addProvider, setAddProvider] = useState<SubtitleApiKeyProvider>('subdl');
  const [addKey, setAddKey] = useState('');
  const [addLabel, setAddLabel] = useState('');

  const canAdd = addKey.trim().length > 0;

  const handleAdd = useCallback((): void => {
    const trimmed = addKey.trim();
    if (trimmed.length === 0) return;
    const newKey: SubtitleApiKey = {
      id: crypto.randomUUID(),
      provider: addProvider,
      key: trimmed,
      label: addLabel.trim() || undefined,
      status: 'unverified',
      addedAt: Date.now(),
    };
    onChange([...keys, newKey]);
    setAddKey('');
    setAddLabel('');
    setAddOpen(false);
  }, [addKey, addLabel, addProvider, keys, onChange]);

  // --- Edit state (inline, single key at a time) ---
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editKey, setEditKey] = useState('');

  const startEdit = useCallback((k: SubtitleApiKey): void => {
    setEditingId(k.id);
    setEditLabel(k.label ?? '');
    setEditKey('');
  }, []);

  const cancelEdit = useCallback((): void => {
    setEditingId(null);
    setEditLabel('');
    setEditKey('');
  }, []);

  const saveEdit = useCallback(
    (id: string): void => {
      const trimmedLabel = editLabel.trim();
      const trimmedKey = editKey.trim();
      if (trimmedKey.length === 0) {
        const target = keys.find((k) => k.id === id);
        if (target && (target.label ?? '') === trimmedLabel) {
          cancelEdit();
          return;
        }
      }
      onChange(
        keys.map((k) =>
          k.id === id
            ? {
                ...k,
                label: trimmedLabel || undefined,
                ...(trimmedKey.length > 0
                  ? { key: trimmedKey, status: 'unverified' as SubtitleApiKeyStatus }
                  : {}),
              }
            : k,
        ),
      );
      cancelEdit();
    },
    [cancelEdit, editKey, editLabel, keys, onChange],
  );

  // --- Delete confirm (focus-trapped Dialog, spec §Accessibility) ---
  const [deleteTarget, setDeleteTarget] = useState<SubtitleApiKey | null>(null);

  const confirmDelete = useCallback((): void => {
    if (deleteTarget) {
      onChange(keys.filter((k) => k.id !== deleteTarget.id));
      setDeleteTarget(null);
    }
  }, [deleteTarget, keys, onChange]);

  // --- Derived: grouped keys ---
  const grouped = useMemo(() => groupKeysByProvider(keys), [keys]);
  const totalKeys = keys.length;

  return (
    <div className={styles.root} data-cell-id="api-key-manager">
      {/* Header row — count + add toggle */}
      <div className={styles.headerRow}>
        <span className={styles.headerCount}>
          {totalKeys === 0 ? 'No API keys' : `${totalKeys} key${totalKeys > 1 ? 's' : ''}`}
        </span>
        <button
          type="button"
          className={styles.addToggle}
          onClick={() => setAddOpen((v) => !v)}
          aria-expanded={addOpen}
          aria-label={addOpen ? 'Close add key form' : 'Add new API key'}
          data-cell-id="akm-add-toggle"
        >
          <Icon name={addOpen ? 'x' : 'plus'} size={24} />
          <span>{addOpen ? 'Cancel' : 'Add key'}</span>
        </button>
      </div>

      {/* Add-key form — collapsible, slides down */}
      {addOpen && (
        <div className={styles.addForm} data-cell-id="add-key-form">
          <div className={styles.addFormRow}>
            <Select
              data-cell-id="akm-provider-select"
              aria-label="Select key provider"
              value={addProvider}
              options={PROVIDER_OPTIONS}
              onChange={(v) => setAddProvider(v as SubtitleApiKeyProvider)}
            />
          </div>
          <Input
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={addKey}
            onChange={(e) => setAddKey(e.target.value)}
            placeholder="Paste your API key"
            aria-label="API key"
            data-cell-id="akm-key-input"
          />
          <Input
            type="text"
            autoComplete="off"
            value={addLabel}
            onChange={(e) => setAddLabel(e.target.value)}
            placeholder="Label (e.g. Free account)"
            aria-label="Optional label for this key"
            data-cell-id="akm-label-input"
          />
          <a
            className={styles.helpLink}
            href={PROVIDER_URLS[addProvider]}
            target="_blank"
            rel="noopener noreferrer"
            data-cell-id="akm-get-key-link"
          >
            <Icon name="externalLink" size={24} />
            <span>Get {PROVIDER_LABELS[addProvider]} API key</span>
          </a>
          <Button
            variant="primary"
            size="md"
            onClick={handleAdd}
            disabled={!canAdd}
            className={styles.addBtn}
            data-cell-id="akm-add-btn"
          >
            Add key
          </Button>
        </div>
      )}

      {/* Provider groups */}
      {PROVIDERS.map((provider) => {
        const groupKeys = grouped[provider];
        if (groupKeys.length === 0 && totalKeys > 0) return null;
        return (
          <div key={provider} className={styles.providerGroup} data-cell-id={`provider-${provider}`}>
            <div className={styles.providerHeader}>
              <span>{PROVIDER_LABELS[provider]}</span>
              {groupKeys.length > 0 && (
                <span className={styles.providerCount}>{groupKeys.length}</span>
              )}
            </div>

            {groupKeys.length === 0 && (
              <div className={styles.emptyState}>
                <Icon name="wrench" size={24} className={styles.emptyIcon} />
                <span className={styles.emptyText}>No {PROVIDER_LABELS[provider]} keys yet</span>
              </div>
            )}

            {groupKeys.map((k) => {
              const q = quota.get(k.id);
              const isEditing = editingId === k.id;
              return (
                <div key={k.id} className={styles.keyCard} data-cell-id={`key-card-${k.id}`}>
                  {isEditing ? (
                    <InlineEdit
                      label={editLabel}
                      keyInput={editKey}
                      onLabelChange={setEditLabel}
                      onKeyChange={setEditKey}
                      onSave={() => saveEdit(k.id)}
                      onCancel={cancelEdit}
                    />
                  ) : (
                    <>
                      <div className={styles.keyCardInfo}>
                        <span className={styles.keyLabel}>{k.label ?? PROVIDER_LABELS[k.provider]}</span>
                        <div className={styles.keyCardMeta}>
                          <span className={styles.keyMasked}>{maskKey(k.key)}</span>
                          <span
                            className={`${styles.statusDot} ${statusDotClass(k.status)}`}
                            data-cell-id={`key-status-${k.id}`}
                            aria-label={STATUS_LABELS[k.status]}
                          />
                          <span className={styles.statusText}>{STATUS_LABELS[k.status]}</span>
                        </div>
                        {q && (
                          <span className={styles.keyQuota} data-cell-id={`key-quota-${k.id}`}>
                            {q.remainingDownloads} downloads left
                          </span>
                        )}
                        {k.status === 'rate-limited' && k.rateLimitedUntil && (
                          <span className={styles.keyQuota}>
                            Resets at {new Date(k.rateLimitedUntil).toLocaleTimeString()}
                          </span>
                        )}
                      </div>
                      <div className={styles.keyActions}>
                        <button
                          type="button"
                          className={styles.iconAction}
                          onClick={() => startEdit(k)}
                          aria-label={`Edit key ${k.label ?? k.id}`}
                          data-cell-id={`key-edit-${k.id}`}
                        >
                          <Icon name="pencil" size={24} />
                        </button>
                        <button
                          type="button"
                          className={`${styles.iconAction} ${styles.iconActionDanger}`}
                          onClick={() => setDeleteTarget(k)}
                          aria-label={`Delete key ${k.label ?? k.id}`}
                          data-cell-id={`key-delete-${k.id}`}
                        >
                          <Icon name="trash" size={24} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

      {/* Empty state — no keys at all */}
      {totalKeys === 0 && !addOpen && (
        <div className={styles.fullEmpty} data-cell-id="akm-empty">
          <Icon name="wrench" size={24} className={styles.fullEmptyIcon} />
          <span className={styles.fullEmptyTitle}>No API keys yet</span>
          <span className={styles.fullEmptyHint}>Add a key to start searching for subtitles</span>
          <Button
            variant="primary"
            size="md"
            onClick={() => setAddOpen(true)}
            data-cell-id="akm-empty-add"
          >
            Add your first key
          </Button>
        </div>
      )}

      {/* Delete confirm dialog (focus trap via Dialog) */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete API key?"
        data-cell-id="delete-key-confirm"
        footer={
          <div className={styles.confirmFooter}>
            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={confirmDelete} data-cell-id="confirm-delete">
              Delete
            </Button>
          </div>
        }
      >
        <p className={styles.confirmBody}>
          Delete key {deleteTarget?.label ? `"${deleteTarget.label}"` : maskKey(deleteTarget?.key ?? '')}?
          This cannot be undone.
        </p>
      </Dialog>
    </div>
  );
}

// === Inline edit (internal) ===

interface InlineEditProps {
  readonly label: string;
  readonly keyInput: string;
  readonly onLabelChange: (v: string) => void;
  readonly onKeyChange: (v: string) => void;
  readonly onSave: () => void;
  readonly onCancel: () => void;
}

function InlineEdit({
  label,
  keyInput,
  onLabelChange,
  onKeyChange,
  onSave,
  onCancel,
}: InlineEditProps): React.JSX.Element {
  return (
    <div className={styles.editRow} data-cell-id="inline-edit">
      <Input
        type="text"
        value={label}
        onChange={(e) => onLabelChange(e.target.value)}
        placeholder="Label (e.g. Free account)"
        aria-label="Key label"
        data-cell-id="akm-edit-label-input"
      />
      <Input
        type="password"
        autoComplete="off"
        spellCheck={false}
        value={keyInput}
        onChange={(e) => onKeyChange(e.target.value)}
        placeholder="New key (leave blank to keep)"
        aria-label="New API key value"
        data-cell-id="akm-edit-key-input"
      />
      <div className={styles.editActions}>
        <Button variant="ghost" size="sm" onClick={onCancel} data-cell-id="akm-edit-cancel">
          Cancel
        </Button>
        <Button variant="primary" size="sm" onClick={onSave} data-cell-id="akm-edit-save">
          Save
        </Button>
      </div>
    </div>
  );
}
