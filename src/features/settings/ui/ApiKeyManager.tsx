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
 * Pure helpers (`maskKey`, `groupKeysByProvider`, `statusBadgeVariant`) are
 * exported for unit testing.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BadgeProps } from '@/shared/ui/Badge';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Dialog } from '@/shared/ui/Dialog';
import { Input } from '@/shared/ui/Input';
import { Select } from '@/shared/ui/Select';
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

/** Map a key status to the Badge variant (active=green, rate-limited=amber,
 *  invalid=red, unverified=gray). */
export function statusBadgeVariant(
  status: SubtitleApiKeyStatus,
): NonNullable<BadgeProps['variant']> {
  switch (status) {
    case 'active':
      return 'success';
    case 'rate-limited':
      return 'warning';
    case 'invalid':
      return 'destructive';
    case 'unverified':
    default:
      return 'default';
  }
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
      // Nothing changed — just close.
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
                // Replacing the key value resets status to unverified (spec:
                // no validate-on-add; first 200 → active is background's job).
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

  return (
    <div className={styles.root} data-cell-id="api-key-manager">
      {PROVIDERS.map((provider) => {
        const groupKeys = grouped[provider];
        return (
          <div key={provider} className={styles.providerGroup} data-cell-id={`provider-${provider}`}>
            <div className={styles.providerHeader}>{PROVIDER_LABELS[provider]}</div>

            {groupKeys.length === 0 && (
              <p className={styles.emptyHint}>No {PROVIDER_LABELS[provider]} keys yet.</p>
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
                      <div className={styles.keyCardRow}>
                        <span className={styles.keyLabel}>{k.label ?? PROVIDER_LABELS[k.provider]}</span>
                        <span className={styles.keyMasked}>{maskKey(k.key)}</span>
                        <Badge
                          variant={statusBadgeVariant(k.status)}
                          size="sm"
                          data-cell-id={`key-status-${k.id}`}
                        >
                          {STATUS_LABELS[k.status]}
                        </Badge>
                        {q && (
                          <span className={styles.keyMeta} data-cell-id={`key-quota-${k.id}`}>
                            · {q.remainingDownloads} left
                          </span>
                        )}
                        {k.status === 'rate-limited' && k.rateLimitedUntil && (
                          <span className={styles.keyMeta}>
                            until {new Date(k.rateLimitedUntil).toLocaleTimeString()}
                          </span>
                        )}
                        <span className={styles.keyActions}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startEdit(k)}
                            aria-label={`Edit key ${k.label ?? k.id}`}
                            data-cell-id={`key-edit-${k.id}`}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTarget(k)}
                            aria-label={`Delete key ${k.label ?? k.id}`}
                            data-cell-id={`key-delete-${k.id}`}
                          >
                            Delete
                          </Button>
                        </span>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

      {/* Single add-key form with provider select (task: provider select lets
          user choose target group). Rendered once at the bottom to avoid
          duplicate HTML ids / shared-state double-mount. */}
      <AddKeyForm
        provider={addProvider}
        keyValue={addKey}
        labelValue={addLabel}
        onProviderChange={setAddProvider}
        onKeyChange={setAddKey}
        onLabelChange={setAddLabel}
        onAdd={handleAdd}
        canAdd={canAdd}
      />

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

// === Add-key form (internal) ===

interface AddKeyFormProps {
  readonly provider: SubtitleApiKeyProvider;
  readonly keyValue: string;
  readonly labelValue: string;
  readonly onProviderChange: (p: SubtitleApiKeyProvider) => void;
  readonly onKeyChange: (v: string) => void;
  readonly onLabelChange: (v: string) => void;
  readonly onAdd: () => void;
  readonly canAdd: boolean;
  readonly 'data-cell-id'?: string;
}

function AddKeyForm({
  provider,
  keyValue,
  labelValue,
  onProviderChange,
  onKeyChange,
  onLabelChange,
  onAdd,
  canAdd,
  'data-cell-id': dataCellId,
}: AddKeyFormProps): React.JSX.Element {
  return (
    <div className={styles.addForm} data-cell-id={dataCellId ?? 'add-key-form'}>
      <div className={styles.addFormRow}>
        <label className={styles.addFormLabel} htmlFor="akm-provider">Provider</label>
        <Select
          id="akm-provider"
          data-cell-id="akm-provider-select"
          aria-label="Select key provider"
          value={provider}
          options={PROVIDER_OPTIONS}
          onChange={(v) => onProviderChange(v as SubtitleApiKeyProvider)}
        />
      </div>
      <div className={styles.addFormRow}>
        <label className={styles.addFormLabel} htmlFor="akm-key">API key</label>
        <Input
          id="akm-key"
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={keyValue}
          onChange={(e) => onKeyChange(e.target.value)}
          placeholder="Paste your API key"
          data-cell-id="akm-key-input"
        />
      </div>
      <div className={styles.addFormRow}>
        <label className={styles.addFormLabel} htmlFor="akm-label">Label (optional)</label>
        <Input
          id="akm-label"
          type="text"
          autoComplete="off"
          value={labelValue}
          onChange={(e) => onLabelChange(e.target.value)}
          placeholder="e.g. Free #1"
          data-cell-id="akm-label-input"
        />
      </div>
      <div className={styles.addFormActions}>
        <Button
          variant="primary"
          size="sm"
          onClick={onAdd}
          disabled={!canAdd}
          data-cell-id="akm-add-btn"
        >
          Add
        </Button>
      </div>
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
      <div className={styles.addFormRow}>
        <label className={styles.addFormLabel} htmlFor="akm-edit-label">Label</label>
        <Input
          id="akm-edit-label"
          type="text"
          value={label}
          onChange={(e) => onLabelChange(e.target.value)}
          data-cell-id="akm-edit-label-input"
        />
      </div>
      <div className={styles.addFormRow}>
        <label className={styles.addFormLabel} htmlFor="akm-edit-key">New key (leave blank to keep)</label>
        <Input
          id="akm-edit-key"
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={keyInput}
          onChange={(e) => onKeyChange(e.target.value)}
          placeholder="•••• (unchanged)"
          data-cell-id="akm-edit-key-input"
        />
      </div>
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
