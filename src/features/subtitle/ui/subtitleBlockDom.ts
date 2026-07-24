import { ICON_CATALOG } from '@/shared/icons';
import { NAV_CLUSTER_ICONS } from './navClusterIcons';
import { CARD_CREATOR_ICONS } from '@/features/cardCreator/ui/cardCreatorIcons';

/**
 * Generate native subtitle icon: 2 arrows ngược chiều (→ trên, ← dưới).
 * Gợi ý translate/exchange — target ↔ native. Path-based, không text, không
 * phụ thuộc font. Giống Lucide "languages" icon. Phong cách cluster: 24x24,
 * stroke 1.5, currentColor, round caps.
 *
 * SVG path data sourced from ICON_CATALOG.generateNative. Inline style/focusable
 * injected for cluster-btn display + fill convention.
 */
const GENERATE_NATIVE_ICON = ICON_CATALOG.generateNative.svg.replace(
  '<svg ',
  '<svg focusable="false" style="display:block;fill:none !important" ',
);

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
  readonly playPauseBtn: HTMLButtonElement;
  readonly forwardBtn: HTMLButtonElement;
  readonly subtitleColumn: HTMLDivElement;
  readonly targetLine: HTMLDivElement;
  readonly nativeLine: HTMLDivElement;
  readonly rightColumn: HTMLDivElement;
  readonly rightColPrimary: HTMLDivElement;
  readonly rightColSecondary: HTMLDivElement;
  readonly quickUpdateBtn: HTMLButtonElement;
  readonly editCardBtn: HTMLButtonElement;
  readonly moreBtn: HTMLButtonElement;
  readonly morePopover: HTMLDivElement;
  readonly panelToggleSlot: HTMLDivElement;
  readonly importButtonSlot: HTMLDivElement;
  readonly updateCurrentCardBtn: HTMLButtonElement;
  readonly generateNativeBtn: HTMLButtonElement;
  readonly managerIconSlot: HTMLDivElement;
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
  const playPauseBtn = makeButton('cluster-play-pause', 'Play or pause video', NAV_CLUSTER_ICONS.play);
  const forwardBtn = makeButton('cluster-forward', 'Forward 10 seconds', NAV_CLUSTER_ICONS.forward);

  clusterColumnA.append(prevBtn, repeatBtn, nextBtn);
  clusterColumnB.append(rewindBtn, playPauseBtn, forwardBtn);

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

  // === Right column: 2 sub-columns (ADR-027) ===
  // Cột 1 (primary): quick add, send to card, more button (overflow popover).
  // Cột 2 (secondary): update current card, translate, subtitle manager icon.
  const rightColPrimary = document.createElement('div');
  rightColPrimary.className = 'right-col-primary';

  const rightColSecondary = document.createElement('div');
  rightColSecondary.className = 'right-col-secondary';

  // Card Creator entry buttons (quick add + edit) — spec §4.1.
  // quick-add: batch add all unknown/tracking words in the current subtitle
  // line directly to Anki (I+1 = 1 card, I+N = N cards). No dialog.
  const quickUpdateBtn = makeButton('card-creator-quick', 'Quick add card', CARD_CREATOR_ICONS.quick);
  quickUpdateBtn.title = 'Quick add (Q)';
  const editCardBtn = makeButton('card-creator-edit', 'Edit card', CARD_CREATOR_ICONS.edit);
  editCardBtn.title = 'Edit card (E)';

  // More button — chevron-left, opens a horizontal popover with overflow
  // buttons (panel-toggle, import-button). Keeps the video surface clean.
  const moreBtn = makeButton('right-col-more', 'More tools', ICON_CATALOG.chevronLeft.svg);
  moreBtn.title = 'More tools';
  moreBtn.setAttribute('aria-expanded', 'false');
  moreBtn.setAttribute('aria-haspopup', 'true');

  // Popover — horizontal row of overflow buttons, opens to the left of moreBtn.
  const morePopover = document.createElement('div');
  morePopover.className = 'more-popover';
  morePopover.setAttribute('role', 'group');
  morePopover.setAttribute('aria-label', 'More tools');
  // Slots — external buttons (panel-toggle, import-button) are appended here
  // by the controller, keeping creation lifecycle in contentScriptController.
  const panelToggleSlot = document.createElement('div');
  panelToggleSlot.className = 'more-popover__slot';
  const importButtonSlot = document.createElement('div');
  importButtonSlot.className = 'more-popover__slot';
  morePopover.append(panelToggleSlot, importButtonSlot);

  rightColPrimary.append(quickUpdateBtn, editCardBtn, moreBtn, morePopover);
  rightColumn.append(rightColPrimary, rightColSecondary);

  // Cột 2: update current card, translate (generate native), manager icon slot.
  // Update current card — rotate-ccw icon (refresh/update semantics).
  const updateCurrentCardBtn = makeButton('card-creator-update-current', 'Update current card', ICON_CATALOG.rotateCcw.svg);
  updateCurrentCardBtn.title = 'Update current card';
  // Generate native subtitle button — placed below update current card.
  const generateNativeBtn = makeButton('generate-native', 'Generate native subtitle', GENERATE_NATIVE_ICON);
  generateNativeBtn.title = 'Generate native subtitle (G)';
  // Manager icon slot — subtitle-manager-icon is appended here by the controller.
  const managerIconSlot = document.createElement('div');
  managerIconSlot.className = 'manager-icon-slot';
  rightColSecondary.append(updateCurrentCardBtn, generateNativeBtn, managerIconSlot);

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
    playPauseBtn,
    forwardBtn,
    subtitleColumn,
    targetLine,
    nativeLine,
    rightColumn,
    rightColPrimary,
    rightColSecondary,
    quickUpdateBtn,
    editCardBtn,
    moreBtn,
    morePopover,
    panelToggleSlot,
    importButtonSlot,
    updateCurrentCardBtn,
    generateNativeBtn,
    managerIconSlot,
  };
}
