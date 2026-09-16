/**
 * cardCreatorActionPorts — composition-root wiring for the subtitle feature's
 * CardCreatorPorts contract (see features/subtitle/actions/subtitleActionContext).
 *
 * Subtitle never imports cardCreator; the entrypoint calls this factory and
 * injects the result into SubtitleActionContext.cardCreator. The return type
 * is intentionally inferred — the port interface lives in the subtitle
 * feature and is satisfied structurally, keeping the dependency arrow
 * one-directional (entrypoints → both features).
 */
import { buildCardCreatorContext } from '../ui/mountCardCreatorDialog';
import { captureScreenshot } from '../media/screenshot';
import { captureSentenceAudio } from '../media/sentenceAudio';
import { prefetchAnkiConnectData } from './cardCreatorPrefetch';
import { useCardCreatorStore } from '../state/cardCreatorStore';

export function createCardCreatorActionPorts() {
  return {
    buildContext: buildCardCreatorContext,
    captureScreenshot,
    captureSentenceAudio,
    prefetchAnkiConnectData,
    setCapturingMedia: (capturing: boolean): void => {
      useCardCreatorStore.getState().setCapturingMedia(capturing);
    },
  };
}
