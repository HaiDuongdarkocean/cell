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

/** Render the toolbar with icon-btn toggle buttons + None button to close panel.
 *  Uses shared .icon-btn .icon-btn--sm class from components.css (single source
 *  for hover/active/focus behavior across React + content script surfaces).
 *  Active tab = .is-active class (primary-subtle fill + primary text).
 *  Icons: ICON_CATALOG from @/shared/icons (Lucide convention, stroke 2, currentColor). */
export function renderToolbar(
  container: HTMLElement,
  activeTab: PopupTab | null,
  onTabToggle: (tab: PopupTab) => void,
  onClose?: () => void,
): void {
  const toolbar = document.createElement('div');
  toolbar.className = 'cell-toolbar js-cell-toolbar';

  for (const config of TAB_CONFIG) {
    const btn = document.createElement('button');
    btn.className = 'icon-btn icon-btn--sm js-cell-tab' + (activeTab === config.tab ? ' icon-btn--active' : '');
    btn.setAttribute('data-cell-tab', config.tab);
    btn.setAttribute('aria-label', config.label);
    btn.title = config.label;
    btn.innerHTML = config.icon;
    btn.addEventListener('click', () => onTabToggle(config.tab));
    toolbar.appendChild(btn);
  }

  // None button — closes any active tab panel. Uses eye-off icon (hide).
  if (onClose) {
    const noneBtn = document.createElement('button');
    noneBtn.className = 'icon-btn icon-btn--sm js-cell-tab-close' + (activeTab === null ? ' icon-btn--active' : '');
    noneBtn.setAttribute('aria-label', 'Hide panel');
    noneBtn.title = 'Hide panel';
    noneBtn.innerHTML = ICON_CATALOG.eyeOff.svg;
    noneBtn.style.marginLeft = 'auto';
    noneBtn.addEventListener('click', onClose);
    toolbar.appendChild(noneBtn);
  }

  container.appendChild(toolbar);
}

/** Render the audio panel — Word Audio / Sentence Audio groups.
 *  Layout per item: [play button] [label] [selection indicator].
 *  - Play button: circular, SVG play icon, design-system icon-btn style.
 *  - Selection: dot by default, checkbox on hover or when checked (Option A).
 *  - Row: hover=surface-hover fill, radius-lg (10px) — design-system list-item. */
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

      // Play button — uses shared .icon-btn .icon-btn--sm .icon-btn--outlined
      // from components.css. Hover/active/focus behavior is single-sourced.
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

      // Label text — flex:1 fills remaining space.
      const labelEl = document.createElement('span');
      labelEl.className = 'cell-audio__label';
      labelEl.textContent = item.label;
      row.appendChild(labelEl);

      // Selection indicator — dot by default, checkbox on hover or checked.
      // Reuses cell-def__check pattern from popupDictionary.css.
      const checkLabel = document.createElement('label');
      checkLabel.className = 'cell-def__check js-cell-audio-check' + (isChecked ? ' cell-def__check--checked' : '');
      const dot = document.createElement('span');
      dot.className = 'cell-def__check-dot';
      checkLabel.appendChild(dot);
      const box = document.createElement('span');
      box.className = 'cell-def__check-box';
      const tick = document.createElement('span');
      tick.className = 'cell-def__check-tick';
      tick.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="width:10px;height:10px;display:block"><path d="M20 6 9 17l-5-5"/></svg>`;
      box.appendChild(tick);
      checkLabel.appendChild(box);
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = isChecked;
      checkbox.className = 'cell-def__check-input js-cell-audio-checkbox';
      checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        onToggle(item.id, checkbox.checked);
        checkLabel.classList.toggle('cell-def__check--checked', checkbox.checked);
      });
      checkLabel.appendChild(checkbox);
      row.appendChild(checkLabel);

      panel.appendChild(row);
    }
  };

  renderGroup('Word Audio', wordAudios);
  renderGroup('Sentence Audio', sentenceAudios);

  if (wordAudios.length === 0 && sentenceAudios.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'cell-audio__empty';
    empty.textContent = 'No audio available.';
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
    title.textContent = 'No images available';
    empty.appendChild(title);
    const desc = document.createElement('div');
    desc.className = 'cell-image__empty-description';
    desc.textContent = 'Find images on Google Images for this word.';
    empty.appendChild(desc);
    // MVP: link to Google Images search (no scrape — ponytail: scrape later).
    if (searchTerm) {
      const link = document.createElement('a');
      link.className = 'cell-image__empty-action btn btn--outline btn--sm';
      link.href = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(searchTerm)}`;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.innerHTML = `${ICON_CATALOG.search.svg}<span>Search on Google Images</span>`;
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

/** Render the translate panel — target translation + source sentence card. */
export function renderTranslatePanel(
  container: HTMLElement,
  translation: string,
  sourceSentence: string,
  targetLang: string,
  onTranslate: () => void,
): void {
  const panel = document.createElement('div');
  panel.className = 'cell-translate js-cell-panel';
  panel.setAttribute('data-cell-panel', 'translate');

  if (translation) {
    // Show translation result.
    const result = document.createElement('div');
    result.className = 'cell-translate__result';
    result.textContent = translation;
    panel.appendChild(result);
  } else {
    // Show translate button.
    const btn = document.createElement('button');
    btn.className = 'cell-translate__button';
    btn.textContent = `Translate to ${targetLang}`;
    btn.addEventListener('click', onTranslate);
    panel.appendChild(btn);
  }

  // Source sentence card.
  if (sourceSentence) {
    const card = document.createElement('div');
    card.className = 'cell-translate__source';
    card.textContent = sourceSentence;
    panel.appendChild(card);
  }

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
    empty.textContent = 'No external dictionary links configured.';
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
