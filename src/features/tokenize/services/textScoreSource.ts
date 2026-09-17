import { startTokenScoreSource } from './tokenScoreSource';
import type { ComprehensionStore } from './comprehensionStore';
import type { WebTokenizeController } from '@/features/tokenize/controller/webTokenizeController';
import type { TokenBlock } from '@/features/tokenize/types';

export interface TextScoreSourceDeps {
  controller: WebTokenizeController;
  store: ComprehensionStore;
  langCode: string;
  onBlocksChanged: (listener: () => void) => () => void;
}

function blockSignature(blocks: readonly TokenBlock[]): string {
  if (blocks.length === 0) return '';
  let unprepared = 0;
  for (const b of blocks) {
    if (!b.tokens) unprepared++;
  }
  return `${blocks.length}:${unprepared}`;
}

export function startTextScoreSource(deps: TextScoreSourceDeps): () => void {
  const { controller, store } = deps;
  let stopInner: (() => void) | null = null;

  function start(): void {
    if (stopInner) return;
    stopInner = startTokenScoreSource({
      kind: 'text',
      langCode: deps.langCode,
      store,
      getSource: () => controller.getBlocks(),
      signature: blockSignature,
      tokenize: () => controller.getAllTokens(),
      subscribeChanges: (listener) => deps.onBlocksChanged(listener),
    });
  }

  function stop(): void {
    stopInner?.();
    stopInner = null;
    store.setStats('text', null);
  }

  const offState = controller.subscribe((s) => {
    if (s.enabled) start();
    else stop();
  });
  if (controller.getState().enabled) start();

  return () => {
    offState();
    stopInner?.();
    stopInner = null;
    store.setStats('text', null);
  };
}
