import type { MediaFile, MediaKind } from '../media/mediaFile';
import { mediaKindMap, type MediaListKind } from '../state/mediaListKinds';

export function pickMediaFilesFromDisk(kind: MediaListKind): Promise<MediaFile[]> {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = kind === 'images' ? 'image/*' : 'audio/*';
  input.multiple = true;
  input.style.display = 'none';
  document.body.appendChild(input);
  const picked = new Promise<MediaFile[]>((resolve) => {
    input.onchange = () => {
      const files = Array.from(input.files ?? []);
      void Promise.all(
        files.map(async (f) => {
          const data = await f.arrayBuffer();
          const mediaKind: MediaKind = mediaKindMap[kind];
          return {
            kind: mediaKind,
            filename: f.name,
            mimeType: f.type || (mediaKind === 'image' ? 'image/png' : 'audio/webm'),
            data,
          } satisfies MediaFile;
        }),
      ).then(resolve);
    };
    input.addEventListener('cancel', () => resolve([]));
  });
  input.click();
  return picked.finally(() => input.remove());
}
