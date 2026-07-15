import { NAV_CLUSTER_ICONS } from './navClusterIcons';
import { CARD_CREATOR_ICONS } from '@/features/cardCreator/ui/cardCreatorIcons';

/**
 * Generate native subtitle icon: 2 arrows ngược chiều (→ trên, ← dưới).
 * Gợi ý translate/exchange — target ↔ native. Path-based, không text, không
 * phụ thuộc font. Giống Lucide "languages" icon. Phong cách cluster: 24x24,
 * stroke 1.5, currentColor, round caps.
 */
const GENERATE_NATIVE_ICON = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false" style="display:block;fill:none !important"><path d="M4 9 L18 9 M15 6 L18 9 L15 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 15 L6 15 M9 12 L6 15 L9 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export interface SubtitleBlockDOM {
  readonly block: HTMLDivElement;
  readonly body: HTMLDivElement;
  readonly clusterColumns: HTMLDivElement;
  readonly clusterColumnA: HTMLDivElement;
  readonly clusterColumnB: HTMLDivElement;
  readonly noSubColumn: HTMLDivElement;
  readonly prevBtn: HTMLButtonElement;
  readonly repeatBtn: HTMLButtonElement;
  readonly nextBtn: HTMLButtonElement;
  readonly rewindBtn: HTMLButtonElement;
  readonly forwardBtn: HTMLButtonElement;
  readonly subtitleColumn: HTMLDivElement;
  readonly targetLine: HTMLDivElement;
  readonly nativeLine: HTMLDivElement;
  readonly rightColumn: HTMLDivElement;
  readonly quickUpdateBtn: HTMLButtonElement;
  readonly editCardBtn: HTMLButtonElement;
  readonly generateNativeBtn: HTMLButtonElement;
}

function makeButton(testId: string, ariaLabel: string, iconHtml: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'cluster-btn';
  btn.setAttribute('data-testid', testId);
  btn.setAttribute('aria-label', ariaLabel);
  btn.innerHTML = iconHtml;
  return btn;
}

export function createSubtitleBlockDOM(): SubtitleBlockDOM {
  const block = document.createElement('div');
  block.className = 'subtitle-block';
  block.setAttribute('data-testid', 'subtitle-block');
  block.setAttribute('role', 'region');
  block.setAttribute('aria-label', 'Subtitle block');

  const body = document.createElement('div');
  body.className = 'block-body';

  const clusterColumns = document.createElement('div');
  clusterColumns.className = 'cluster-columns';
  clusterColumns.setAttribute('data-testid', 'subtitle-block-cluster');

  const clusterColumnA = document.createElement('div');
  clusterColumnA.className = 'cluster-column';
  const clusterColumnB = document.createElement('div');
  clusterColumnB.className = 'cluster-column';
  const noSubColumn = document.createElement('div');
  noSubColumn.className = 'cluster-column no-sub-column';

  const prevBtn = makeButton('cluster-prev', 'Previous sentence', NAV_CLUSTER_ICONS.prev);
  const repeatBtn = makeButton('cluster-repeat', 'Repeat current sentence', NAV_CLUSTER_ICONS.repeat);
  const nextBtn = makeButton('cluster-next', 'Next sentence', NAV_CLUSTER_ICONS.next);
  const rewindBtn = makeButton('cluster-rewind', 'Rewind 5 seconds', NAV_CLUSTER_ICONS.rewind);
  const forwardBtn = makeButton('cluster-forward', 'Forward 10 seconds', NAV_CLUSTER_ICONS.forward);

  clusterColumnA.append(prevBtn, repeatBtn, nextBtn);
  clusterColumnB.append(rewindBtn, forwardBtn);

  clusterColumns.append(clusterColumnA, clusterColumnB, noSubColumn);

  const subtitleColumn = document.createElement('div');
  subtitleColumn.className = 'subtitle-column';
  subtitleColumn.setAttribute('data-testid', 'subtitle-block-subtitles');

  const targetLine = document.createElement('div');
  targetLine.className = 'subtitle-line target';
  targetLine.setAttribute('data-testid', 'subtitle-target-line');

  const nativeLine = document.createElement('div');
  nativeLine.className = 'subtitle-line native';
  nativeLine.setAttribute('data-testid', 'subtitle-native-line');

  subtitleColumn.append(targetLine, nativeLine);

  const rightColumn = document.createElement('div');
  rightColumn.className = 'block-right-column';

  // Card Creator entry buttons (quick update + edit) — spec §4.1.
  const quickUpdateBtn = makeButton('card-creator-quick', 'Quick update card', CARD_CREATOR_ICONS.quick);
  quickUpdateBtn.title = 'Quick update (Q)';
  const editCardBtn = makeButton('card-creator-edit', 'Edit card', CARD_CREATOR_ICONS.edit);
  editCardBtn.title = 'Edit card (E)';
  // Generate native subtitle button — placed below card creator buttons.
  const generateNativeBtn = makeButton('generate-native', 'Generate native subtitle', GENERATE_NATIVE_ICON);
  generateNativeBtn.title = 'Generate native subtitle (G)';
  rightColumn.append(quickUpdateBtn, editCardBtn, generateNativeBtn);

  body.append(clusterColumns, subtitleColumn, rightColumn);
  block.appendChild(body);

  return {
    block,
    body,
    clusterColumns,
    clusterColumnA,
    clusterColumnB,
    noSubColumn,
    prevBtn,
    repeatBtn,
    nextBtn,
    rewindBtn,
    forwardBtn,
    subtitleColumn,
    targetLine,
    nativeLine,
    rightColumn,
    quickUpdateBtn,
    editCardBtn,
    generateNativeBtn,
  };
}
