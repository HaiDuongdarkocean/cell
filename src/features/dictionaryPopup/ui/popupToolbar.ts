// popupToolbar — spec §4.6.3 A8, §9: toolbar with tab toggle icons + lazy panels.
//
// Toolbar: icon SVG toggle buttons for Audio/Image/Translate/Links.
// Clicking a tab icon toggles the corresponding panel (lazy loaded).
// Only 1 tab active at a time (clicking active tab closes it).
//
// Panels are rendered lazily — content fetched only when tab is first
// opened (spec: "lazy load panel").

import type { PopupTab, AudioItem, ImageItem, ExternalDictLink } from '../types';
import { ICON_CATALOG } from '@/shared/icons';

export type { PopupTab };

/** Build a skeleton placeholder element.
 *  Mirrors shared/ui/Skeleton but for vanilla DOM content-script surfaces. */
function createSkeleton(
  width: string,
  height: string,
  shape: 'circle' | 'rounded' | 'rect' = 'rect',
  className?: string,
): HTMLElement {
  const el = document.createElement('div');
  el.className = `cell-skeleton cell-skeleton--${shape}${className ? ' ' + className : ''}`;
  el.style.width = width;
  el.style.height = height;
  el.setAttribute('aria-hidden', 'true');
  return el;
}

/** Remove an existing panel of the same type before re-rendering. Prevents duplicate panels. */
function replaceExistingPanel(container: HTMLElement, panelType: string): void {
  const existing = container.querySelector(`.js-cell-panel[data-cell-panel="${panelType}"]`);
  if (existing) existing.remove();
}

/** Toolbar tab config — icon SVG from ICON_CATALOG + which panel to show. */
const TAB_CONFIG: readonly { readonly tab: PopupTab; readonly label: string; readonly icon: string }[] = [
  { tab: 'audio', label: 'Audio', icon: ICON_CATALOG.audioWave.svg },
  { tab: 'image', label: 'Image', icon: ICON_CATALOG.image.svg },
  { tab: 'translate', label: 'Translate', icon: ICON_CATALOG.languages.svg },
  { tab: 'links', label: 'Links', icon: ICON_CATALOG.link.svg },
];

/** Selection counts per tab — drives the badge on toolbar icons. */
export type SelectionCounts = Partial<Record<PopupTab, number>>;

/** Render the toolbar with 4 tab toggle buttons (A/I/T/L).
 *  Each button shows an icon + label; the label is hidden on narrow popups
 *  and shown on wide ones via the `.cell-label` container query.
 *  No standalone close button — clicking the active tab again closes its panel.
 *  Active tab = .cell-toolbar__tab--active class (primary-subtle fill + primary text).
 *  Icons: ICON_CATALOG from @/shared/icons (Lucide convention, stroke 2, currentColor).
 *  Badge: when selectionCounts[tab] > 0, the number is appended to the icon.
 *  onTabOpen: fired when a tab icon is clicked to OPEN (not close) its panel —
 *  used to lazy-trigger panel content such as translate. */
export function renderToolbar(
  container: HTMLElement,
  activeTab: PopupTab | null,
  onTabToggle: (tab: PopupTab) => void,
  selectionCounts?: SelectionCounts,
  onTabOpen?: (tab: PopupTab) => void,
): HTMLElement {
  const toolbar = document.createElement('div');
  toolbar.className = 'cell-toolbar js-cell-toolbar';

  for (const config of TAB_CONFIG) {
    const btn = document.createElement('button');
    btn.className = 'btn ' + (activeTab === config.tab ? 'btn--primary ' : 'btn--ghost ') + 'cell-toolbar__tab js-cell-tab';
    btn.setAttribute('data-cell-tab', config.tab);
    btn.setAttribute('aria-label', config.label);
    btn.setAttribute('aria-pressed', String(activeTab === config.tab));
    btn.title = config.label;
    btn.style.position = 'relative';
    btn.innerHTML = `${config.icon}<span class="cell-toolbar__label cell-label">${config.label}</span>`;
    btn.addEventListener('click', () => {
      const isOpening = activeTab !== config.tab;
      onTabToggle(config.tab);
      if (isOpening && onTabOpen) onTabOpen(config.tab);
    });

    // Badge — shows the actual selected count (wireframe: 1, 2, …).
    const count = selectionCounts?.[config.tab] ?? 0;
    if (count > 0) {
      const badge = document.createElement('span');
      badge.className = 'cell-toolbar__badge';
      badge.textContent = String(count);
      btn.appendChild(badge);
    }

    toolbar.appendChild(btn);
  }

  container.appendChild(toolbar);
  return toolbar;
}

/** Render the audio panel — word / sentence audio items, switchable via sub-tabs.
 *  Layout per item: [play button] [label: name + meta] [checkbox if checked].
 *  - Play button: click to play audio (stopPropagation — does NOT toggle selection).
 *  - Label: click to toggle selection (Speaker → Dialect → Gender).
 *  - Checkbox: hidden when unchecked, visible with ✓ when checked.
 *  - Row: hover=surface-hover fill, radius-lg (10px). */
export function renderAudioPanel(
  container: HTMLElement,
  wordAudios: readonly AudioItem[],
  sentenceAudios: readonly AudioItem[],
  selection: Map<string, boolean>,
  onToggle: (id: string, selected: boolean) => void,
  onPlay: (item: AudioItem) => void,
  isLoading = false,
  error?: string,
  currentlyPlayingId?: string,
  onTts?: () => void,
  onSelectionChange?: () => void,
  activeGroup: 'word' | 'sentence' = 'word',
  onGroupChange?: (group: 'word' | 'sentence') => void,
): void {
  replaceExistingPanel(container, 'audio');
  const panel = document.createElement('div');
  panel.className = 'cell-audio js-cell-panel';
  panel.setAttribute('data-cell-panel', 'audio');

  // Error state — show error message (token: --color-error).
  if (error) {
    const err = document.createElement('div');
    err.className = 'cell-audio__error';
    err.textContent = error;
    panel.appendChild(err);
    container.appendChild(panel);
    return;
  }

  // Loading state — skeleton placeholders while fetching audio sources.
  if (isLoading && wordAudios.length === 0 && sentenceAudios.length === 0) {
    const skeleton = document.createElement('div');
    skeleton.className = 'cell-audio__skeleton';
    for (let i = 0; i < 6; i += 1) {
      const row = document.createElement('div');
      row.className = 'cell-audio__skeleton-row';
      row.appendChild(createSkeleton('28px', '28px', 'circle', 'cell-audio__skeleton-play'));
      row.appendChild(createSkeleton('100%', '16px', 'rect', 'cell-audio__skeleton-label'));
      row.appendChild(createSkeleton('16px', '16px', 'rect', 'cell-audio__skeleton-check'));
      skeleton.appendChild(row);
    }
    panel.appendChild(skeleton);
    container.appendChild(panel);
    return;
  }

  const renderGroup = (items: readonly AudioItem[], variant: 'word' | 'sentence' = 'word') => {
    if (items.length === 0) return;

    for (const item of items) {
      const isChecked = selection.get(item.id) ?? item.defaultSelected;
      const isPlaying = currentlyPlayingId === item.id;
      const row = document.createElement('div');
      row.className = 'cell-audio__item js-cell-audio-item' + (isPlaying ? ' cell-audio__item--playing' : '') + (variant === 'sentence' ? ' cell-audio__item--sentence' : '');
      row.setAttribute('data-cell-audio-id', item.id);

      // Play/pause button — click to play, does NOT toggle selection.
      const playBtn = document.createElement('button');
      playBtn.className = 'icon-btn icon-btn--sm icon-btn--outlined js-cell-audio-play';
      playBtn.setAttribute('aria-label', isPlaying ? `Pause ${item.label}` : `Play ${item.label}`);
      playBtn.title = isPlaying ? `Pause ${item.label}` : `Play ${item.label}`;
      playBtn.innerHTML = isPlaying ? ICON_CATALOG.pause.svg : ICON_CATALOG.audioWave.svg;
      playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        onPlay(item);
      });
      row.appendChild(playBtn);

      // Label — click to toggle selection. Split by " · " into name + meta.
      // Label order: Speaker → Dialect → Gender (spec wireframe).
      const labelEl = document.createElement('span');
      labelEl.className = 'cell-audio__label js-cell-audio-label';
      labelEl.setAttribute('role', 'button');
      labelEl.setAttribute('aria-pressed', String(isChecked));
      labelEl.setAttribute('tabindex', '0');
      labelEl.setAttribute('aria-label', `Select ${item.label}`);
      const parts = item.label.split(' · ');
      const nameEl = document.createElement('span');
      nameEl.className = 'cell-audio__label-name';
      nameEl.textContent = parts[0] ?? item.label;
      labelEl.appendChild(nameEl);
      if (parts.length > 1) {
        const metaEl = document.createElement('span');
        metaEl.className = 'cell-audio__label-meta';
        metaEl.textContent = parts.slice(1).join(' · ');
        labelEl.appendChild(metaEl);
      }
      const toggleAudioLabel = (e?: Event): void => {
        e?.stopPropagation();
        // M1: read current state from selection map at click time, not the
        // isChecked captured at render — otherwise 2nd click reuses stale value.
        const current = selection.get(item.id) ?? item.defaultSelected;
        onToggle(item.id, !current);
        checkEl.classList.toggle('cell-audio__check--checked', !current);
        labelEl.setAttribute('aria-pressed', String(!current));
        onSelectionChange?.();
      };
      labelEl.addEventListener('click', toggleAudioLabel);
      labelEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleAudioLabel(e);
        }
      });
      row.appendChild(labelEl);

      // Checkbox — hidden when unchecked, visible with ✓ when checked.
      const checkEl = document.createElement('span');
      checkEl.className = 'cell-audio__check js-cell-audio-check' + (isChecked ? ' cell-audio__check--checked' : '');
      checkEl.setAttribute('aria-hidden', 'true');
      const tick = document.createElement('span');
      tick.className = 'cell-audio__check-tick';
      tick.innerHTML = ICON_CATALOG.check.svg;
      checkEl.appendChild(tick);
      row.appendChild(checkEl);

      panel.appendChild(row);
    }
  };

  // Sub-tabs: minimal text buttons to switch between word/sentence audio.
  const subTabs = document.createElement('div');
  subTabs.className = 'cell-audio__subtabs';
  const wordTab = document.createElement('button');
  wordTab.className = 'cell-audio__subtab js-cell-audio-subtab-word' + (activeGroup === 'word' ? ' cell-audio__subtab--active' : '');
  wordTab.textContent = 'PLAY WORD';
  wordTab.addEventListener('click', () => onGroupChange?.('word'));
  const sentenceTab = document.createElement('button');
  sentenceTab.className = 'cell-audio__subtab js-cell-audio-subtab-sentence' + (activeGroup === 'sentence' ? ' cell-audio__subtab--active' : '');
  sentenceTab.textContent = 'PLAY SENTENCE';
  sentenceTab.addEventListener('click', () => onGroupChange?.('sentence'));
  subTabs.appendChild(wordTab);
  subTabs.appendChild(sentenceTab);
  panel.appendChild(subTabs);

  if (activeGroup === 'word') {
    renderGroup(wordAudios, 'word');
  } else {
    renderGroup(sentenceAudios, 'sentence');
  }

  if (wordAudios.length === 0 && sentenceAudios.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'cell-audio__empty';
    const icon = document.createElement('div');
    icon.className = 'cell-audio__empty-icon';
    icon.innerHTML = ICON_CATALOG.audioWave.svg;
    empty.appendChild(icon);
    const title = document.createElement('div');
    title.className = 'cell-audio__empty-title';
    title.textContent = 'No audio available';
    empty.appendChild(title);
    const btn = document.createElement('button');
    btn.className = 'btn btn--outline btn--sm js-cell-audio-tts-fallback';
    btn.textContent = 'Use system TTS';
    if (onTts) btn.addEventListener('click', onTts);
    empty.appendChild(btn);
    panel.appendChild(empty);
  }

  container.appendChild(panel);
}

/** Render the image panel — horizontal scroll strip with checkmark. */
export function renderImagePanel(
  container: HTMLElement,
  images: readonly ImageItem[],
  selection: Map<string, boolean>,
  onToggle: (id: string, selected: boolean) => void,
  searchTerm?: string,
  isLoading = false,
  error?: string,
  onSelectionChange?: () => void,
): void {
  replaceExistingPanel(container, 'image');
  const panel = document.createElement('div');
  panel.className = 'cell-image js-cell-panel';
  panel.setAttribute('data-cell-panel', 'image');

  // Error state — show error message (token: --color-error).
  if (error) {
    const err = document.createElement('div');
    err.className = 'cell-image__error';
    err.textContent = error;
    panel.appendChild(err);
    container.appendChild(panel);
    return;
  }

  // Loading state — skeleton placeholders while fetching images.
  if (isLoading && images.length === 0) {
    const skeleton = document.createElement('div');
    skeleton.className = 'cell-image__skeleton';
    for (let i = 0; i < 4; i += 1) {
      skeleton.appendChild(createSkeleton('100%', '72px', 'rounded', 'cell-image__skeleton-card'));
    }
    panel.appendChild(skeleton);
    container.appendChild(panel);
    return;
  }

  if (images.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'cell-image__empty';
    const icon = document.createElement('div');
    icon.className = 'cell-image__empty-icon';
    icon.innerHTML = ICON_CATALOG.image.svg;
    empty.appendChild(icon);
    const title = document.createElement('div');
    title.className = 'cell-image__empty-title';
    title.textContent = 'No images';
    empty.appendChild(title);
    // MVP: link to Google Images search (no scrape — ponytail: scrape later).
    if (searchTerm) {
      const link = document.createElement('a');
      link.className = 'cell-image__empty-action btn btn--outline btn--sm';
      link.href = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(searchTerm)}`;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.innerHTML = `${ICON_CATALOG.search.svg}<span>Search Google Images</span>`;
      empty.appendChild(link);
    }
    panel.appendChild(empty);
    container.appendChild(panel);
    return;
  }

  const strip = document.createElement('div');
  strip.className = 'cell-image__strip';

  for (const img of images) {
    const isSelected = selection.get(img.id) ?? img.defaultSelected;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'cell-image__card js-cell-image-card' + (isSelected ? ' cell-image__card--selected' : '');
    card.setAttribute('role', 'checkbox');
    card.setAttribute('aria-checked', String(isSelected));
    card.setAttribute('aria-label', img.alt || `Image for ${searchTerm || 'term'}`);
    card.setAttribute('data-cell-image-id', img.id);

    const thumb = document.createElement('img');
    thumb.className = 'cell-image__thumb';
    thumb.src = img.src;
    thumb.alt = img.alt;
    // Remove card immediately when image URL fails to load (404, CORS, etc).
    // Also purge from selection so Quick Add doesn't include broken images.
    thumb.addEventListener('error', () => {
      card.remove();
      selection.delete(img.id);
    });
    card.appendChild(thumb);

    const check = document.createElement('span');
    check.className = 'cell-image__check';
    check.setAttribute('aria-hidden', 'true');
    check.innerHTML = ICON_CATALOG.check.svg;
    card.appendChild(check);

    card.addEventListener('click', () => {
      // M1: read current state from selection map at click time, not the
      // isSelected captured at render — otherwise 2nd click reuses stale value.
      const current = selection.get(img.id) ?? img.defaultSelected;
      onToggle(img.id, !current);
      card.classList.toggle('cell-image__card--selected', !current);
      card.setAttribute('aria-checked', String(!current));
      onSelectionChange?.();
    });
    strip.appendChild(card);
  }

  panel.appendChild(strip);
  container.appendChild(panel);
}

/** Render the translate panel — single clickable block with target + native.
 *  - Empty: icon + title + "Translate sentence" button.
 *  - Loaded: single block with target sentence (top) + native translation (bottom).
 *  - Click block to toggle selection; checkbox at far right when selected.
 *  - Native language is set in Settings > Popup > Native language. */
export function renderTranslatePanel(
  container: HTMLElement,
  translation: string,
  sourceSentence: string,
  targetLang: string,
  onTranslate: () => void,
  isSelected?: boolean,
  onToggleSelect?: () => void,
  isLoading = false,
  onSelectionChange?: () => void,
): void {
  replaceExistingPanel(container, 'translate');
  const panel = document.createElement('div');
  panel.className = 'cell-translate js-cell-panel';
  panel.setAttribute('data-cell-panel', 'translate');

  // Loading state — skeleton placeholder while translating.
  if (isLoading) {
    const skeleton = document.createElement('div');
    skeleton.className = 'cell-translate__skeleton';
    const block = document.createElement('div');
    block.className = 'cell-translate__skeleton-block';
    const text = document.createElement('div');
    text.className = 'cell-translate__skeleton-text';
    const line1 = createSkeleton('100%', '16px', 'rect');
    line1.className = 'cell-translate__skeleton-line';
    const line2 = createSkeleton('100%', '16px', 'rect');
    line2.className = 'cell-translate__skeleton-line';
    text.appendChild(line1);
    text.appendChild(line2);
    block.appendChild(text);
    block.appendChild(createSkeleton('16px', '16px', 'rect', 'cell-translate__skeleton-check'));
    skeleton.appendChild(block);
    panel.appendChild(skeleton);
    container.appendChild(panel);
    return;
  }

  if (!translation && !sourceSentence) {
    // Empty state — icon + title + button.
    const empty = document.createElement('div');
    empty.className = 'cell-translate__empty';
    const icon = document.createElement('div');
    icon.className = 'cell-translate__empty-icon';
    icon.innerHTML = ICON_CATALOG.languages.svg;
    empty.appendChild(icon);
    const title = document.createElement('div');
    title.className = 'cell-translate__empty-title';
    title.textContent = 'No translation';
    empty.appendChild(title);
    const btn = document.createElement('button');
    btn.className = 'btn btn--outline btn--sm js-cell-translate-btn';
    btn.textContent = `Translate to ${targetLang}`;
    btn.addEventListener('click', onTranslate);
    empty.appendChild(btn);
    panel.appendChild(empty);
    container.appendChild(panel);
    return;
  }

  // If no translation yet but source sentence exists, show translate button.
  if (!translation) {
    const empty = document.createElement('div');
    empty.className = 'cell-translate__empty';
    const icon = document.createElement('div');
    icon.className = 'cell-translate__empty-icon';
    icon.innerHTML = ICON_CATALOG.languages.svg;
    empty.appendChild(icon);
    const title = document.createElement('div');
    title.className = 'cell-translate__empty-title';
    title.textContent = 'No translation';
    empty.appendChild(title);
    const btn = document.createElement('button');
    btn.className = 'btn btn--outline btn--sm js-cell-translate-btn';
    btn.textContent = `Translate to ${targetLang}`;
    btn.addEventListener('click', onTranslate);
    empty.appendChild(btn);
    panel.appendChild(empty);
    container.appendChild(panel);
    return;
  }

  // Loaded — single clickable block with target (top) + native (bottom).
  const selected = isSelected ?? false;
  const block = document.createElement('div');
  block.className = 'cell-translate__block js-cell-translate-block' + (selected ? ' cell-translate__block--selected' : '');
  block.setAttribute('role', 'button');
  block.setAttribute('aria-pressed', String(selected));
  block.setAttribute('tabindex', '0');
  block.setAttribute('aria-label', 'Toggle translation selection');

  const textEl = document.createElement('div');
  textEl.className = 'cell-translate__text';
  // Target sentence (top) — the original sentence being read.
  const targetEl = document.createElement('div');
  targetEl.className = 'cell-translate__target';
  targetEl.textContent = sourceSentence || translation;
  textEl.appendChild(targetEl);
  // Native translation (bottom) — translated to user's native language.
  const nativeEl = document.createElement('div');
  nativeEl.className = 'cell-translate__native';
  nativeEl.textContent = sourceSentence ? translation : '';
  textEl.appendChild(nativeEl);
  block.appendChild(textEl);

  // Checkbox at far right — hidden when unchecked, visible when checked.
  const checkEl = document.createElement('span');
  checkEl.className = 'cell-translate__check js-cell-translate-check' + (selected ? ' cell-translate__check--checked' : '');
  checkEl.setAttribute('aria-hidden', 'true');
  const tick = document.createElement('span');
  tick.className = 'cell-translate__check-tick';
  tick.innerHTML = ICON_CATALOG.check.svg;
  checkEl.appendChild(tick);
  block.appendChild(checkEl);

  const toggleTranslate = (): void => {
    if (onToggleSelect) onToggleSelect();
    onSelectionChange?.();
  };
  // Click or keyboard activate.
  block.addEventListener('click', toggleTranslate);
  block.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleTranslate();
    }
  });

  panel.appendChild(block);
  container.appendChild(panel);
}

/** Render the links panel — external dictionary link list. */
export function renderLinksPanel(
  container: HTMLElement,
  links: readonly ExternalDictLink[],
): void {
  replaceExistingPanel(container, 'links');
  const panel = document.createElement('div');
  panel.className = 'cell-links js-cell-panel';
  panel.setAttribute('data-cell-panel', 'links');

  if (links.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'cell-links__empty';
    const icon = document.createElement('div');
    icon.className = 'cell-links__empty-icon';
    icon.innerHTML = ICON_CATALOG.link.svg;
    empty.appendChild(icon);
    const title = document.createElement('div');
    title.className = 'cell-links__empty-title';
    title.textContent = 'No external links';
    empty.appendChild(title);
    const btn = document.createElement('button');
    btn.className = 'btn btn--outline btn--sm js-cell-links-settings';
    btn.textContent = 'Open settings';
    btn.addEventListener('click', () => {
      try {
        void chrome.runtime.openOptionsPage();
      } catch {
        /* best-effort */
      }
    });
    empty.appendChild(btn);
    panel.appendChild(empty);
    container.appendChild(panel);
    return;
  }

  for (const link of links) {
    const anchor = document.createElement('a');
    anchor.className = 'cell-links__item';
    anchor.href = link.url;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.setAttribute('aria-label', `${link.name} (opens in new tab)`);
    anchor.innerHTML = `${ICON_CATALOG.link.svg}<span class="cell-links__name">${link.name}</span>`;
    panel.appendChild(anchor);
  }

  container.appendChild(panel);
}

/** Fill external dict link templates with term + lang. */
export function fillExternalDictLinks(
  templates: readonly { readonly id: string; readonly name: string; readonly urlTemplate: string; readonly langCodes: readonly string[] }[],
  term: string,
  langCode: string,
): ExternalDictLink[] {
  const encodedTerm = encodeURIComponent(term);
  return templates
    .filter((t) => t.langCodes.length === 0 || t.langCodes.includes(langCode))
    .map((t) => ({
      id: t.id,
      name: t.name,
      url: t.urlTemplate.replaceAll('{term}', encodedTerm).replaceAll('{lang}', langCode),
    }));
}
