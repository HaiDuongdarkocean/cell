import { useRef } from 'react';
import { t } from '@/shared/i18n';
import { MediaList } from '@/features/cardCreator/ui/MediaList';
import { putAudioAsset } from '@/features/srs/repositories/audioAssetRepository';
import { putImageAsset } from '@/features/srs/repositories/imageAssetRepository';
import { audioAssetId, imageAssetId } from '@/features/srs/lib/helpers';
import type { MediaFile } from '@/features/cardCreator/media/mediaFile';
import type { SrsAudioAsset, SrsField, SrsFieldValue, SrsImageAsset, SrsNote, SrsNotetype } from '@/entities/srs/types';
import styles from './SrsEditCardPanel.module.css';

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

export function storedMedia(
  field: SrsField,
  note: SrsNote,
  audioCache: ReadonlyMap<string, SrsAudioAsset>,
  imageCache: ReadonlyMap<string, SrsImageAsset>,
): MediaFile[] {
  const value = note.fields[field.id];
  if (!value) return [];
  if (field.type === 'audio' && value.kind === 'audio') {
    const asset = audioCache.get(audioAssetId(note.id, field.id, value.source));
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
  return [];
}

export async function persistNoteFields(
  notetype: SrsNotetype,
  note: SrsNote,
  texts: Record<string, string>,
  media: Record<string, MediaFile[]>,
): Promise<{ targetWord: string; fields: Record<string, SrsFieldValue> }> {
  const fields: Record<string, SrsFieldValue> = {};
  for (const field of notetype.fields) {
    if (field.type === 'audio' || field.type === 'image') {
      const file = media[field.id]?.[0];
      if (!file) continue;
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
        addLabel={`${t('srs.edit.add')} ${field.name}`}
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
