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

const blockTextHashes = new WeakMap<Element, { text: string; hash: number }>();

function textHash(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return hash;
}

function blockSignature(blocks: readonly TokenBlock[]): string {
  let live = 0;
  let unprepared = 0;
  let hash = 0;
  for (const b of blocks) {
    if (!b.element.isConnected) continue;
    live++;
    if (!b.tokens) unprepared++;
    let memo = blockTextHashes.get(b.element);
    if (memo === undefined || memo.text !== b.originalText) {
      memo = { text: b.originalText, hash: textHash(b.originalText) };
      blockTextHashes.set(b.element, memo);
    }
    hash = (hash * 31 + memo.hash) | 0;
  }
  if (live === 0) return '';
  return `${live}:${unprepared}:${hash}`;
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
      tokenize: (blocks) => blocks.flatMap((b) => (b.element.isConnected && b.tokens ? b.tokens : [])),
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
