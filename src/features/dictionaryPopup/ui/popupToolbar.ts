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

/** Toolbar tab config — icon SVG from ICON_CATALOG + which panel to show. */
const TAB_CONFIG: readonly { readonly tab: PopupTab; readonly label: string; readonly icon: string }[] = [
  { tab: 'audio', label: 'Audio', icon: ICON_CATALOG.audioWave.svg },
  { tab: 'image', label: 'Image', icon: ICON_CATALOG.image.svg },
  { tab: 'translate', label: 'Translate', icon: ICON_CATALOG.languages.svg },
  { tab: 'links', label: 'Links', icon: ICON_CATALOG.link.svg },
];

/** Selection counts per tab — drives the badge on toolbar icons. */
export type SelectionCounts = Partial<Record<PopupTab, number>>;

/** Render the toolbar with icon-btn toggle buttons + None button to close panel.
 *  Uses shared .icon-btn .icon-btn--sm class from components.css (single source
 *  for hover/active/focus behavior across React + content script surfaces).
 *  Active tab = .is-active class (primary-subtle fill + primary text).
 *  Icons: ICON_CATALOG from @/shared/icons (Lucide convention, stroke 2, currentColor).
 *  Badge: when selectionCounts[tab] > 0, a count badge is appended to the icon. */
export function renderToolbar(
  container: HTMLElement,
  activeTab: PopupTab | null,
  onTabToggle: (tab: PopupTab) => void,
  onClose?: () => void,
  selectionCounts?: SelectionCounts,
): void {
  const toolbar = document.createElement('div');
  toolbar.className = 'cell-toolbar js-cell-toolbar';

  for (const config of TAB_CONFIG) {
    const btn = document.createElement('button');
    btn.className = 'icon-btn icon-btn--sm js-cell-tab' + (activeTab === config.tab ? ' icon-btn--active' : '');
    btn.setAttribute('data-cell-tab', config.tab);
    btn.setAttribute('aria-label', config.label);
    btn.title = config.label;
    btn.style.position = 'relative';
    btn.innerHTML = config.icon;
    btn.addEventListener('click', () => onTabToggle(config.tab));

    // Badge — selection count when > 0.
    const count = selectionCounts?.[config.tab] ?? 0;
    if (count > 0) {
      const badge = document.createElement('span');
      badge.className = 'cell-toolbar__badge';
      badge.textContent = String(count);
      btn.appendChild(badge);
    }

    toolbar.appendChild(btn);
  }

  // None button — closes any active tab panel. Uses eye-off icon (hide).
  if (onClose) {
    const noneBtn = document.createElement('button');
    noneBtn.className = 'icon-btn icon-btn--sm js-cell-tab-close' + (activeTab === null ? ' icon-btn--active' : '');
    noneBtn.setAttribute('aria-label', 'Hide panel');
    noneBtn.title = 'Hide panel';
    noneBtn.innerHTML = ICON_CATALOG.eyeOff.svg;
    noneBtn.addEventListener('click', onClose);
    toolbar.appendChild(noneBtn);
  }

  container.appendChild(toolbar);
}

/** Render the audio panel — Word Audio / Sentence Audio groups.
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
): void {
  const panel = document.createElement('div');
  panel.className = 'cell-audio js-cell-panel';
  panel.setAttribute('data-cell-panel', 'audio');

  const renderGroup = (label: string, items: readonly AudioItem[]) => {
    if (items.length === 0) return;
    const groupLabel = document.createElement('div');
    groupLabel.className = 'cell-audio__group-label';
    groupLabel.textContent = label;
    panel.appendChild(groupLabel);

    for (const item of items) {
      const isChecked = selection.get(item.id) ?? item.defaultSelected;
      const row = document.createElement('div');
      row.className = 'cell-audio__item js-cell-audio-item';
      row.setAttribute('data-cell-audio-id', item.id);

      // Play button — click to play, does NOT toggle selection.
      const playBtn = document.createElement('button');
      playBtn.className = 'icon-btn icon-btn--sm icon-btn--outlined js-cell-audio-play';
      playBtn.setAttribute('aria-label', `Play ${item.label}`);
      playBtn.title = `Play ${item.label}`;
      playBtn.innerHTML = ICON_CATALOG.play.svg;
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
      labelEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const newChecked = !isChecked;
        onToggle(item.id, newChecked);
        checkEl.classList.toggle('cell-audio__check--checked', newChecked);
      });
      row.appendChild(labelEl);

      // Checkbox — hidden when unchecked, visible with ✓ when checked.
      const checkEl = document.createElement('span');
      checkEl.className = 'cell-audio__check js-cell-audio-check' + (isChecked ? ' cell-audio__check--checked' : '');
      checkEl.setAttribute('aria-hidden', 'true');
      const tick = document.createElement('span');
      tick.className = 'cell-audio__check-tick';
      tick.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="width:10px;height:10px;display:block"><path d="M20 6 9 17l-5-5"/></svg>`;
      checkEl.appendChild(tick);
      row.appendChild(checkEl);

      panel.appendChild(row);
    }
  };

  renderGroup('Word Audio', wordAudios);
  renderGroup('Sentence Audio', sentenceAudios);

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
): void {
  const panel = document.createElement('div');
  panel.className = 'cell-image js-cell-panel';
  panel.setAttribute('data-cell-panel', 'image');

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
    card.setAttribute('aria-label', img.alt);
    card.setAttribute('data-cell-image-id', img.id);

    const thumb = document.createElement('img');
    thumb.className = 'cell-image__thumb';
    thumb.src = img.src;
    thumb.alt = img.alt;
    card.appendChild(thumb);

    const check = document.createElement('span');
    check.className = 'cell-image__check';
    check.setAttribute('aria-hidden', 'true');
    check.innerHTML = ICON_CATALOG.check.svg;
    card.appendChild(check);

    card.addEventListener('click', () => onToggle(img.id, !isSelected));
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
): void {
  const panel = document.createElement('div');
  panel.className = 'cell-translate js-cell-panel';
  panel.setAttribute('data-cell-panel', 'translate');

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
  tick.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="width:10px;height:10px;display:block"><path d="M20 6 9 17l-5-5"/></svg>`;
  checkEl.appendChild(tick);
  block.appendChild(checkEl);

  // Click block to toggle selection.
  block.addEventListener('click', () => {
    if (onToggleSelect) onToggleSelect();
  });

  panel.appendChild(block);
  container.appendChild(panel);
}

/** Render the links panel — external dictionary link list. */
export function renderLinksPanel(
  container: HTMLElement,
  links: readonly ExternalDictLink[],
): void {
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
    anchor.textContent = link.name;
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
      url: t.urlTemplate.replace('{term}', encodedTerm).replace('{lang}', langCode),
    }));
}
