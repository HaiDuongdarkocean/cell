import { useRef } from 'react';
import { t } from '@/shared/i18n';
import { MediaList } from '@/features/cardCreator/ui/MediaList';
import { putAudioAsset } from '@/features/srs/repositories/audioAssetRepository';
import { putImageAsset } from '@/features/srs/repositories/imageAssetRepository';
import { audioAssetId, imageAssetId } from '@/features/srs/lib/helpers';
import type { MediaFile } from '@/features/cardCreator/media/mediaFile';
import { fetchMediaFile } from '@/features/cardCreator/media/mediaFile';
import type { SrsAudioAsset, SrsField, SrsFieldValue, SrsImageAsset, SrsNote, SrsNotetype } from '@/entities/srs/types';
import styles from './SrsEditCardPanel.module.css';

export function orderedEditFields(fields: readonly SrsField[]): readonly SrsField[] {
  const translationIndex = fields.findIndex((f) => f.id === 'translation');
  const sentenceIndex = fields.findIndex((f) => f.id === 'sentence');
  if (translationIndex === -1 || sentenceIndex === -1 || translationIndex === sentenceIndex + 1) return fields;
  const rest = fields.filter((_, i) => i !== translationIndex);
  const insertAt = rest.findIndex((f) => f.id === 'sentence') + 1;
  return [...rest.slice(0, insertAt), fields[translationIndex], ...rest.slice(insertAt)];
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
  if (field.type === 'audio' && value.kind === 'audio') {
    const asset =
      audioCache.get(audioAssetId(note.id, field.id, value.source)) ??
      [...audioCache.values()].find((a) => a.noteId === note.id && a.fieldId === field.id);
    if (asset) {
      return [{ kind: 'audio', filename: value.value, mimeType: asset.mimeType, data: asset.bytes }];
    }
  }
  if (field.type === 'image' && value.kind === 'image') {
    const asset = imageCache.get(imageAssetId(note.id, field.id));
    if (asset) {
      return [{ kind: 'image', filename: value.value, mimeType: asset.mimeType, data: asset.bytes }];
    }
  }
  if ((value.kind === 'audio' || value.kind === 'image') && /^(https?|data):/.test(value.value)) {
    const fetched = await fetchMediaFile(value.value, field.type === 'image' ? 'image' : 'audio').catch(() => null);
    if (fetched) return [fetched];
  }
  return [];
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
    if (field.type === 'audio' || field.type === 'image') {
      const file = media[field.id]?.[0];
      if (!file) {
        const existing = note.fields[field.id];
        if (existing && !removedMedia?.has(field.id)) fields[field.id] = existing;
        continue;
      }
      if (field.type === 'audio') {
        await putAudioAsset({
          id: audioAssetId(note.id, field.id, 'local'),
          noteId: note.id,
          fieldId: field.id,
          source: 'local',
          mimeType: file.mimeType,
          bytes: file.data,
          size: file.data.byteLength,
          lastAccessed: Date.now(),
          createdAt: Date.now(),
        });
        fields[field.id] = { kind: 'audio', value: file.filename, source: 'local' };
      } else {
        await putImageAsset({
          id: imageAssetId(note.id, field.id),
          noteId: note.id,
          fieldId: field.id,
          mimeType: file.mimeType,
          bytes: file.data,
          size: file.data.byteLength,
          lastAccessed: Date.now(),
          createdAt: Date.now(),
        });
        fields[field.id] = { kind: 'image', value: file.filename };
      }
      continue;
    }
    const value = toFieldValue(field, texts[field.id] ?? '');
    if (value) fields[field.id] = value;
  }
  const targetWord = (texts[notetype.targetFieldId] ?? note.targetWord).trim() || note.targetWord;
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
        onRemove={() => { onChange([]); }}
        onFilesDrop={(dropped) => {
          const first = dropped[0];
          if (first) onChange([first]);
        }}
        dataId={`srs-edit-${field.id}`}
      />
      <input
        ref={inputRef}
        type="file"
        accept={field.type === 'image' ? 'image/*' : 'audio/*'}
        className={styles.fileInput}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void fileToMedia(file, field).then((mf) => { onChange([mf]); });
          e.target.value = '';
        }}
      />
    </>
  );
}
