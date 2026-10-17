import { usePopupStore } from '@/entrypoints/popup/store/popupStore';
import { useActiveTabSubscription } from './useActiveTabSubscription';
import type {
  DetectedVideo,
  DetectedSubtitle,
} from '@/entities/media';
import type {
  DetectedMediaUpdatePayload,
} from '@/entities/message';

export function useDetectedMedia(): {
  videos: DetectedVideo[];
  subtitles: DetectedSubtitle[];
} {
  const videos = usePopupStore((state) => state.videos);
  const subtitles = usePopupStore((state) => state.subtitles);
  const setVideos = usePopupStore((state) => state.setVideos);
  const setSubtitles = usePopupStore((state) => state.setSubtitles);

  const apply = (data: DetectedMediaUpdatePayload): void => {
    setVideos(data.videos);
    setSubtitles(data.subtitles);
  };

  useActiveTabSubscription<DetectedMediaUpdatePayload, DetectedMediaUpdatePayload>({
    updateType: 'DETECTED_MEDIA_UPDATE',
    onUpdate: apply,
    fetchType: 'GET_DETECTED_MEDIA',
    onFetch: apply,
    retries: 3,
  });

  return { videos, subtitles };
}
