import { useRef } from 'react';
import { t } from '@/shared/i18n';
import { MediaList } from '@/features/cardCreator/ui/MediaList';
import { putAudioAsset } from '@/features/srs/repositories/audioAssetRepository';
import { putImageAsset } from '@/features/srs/repositories/imageAssetRepository';
import { audioAssetId, imageAssetId, mediaFieldValues } from '@/features/srs/lib/helpers';
import type { MediaFile } from '@/features/cardCreator/media/mediaFile';
import { fetchMediaFile } from '@/features/cardCreator/media/mediaFile';
import type { SrsAudioAsset, SrsField, SrsFieldValue, SrsImageAsset, SrsNote, SrsNotetype } from '@/entities/srs/types';
import styles from './SrsEditCardPanel.module.css';

export function orderedEditFields(fields: readonly SrsField[]): readonly SrsField[] {
  const visible = fields.filter((f) => f.id !== 'context' && f.id !== 'ipa');
  const translationIndex = visible.findIndex((f) => f.id === 'translation');
  const sentenceIndex = visible.findIndex((f) => f.id === 'sentence');
  if (translationIndex === -1 || sentenceIndex === -1 || translationIndex === sentenceIndex + 1) return visible;
  const rest = visible.filter((_, i) => i !== translationIndex);
  const insertAt = rest.findIndex((f) => f.id === 'sentence') + 1;
  return [...rest.slice(0, insertAt), visible[translationIndex], ...rest.slice(insertAt)];
}

export function toEditText(value: SrsFieldValue | undefined): string {
  if (!value) return '';
  if (value.kind === 'list') return value.value.join('\n');
  if (value.kind === 'audio' || value.kind === 'image') return '';
  return value.value;
}

export function toFieldValue(field: SrsField, text: string): SrsFieldValue | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  if (field.type === 'list') {
    return { kind: 'list', value: trimmed.split('\n').map((l) => l.trim()).filter(Boolean) };
  }
  if (field.type === 'translation') return { kind: 'translation', value: trimmed };
  if (field.type === 'context') return { kind: 'context', value: trimmed };
  return { kind: 'text', value: trimmed };
}

export async function storedMedia(
  field: SrsField,
  note: SrsNote,
  audioCache: ReadonlyMap<string, SrsAudioAsset>,
  imageCache: ReadonlyMap<string, SrsImageAsset>,
): Promise<MediaFile[]> {
  const value = note.fields[field.id];
  if (!value) return [];
  const items = mediaFieldValues(value);
  const resolved = await Promise.all(items.map(async (v, i): Promise<MediaFile | null> => {
    if (field.type === 'audio' && value.kind === 'audio') {
      const asset =
        audioCache.get(audioAssetId(note.id, field.id, value.source, i)) ??
        [...audioCache.values()].find((a) => a.noteId === note.id && a.fieldId === field.id && (a.index ?? 0) === i);
      if (asset) {
        return { kind: 'audio', filename: v, mimeType: asset.mimeType, data: asset.bytes };
      }
    }
    if (field.type === 'image' && value.kind === 'image') {
      const asset =
        imageCache.get(imageAssetId(note.id, field.id, i)) ??
        [...imageCache.values()].find((a) => a.noteId === note.id && a.fieldId === field.id && (a.index ?? 0) === i);
      if (asset) {
        return { kind: 'image', filename: v, mimeType: asset.mimeType, data: asset.bytes };
      }
    }
    if ((value.kind === 'audio' || value.kind === 'image') && /^(https?|data):/.test(v)) {
      const fetched = await fetchMediaFile(v, field.type === 'image' ? 'image' : 'audio').catch(() => null);
      if (fetched) return fetched;
    }
    return null;
  }));
  return resolved.filter((f): f is MediaFile => f !== null);
}

export async function persistNoteFields(
  notetype: SrsNotetype,
  note: SrsNote,
  texts: Record<string, string>,
  media: Record<string, MediaFile[]>,
  removedMedia?: ReadonlySet<string>,
): Promise<{ targetWord: string; fields: Record<string, SrsFieldValue> }> {
  const fields: Record<string, SrsFieldValue> = {};
  for (const field of notetype.fields) {
    if (field.id === 'ipa') continue;
    if (field.type === 'audio' || field.type === 'image') {
      const files = media[field.id] ?? [];
      const existing = note.fields[field.id];
      if (files.length === 0) {
        if (existing && !removedMedia?.has(field.id)) fields[field.id] = existing;
        continue;
      }
      if (field.type === 'audio') {
        const source = existing?.kind === 'audio' ? existing.source : 'local';
        const filenames: string[] = [];
        for (const [i, file] of files.entries()) {
          await putAudioAsset({
            id: audioAssetId(note.id, field.id, source, i),
            noteId: note.id,
            fieldId: field.id,
            index: i || undefined,
            source,
            mimeType: file.mimeType,
            bytes: file.data,
            size: file.data.byteLength,
            lastAccessed: Date.now(),
            createdAt: Date.now(),
          });
          filenames.push(file.filename);
        }
        fields[field.id] = { kind: 'audio', value: filenames, source };
      } else {
        const filenames: string[] = [];
        for (const [i, file] of files.entries()) {
          await putImageAsset({
            id: imageAssetId(note.id, field.id, i),
            noteId: note.id,
            fieldId: field.id,
            index: i || undefined,
            mimeType: file.mimeType,
            bytes: file.data,
            size: file.data.byteLength,
            lastAccessed: Date.now(),
            createdAt: Date.now(),
          });
          filenames.push(file.filename);
        }
        fields[field.id] = { kind: 'image', value: filenames };
      }
      continue;
    }
    const value = toFieldValue(field, texts[field.id] ?? '');
    if (value) fields[field.id] = value;
  }
  const targetWord = (texts[notetype.targetFieldId] ?? note.targetWord).trim();
  return { targetWord, fields };
}

export async function fileToMedia(file: File, field: SrsField): Promise<MediaFile> {
  return {
    kind: field.type === 'image' ? 'image' : 'audio',
    filename: file.name,
    mimeType: file.type || (field.type === 'image' ? 'image/png' : 'audio/mpeg'),
    data: await file.arrayBuffer(),
  };
}

interface MediaFieldProps {
  readonly field: SrsField;
  readonly files: readonly MediaFile[];
  readonly onChange: (files: MediaFile[]) => void;
}

export function NoteMediaField({ field, files, onChange }: MediaFieldProps): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <MediaList
        files={files}
        kind={field.type === 'image' ? 'image' : 'audio'}
        addLabel={t('srs.edit.add')}
        onAdd={() => inputRef.current?.click()}
        onRemove={(index) => { onChange(files.filter((_, i) => i !== index)); }}
        onFilesDrop={(dropped) => {
          if (dropped.length > 0) onChange([...files, ...dropped]);
        }}
        onReorder={(from, to) => {
          const next = [...files];
          const [moved] = next.splice(from, 1);
          if (moved) next.splice(to, 0, moved);
          onChange(next);
        }}
        dataId={`srs-edit-${field.id}`}
      />
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={field.type === 'image' ? 'image/*' : 'audio/*'}
        className={styles.fileInput}
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []);
          if (picked.length > 0) {
            void Promise.all(picked.map((f) => fileToMedia(f, field))).then((mfs) => {
              onChange([...files, ...mfs]);
            });
          }
          e.target.value = '';
        }}
      />
    </>
  );
}
