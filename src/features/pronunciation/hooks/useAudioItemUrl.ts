import { useCallback, useEffect, useRef, useState } from 'react';
import { createBlobUrl, revokeBlobUrl } from '@/shared/lib/blobUrl';
import type { AudioItem } from '@/entities/dictionary';

/**
 * Return a playable URL for an AudioItem, creating an in-memory blob URL
 * from `audioBytes` when no `url` is present. Revokes the created URL when
 * the item changes or the component unmounts.
 */
export function useAudioItemUrl(item: AudioItem | null | undefined): string | undefined {
  const [url, setUrl] = useState<string | undefined>(item?.url);

  useEffect(() => {
    let createdUrl: string | undefined;

    if (item?.url) {
      setUrl(item.url);
    } else if (item?.audioBytes) {
      createdUrl = typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
        ? createBlobUrl(item.audioBytes, 'audio/mpeg')
        : undefined;
      setUrl(createdUrl);
    } else {
      setUrl(undefined);
    }

    return (): void => {
      if (createdUrl) revokeBlobUrl(createdUrl);
    };
  }, [item?.id, item?.url, item?.audioBytes]);

  return url;
}

interface AudioItemUrlMapState {
  readonly map: ReadonlyMap<string, string>;
  readonly getUrl: (item: AudioItem) => string | undefined;
}

/**
 * Manage blob URLs for a list of AudioItems. Creates in-memory blob URLs for
 * any item that has `audioBytes` but no `url`, and revokes stale URLs when
 * items are removed or the component unmounts.
 */
export function useAudioItemUrlMap(items: readonly AudioItem[]): AudioItemUrlMapState {
  const mapRef = useRef(new Map<string, string>());

  const map = mapRef.current;

  const currentIds = new Set(items.map((item) => item.id));
  const canUseObjectUrl = typeof URL !== 'undefined'
    && typeof URL.createObjectURL === 'function'
    && typeof URL.revokeObjectURL === 'function';

  // Cleanup removed items on every render: this is the cheapest place to
  // guarantee memory is freed without needing a separate effect per item.
  for (const [id, url] of map) {
    if (!currentIds.has(id)) {
      if (canUseObjectUrl) revokeBlobUrl(url);
      map.delete(id);
    }
  }

  for (const item of items) {
    if (!map.has(item.id)) {
      if (item.url) {
        map.set(item.id, item.url);
      } else if (item.audioBytes && canUseObjectUrl) {
        map.set(item.id, createBlobUrl(item.audioBytes, 'audio/mpeg'));
      }
    }
  }

  useEffect(() => () => {
    const m = mapRef.current;
    for (const url of m.values()) {
      revokeBlobUrl(url);
    }
    m.clear();
  }, []);

  const getUrl = useCallback(
    (item: AudioItem): string | undefined => map.get(item.id),
    [map],
  );

  return { map, getUrl };
}
