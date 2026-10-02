import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, Dialog, HintIcon, IconButton, InputField, Menu, MenuItem, SearchField, SegmentedControl, Select, Text } from '@/shared/ui';
import { Icon } from '@/shared/ui/Icon';
import { ICON_CATALOG } from '@/shared/icons';
import { t } from '@/shared/i18n';
import type { SrsDeck, SrsNote, SrsNotetype, SrsVariant, SrsVariantPreset } from '@/entities/srs/types';
import { SRS_INPUT_FIELD_ID } from '@/entities/srs/types';
import { ensureFirstRun } from '@/features/srs/services/firstRunService';
import { getCollection, putCollection } from '@/features/srs/repositories/collectionRepository';
import { getDecksByCollection, putDeck } from '@/features/srs/repositories/deckRepository';
import { getNotetypesByCollection } from '@/features/srs/repositories/notetypeRepository';
import { getNotesByDeck } from '@/features/srs/repositories/noteRepository';
import {
  deleteVariantPreset,
  ensureDefaultVariantPreset,
  getVariantPresetsByCollection,
  putVariantPreset,
} from '@/features/srs/repositories/variantPresetRepository';
import { createCustomVariant, createDefaultVariants, withResetBuiltinVariants } from '@/features/srs/lib/defaultVariants';
import { isVariantServable, resolveVariantToggles, variantFieldKind } from '@/features/srs/lib/variantFront';
import { generateId } from '@/features/srs/lib/helpers';
import { SrsVariantFront } from './SrsVariantFront';
import { variantLabel } from './srsLabels';
import styles from './SrsVariantsPanel.module.css';

interface FieldOption {
  readonly id: string;
  readonly label: string;
  readonly kind: string;
}

const EMPTY_AUDIO = new Map();
const EMPTY_IMAGES = new Map();
const PREVIEW_WORD = 'ephemeral';
const PREVIEW_SENTENCE = 'The joy of summer was ephemeral.';
const PREVIEW_AUDIO = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=';
const PREVIEW_IMAGE =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="64"><rect width="96" height="64" rx="8" fill="#8ab4f8"/><circle cx="30" cy="24" r="8" fill="#fff" opacity=".8"/><path d="M8 56 L34 32 L52 48 L66 36 L88 56 Z" fill="#fff" opacity=".9"/></svg>',
  );

function previewNote(notetype: SrsNotetype | undefined, sample: SrsNote | undefined): SrsNote {
  if (sample) return sample;
  const fields: SrsNote['fields'] = {};
  for (const f of notetype?.fields ?? []) {
    if (f.id === 'sentence') fields[f.id] = { kind: 'text', value: PREVIEW_SENTENCE };
    else if (f.type === 'audio') fields[f.id] = { kind: 'audio', value: [PREVIEW_AUDIO], source: 'local' };
    else if (f.type === 'image') fields[f.id] = { kind: 'image', value: [PREVIEW_IMAGE] };
    else if (f.type === 'list') fields[f.id] = { kind: 'list', value: ['example'] };
    else fields[f.id] = { kind: 'text', value: f.name };
  }
  return { id: '__preview__', notetypeId: notetype?.id ?? '', deckId: '', targetWord: PREVIEW_WORD, fields, createdAt: 0 };
}

function VariantPreview({ variant, note, notetype }: {
  readonly variant: SrsVariant;
  readonly note: SrsNote;
  readonly notetype: SrsNotetype | undefined;
}): React.JSX.Element {
  const [scope, setScope] = useState<'both' | 'word' | 'sentence'>('both');
  const [audio, setAudio] = useState<'word' | 'sentence'>('word');

  if (!isVariantServable(variant, note, notetype)) {
    return (
      <div className={styles.faceHidden}>
        <Icon name="eyeOff" size="md" />
        <span className={styles.faceHiddenHint}>{t('srs.variants.hiddenOnNote')}</span>
      </div>
    );
  }

  const resolved = resolveVariantToggles(variant, note);
  const toggles = { ...resolved, scope: resolved.scopeToggle ? scope : resolved.scope, audio: resolved.audioToggle ? audio : resolved.audio };
  const payload = Object.fromEntries(
    variant.fieldIds
      .filter((fid) => fid !== SRS_INPUT_FIELD_ID)
      .flatMap((fid) => {
        if (fid === 'target') return note.targetWord.trim() ? [[fid, { kind: 'text' as const, value: note.targetWord }]] : [];
        const v = note.fields[fid];
        return v ? [[fid, v]] : [];
      }),
  );

  return (
    <SrsVariantFront
      variant={variant}
      note={note}
      stimulus={{ type: `variant:${variant.id}`, payload }}
      toggles={toggles}
      onScopeChange={setScope}
      onAudioChange={setAudio}
      typedInput=""
      onTypedInputChange={() => {}}
      audioCache={EMPTY_AUDIO}
      imageCache={EMPTY_IMAGES}
      preview
    />
  );
}

function FieldChip({ option, active, onToggle }: {
  readonly option: FieldOption;
  readonly active: boolean;
  readonly onToggle: () => void;
}): React.JSX.Element {
  return (
    <button type="button" className={`${styles.chip} ${active ? styles.chipOn : ''}`} onClick={onToggle}>
      {option.kind === 'audio' && <Icon name="audioWave" size="xs" />}
      {option.kind === 'image' && <Icon name="image" size="xs" />}
      {option.kind === 'input' && <Icon name="pencil" size="xs" />}
      {option.label}
    </button>
  );
}

function LabelRow({ label, hint }: { readonly label: string; readonly hint?: string }): React.JSX.Element {
  return (
    <span className={styles.labelRow}>
      <span className={styles.label}>{label}</span>
      {hint && <HintIcon hint={hint} ariaLabel={label} />}
    </span>
  );
}

interface EditorProps {
  readonly variant: SrsVariant;
  readonly note: SrsNote;
  readonly notetype: SrsNotetype | undefined;
  readonly catalog: readonly FieldOption[];
  readonly onSave: (draft: SrsVariant) => void;
  readonly onDelete: (id: string) => void;
  readonly onClose: () => void;
}

function VariantEditor({ variant, note, notetype, catalog, onSave, onDelete, onClose }: EditorProps): React.JSX.Element {
  const [draft, setDraft] = useState<SrsVariant>(variant);
  const [confirming, setConfirming] = useState(false);
  const invalid = !draft.name.trim() || draft.fieldIds.length === 0 || draft.newLoops < 1 || draft.newLoops > 3;

  const toggleField = (fieldId: string) => {
    setDraft((d) => ({
      ...d,
      fieldIds: d.fieldIds.includes(fieldId) ? d.fieldIds.filter((f) => f !== fieldId) : [...d.fieldIds, fieldId],
    }));
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }} title={t('srs.variants.editVariant')} size="md">
      <div className={styles.sheetBody}>
        <div className={styles.hero}>
          <VariantPreview variant={draft} note={note} notetype={notetype} />
        </div>

        <InputField
          className={styles.nameInput}
          label={t('srs.variants.namePlaceholder')}
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          placeholder={variant.builtin ? variantLabel(variant) : t('srs.variants.namePlaceholder')}
        />

        <div className={styles.group}>
          <LabelRow label={t('srs.variants.frontFields')} hint={t('srs.variants.frontFieldsHint')} />
          <div className={styles.chips}>
            {catalog.map((f) => (
              <FieldChip key={f.id} option={f} active={draft.fieldIds.includes(f.id)} onToggle={() => toggleField(f.id)} />
            ))}
          </div>
        </div>

        <div className={styles.group}>
          <LabelRow label={t('srs.variants.loops')} hint={t('srs.variants.loopsHint')} />
          <SegmentedControl
            ariaLabel={t('srs.variants.loops')}
            options={[{ value: '1', label: '1×' }, { value: '2', label: '2×' }, { value: '3', label: '3×' }]}
            value={String(draft.newLoops)}
            onChange={(v) => setDraft((d) => ({ ...d, newLoops: Number(v) }))}
          />
        </div>

        <Text className={styles.footNote}>{t('srs.variants.backNote')}</Text>

        <div className={styles.foot}>
          {confirming ? (
            <>
              <Text className={styles.confirmText}>{t('srs.variants.deleteVariantConfirm')}</Text>
              <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>{t('srs.edit.cancel')}</Button>
              <Button size="sm" variant="destructive" onClick={() => onDelete(variant.id)}>{t('srs.manage.delete')}</Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="ghost" className={styles.deleteGhost} leadingIcon={<Icon name="trash" size="sm" />}
                onClick={() => setConfirming(true)}>
                {t('srs.manage.delete')}
              </Button>
              <Button size="sm" variant="primary" leadingIcon={<Icon name="check" size="sm" />} disabled={invalid}
                onClick={() => onSave(draft)}>
                {t('srs.edit.save')}
              </Button>
            </>
          )}
        </div>
      </div>
    </Dialog>
  );
}

export function SrsVariantsPanel(): React.JSX.Element | null {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [collectionId, setCollectionId] = useState('');
  const [decks, setDecks] = useState<readonly SrsDeck[]>([]);
  const [presets, setPresets] = useState<readonly SrsVariantPreset[]>([]);
  const [defaultPresetId, setDefaultPresetId] = useState<string | null>(null);
  const [notetypes, setNotetypes] = useState<readonly SrsNotetype[]>([]);
  const [note, setNote] = useState<SrsNote | undefined>(undefined);

  const [scopeDeckId, setScopeDeckId] = useState<string>('');
  const [presetId, setPresetId] = useState<string>('');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [presetDialog, setPresetDialog] = useState<'new' | 'rename' | 'delete' | 'reset' | null>(null);
  const [presetName, setPresetName] = useState('');
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);

  const load = useCallback(async () => {
    const { collectionId: cid } = await ensureFirstRun();
    const [collection, deckList, , ntList] = await Promise.all([
      getCollection(cid),
      getDecksByCollection(cid),
      ensureDefaultVariantPreset(cid),
      getNotetypesByCollection(cid),
    ]);
    const presetList = await getVariantPresetsByCollection(cid);
    let sample: SrsNote | undefined;
    for (const d of deckList) {
      const notes = await getNotesByDeck(d.id);
      if (notes.length > 0) { sample = notes[0]; break; }
    }
    setCollectionId(cid);
    setDecks(deckList);
    setPresets(presetList);
    setDefaultPresetId(collection?.defaultVariantPresetId ?? presetList.find((p) => p.isDefault)?.id ?? presetList[0]?.id ?? null);
    setNotetypes(ntList);
    setNote(sample);
    setLoading(false);
  }, []);

  useEffect(() => {
    load().catch((err) => {
      setLoadError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    });
  }, [load]);

  const scopeDeck = decks.find((d) => d.id === scopeDeckId);
  const effectivePresetId = scopeDeck ? (scopeDeck.variantPresetId ?? defaultPresetId) : defaultPresetId;
  const preset = presets.find((p) => p.id === (presetId || effectivePresetId)) ?? presets[0];

  const catalog = useMemo<readonly FieldOption[]>(() => {
    const seen = new Map<string, FieldOption>();
    seen.set('target', { id: 'target', label: t('srs.variants.fieldTarget'), kind: 'target' });
    for (const nt of notetypes) {
      for (const f of nt.fields) {
        if (!seen.has(f.id)) seen.set(f.id, { id: f.id, label: f.name, kind: variantFieldKind(f.id, nt) });
      }
    }
    seen.set(SRS_INPUT_FIELD_ID, { id: SRS_INPUT_FIELD_ID, label: t('srs.variants.fieldInput'), kind: 'input' });
    return [...seen.values()];
  }, [notetypes]);

  const previewMaterial = useMemo(() => previewNote(notetypes[0], note), [notetypes, note]);

  const filtered = useMemo(
    () => (preset?.variants ?? [])
      .slice()
      .sort((a, b) => a.order - b.order)
      .filter((v) => variantLabel(v).toLowerCase().includes(query.trim().toLowerCase())),
    [preset, query],
  );

  const savePreset = useCallback(async (next: SrsVariantPreset) => {
    await putVariantPreset(next);
    setPresets((list) => list.map((p) => (p.id === next.id ? next : p)));
  }, []);

  const assignPreset = useCallback(async (pid: string) => {
    if (scopeDeck) {
      await putDeck({ ...scopeDeck, variantPresetId: pid === scopeDeck.variantPresetId || pid === '' ? null : pid });
      setDecks((list) => list.map((d) => (d.id === scopeDeck.id ? { ...d, variantPresetId: pid || null } : d)));
    } else if (collectionId) {
      const collection = await getCollection(collectionId);
      if (collection) await putCollection({ ...collection, defaultVariantPresetId: pid });
      setDefaultPresetId(pid);
    }
    setPresetId(pid);
  }, [scopeDeck, collectionId]);

  const saveVariant = useCallback(async (draft: SrsVariant) => {
    if (!preset) return;
    const exists = preset.variants.some((v) => v.id === draft.id);
    await savePreset({
      ...preset,
      variants: exists
        ? preset.variants.map((v) => (v.id === draft.id ? draft : v))
        : [...preset.variants, draft],
    });
    setEditingId(null);
    setCreating(false);
  }, [preset, savePreset]);

  const removeVariant = useCallback(async (id: string) => {
    if (!preset) return;
    await savePreset({ ...preset, variants: preset.variants.filter((v) => v.id !== id) });
    setEditingId(null);
    setCreating(false);
  }, [preset, savePreset]);

  const handlePresetDialog = useCallback(async () => {
    if (!preset) return;
    if (presetDialog === 'new') {
      const name = presetName.trim();
      if (!name) return;
      const created: SrsVariantPreset = {
        id: `vpreset-${generateId()}`,
        collectionId,
        name,
        variants: createDefaultVariants(),
        isDefault: false,
        createdAt: Date.now(),
      };
      await putVariantPreset(created);
      setPresets((list) => [...list, created]);
      await assignPreset(created.id);
    } else if (presetDialog === 'rename') {
      const name = presetName.trim();
      if (!name) return;
      await savePreset({ ...preset, name });
    } else if (presetDialog === 'delete') {
      await deleteVariantPreset(preset.id);
      setPresets((list) => list.filter((p) => p.id !== preset.id));
      setDecks((list) => list.map((d) => (d.variantPresetId === preset.id ? { ...d, variantPresetId: null } : d)));
      setPresetId('');
    } else if (presetDialog === 'reset') {
      await savePreset(withResetBuiltinVariants(preset));
    }
    setPresetDialog(null);
    setPresetName('');
  }, [presetDialog, preset, presetName, collectionId, assignPreset, savePreset]);

  const openNew = useCallback(() => {
    setCreating(true);
    setEditingId(`__new__`);
  }, []);

  if (loading) return null;
  if (loadError) return <div className={styles.empty}>{loadError}</div>;
  if (!preset) return null;

  const editing: SrsVariant | undefined = creating
    ? createCustomVariant(preset.variants.length)
    : preset.variants.find((v) => v.id === editingId);

  const presetOptions = presets.map((p) => ({
    value: p.id,
    label: p.id === defaultPresetId ? `${p.name} · ${t('srs.variants.scopeCollection')}` : p.name,
  }));

  return (
    <div className={styles.root}>
      <div className={styles.bar}>
        <Select
          size="sm"
          className={styles.scopeSelect}
          value={scopeDeckId}
          onChange={(v) => { setScopeDeckId(v); setPresetId(''); }}
          options={[{ value: '', label: t('srs.variants.scopeCollection') }, ...decks.map((d) => ({ value: d.id, label: d.name }))]}
          aria-label={t('srs.variants.scope')}
        />
        <Select
          size="sm"
          className={styles.presetSelect}
          value={scopeDeck && !scopeDeck.variantPresetId ? '' : preset.id}
          onChange={(v) => { void assignPreset(v || (defaultPresetId ?? '')); }}
          options={[
            ...(scopeDeck ? [{ value: '', label: t('srs.variants.inherit', [presets.find((p) => p.id === defaultPresetId)?.name ?? ''] ) }] : []),
            ...presetOptions,
          ]}
          aria-label={t('srs.variants.preset')}
        />
        <div className={styles.barActions}>
          {searchOpen ? (
            <SearchField value={query} onChange={setQuery} placeholder={t('srs.variants.search')} aria-label={t('srs.variants.search')} className={styles.search} />
          ) : (
            <IconButton variant="ghost" size="sm" aria-label={t('srs.variants.search')} onClick={() => setSearchOpen(true)}>
              <Icon name="search" size="sm" />
            </IconButton>
          )}
          <IconButton
            ref={menuTriggerRef}
            variant="ghost"
            size="sm"
            aria-label={t('srs.variants.preset')}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <Icon name="ellipsisVertical" size="sm" />
          </IconButton>
          <Menu open={menuOpen} onClose={() => setMenuOpen(false)} triggerRef={menuTriggerRef} align="right" ariaLabel={t('srs.variants.preset')}>
            <MenuItem icon={<Icon name="plus" size="sm" />} onSelect={() => { setMenuOpen(false); setPresetName(''); setPresetDialog('new'); }}>
              {t('srs.variants.newPreset')}
            </MenuItem>
            <MenuItem icon={<Icon name="pencil" size="sm" />} onSelect={() => { setMenuOpen(false); setPresetName(preset.name); setPresetDialog('rename'); }}>
              {t('srs.variants.renamePreset')}
            </MenuItem>
            <MenuItem icon={<Icon name="trash" size="sm" />} onSelect={() => { setMenuOpen(false); setPresetDialog('delete'); }} disabled={preset.isDefault}>
              {t('srs.variants.deletePreset')}
            </MenuItem>
            <MenuItem icon={<Icon name="rotateCcw" size="sm" />} onSelect={() => { setMenuOpen(false); setPresetDialog('reset'); }}>
              {t('srs.variants.resetDefaults')}
            </MenuItem>
          </Menu>
          <Button size="sm" variant="primary" leadingIcon={<Icon name="plus" size="sm" />} onClick={openNew}>
            {t('srs.variants.new')}
          </Button>
        </div>
      </div>

      {scopeDeck && !scopeDeck.variantPresetId && (
        <Text className={styles.inheritNote}>{t('srs.variants.inheritingNote')}</Text>
      )}

      <div className={styles.shelf}>
        {filtered.map((v) => {
          const ok = isVariantServable(v, previewMaterial, notetypes[0]);
          return (
            <button key={v.id} className={`${styles.tile} ${ok ? '' : styles.tileDim}`} onClick={() => { setCreating(false); setEditingId(v.id); }}>
              <VariantPreview variant={v} note={previewMaterial} notetype={notetypes[0]} />
              <div className={styles.tileFoot}>
                <Icon name={(v.icon && v.icon in ICON_CATALOG ? v.icon : 'layers') as keyof typeof ICON_CATALOG} size="sm" />
                <span className={styles.tileName}>{variantLabel(v)}</span>
                {v.builtin && <Badge size="sm">{t('srs.variants.builtin')}</Badge>}
                <span className={styles.loops}>{v.newLoops}×</span>
              </div>
            </button>
          );
        })}
        <button className={`${styles.tile} ${styles.tileAdd}`} onClick={openNew} aria-label={t('srs.variants.newVariant')}>
          <Icon name="plus" size="lg" />
          <span>{t('srs.variants.newVariant')}</span>
        </button>
      </div>
      {filtered.length === 0 && <div className={styles.empty}>{t('srs.variants.empty', [query])}</div>}

      {(editing || creating) && editing && (
        <VariantEditor
          variant={editing}
          note={previewMaterial}
          notetype={notetypes[0]}
          catalog={catalog}
          onSave={(d) => { void saveVariant(d); }}
          onDelete={(id) => { void removeVariant(id); }}
          onClose={() => { setEditingId(null); setCreating(false); }}
        />
      )}

      <Dialog
        open={presetDialog === 'new' || presetDialog === 'rename'}
        onOpenChange={(o) => { if (!o) setPresetDialog(null); }}
        title={presetDialog === 'new' ? t('srs.variants.newPreset') : t('srs.variants.renamePreset')}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPresetDialog(null)}>{t('srs.edit.cancel')}</Button>
            <Button variant="primary" disabled={!presetName.trim()} onClick={() => { void handlePresetDialog(); }}>{t('srs.edit.save')}</Button>
          </>
        }
      >
        <InputField
          label={t('srs.variants.presetName')}
          value={presetName}
          onChange={(e) => setPresetName(e.target.value)}
          autoFocus
        />
      </Dialog>

      <Dialog
        open={presetDialog === 'delete'}
        onOpenChange={(o) => { if (!o) setPresetDialog(null); }}
        title={t('srs.variants.deletePreset')}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPresetDialog(null)}>{t('srs.edit.cancel')}</Button>
            <Button variant="destructive" onClick={() => { void handlePresetDialog(); }}>{t('srs.manage.delete')}</Button>
          </>
        }
      >
        <Text>{t('srs.variants.deletePresetConfirm')}</Text>
      </Dialog>

      <Dialog
        open={presetDialog === 'reset'}
        onOpenChange={(o) => { if (!o) setPresetDialog(null); }}
        title={t('srs.variants.resetDefaults')}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPresetDialog(null)}>{t('srs.edit.cancel')}</Button>
            <Button variant="primary" onClick={() => { void handlePresetDialog(); }}>{t('srs.edit.save')}</Button>
          </>
        }
      >
        <Text>{t('srs.variants.resetDefaultsConfirm')}</Text>
      </Dialog>
    </div>
  );
}
