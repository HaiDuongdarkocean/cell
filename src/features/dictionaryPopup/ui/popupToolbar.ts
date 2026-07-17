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
  toolbar.setAttribute('data-dp-toolbar', '');
  toolbar.style.cssText = 'display:flex;gap:4px;padding:4px 12px;border-bottom:1px solid var(--color-border,#e2e8f0);align-items:center;';

  for (const config of TAB_CONFIG) {
    const btn = document.createElement('button');
    btn.setAttribute('data-dp-tab', config.tab);
    btn.setAttribute('aria-label', config.label);
    btn.title = config.label;
    btn.innerHTML = config.icon;
    btn.className = 'icon-btn icon-btn--sm' + (activeTab === config.tab ? ' icon-btn--active' : '');
    btn.addEventListener('click', () => onTabToggle(config.tab));
    toolbar.appendChild(btn);
  }

  // None button — closes any active tab panel. Uses eye-off icon (hide).
  if (onClose) {
    const noneBtn = document.createElement('button');
    noneBtn.setAttribute('data-dp-tab', 'none');
    noneBtn.setAttribute('aria-label', 'Hide panel');
    noneBtn.title = 'Hide panel';
    noneBtn.innerHTML = ICON_CATALOG.eyeOff.svg;
    noneBtn.className = 'icon-btn icon-btn--sm' + (activeTab === null ? ' icon-btn--active' : '');
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
  panel.setAttribute('data-dp-panel', 'audio');
  panel.style.cssText = 'padding:8px 12px;overflow-y:auto;max-height:200px;';

  const renderGroup = (label: string, items: readonly AudioItem[]) => {
    if (items.length === 0) return;
    const groupLabel = document.createElement('div');
    groupLabel.setAttribute('data-dp-audio-group', '');
    groupLabel.textContent = label;
    groupLabel.style.cssText = 'font-size:11px;font-weight:600;color:var(--color-text-muted,#64748b);text-transform:uppercase;margin-bottom:4px;margin-top:8px;';
    panel.appendChild(groupLabel);

    for (const item of items) {
      const isChecked = selection.get(item.id) ?? item.defaultSelected;
      const row = document.createElement('div');
      row.setAttribute('data-dp-audio-item', item.id);
      row.className = 'audio-item';
      // design-system.md list-item: hover=surface-hover, radius=lg(10px)
      row.style.cssText = 'position:relative;display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:var(--radius-lg,10px);transition:background 0.15s ease;cursor:default;';
      row.addEventListener('mouseenter', () => { row.style.background = 'var(--color-surface-hover, rgba(0,0,0,0.04))'; });
      row.addEventListener('mouseleave', () => { row.style.background = ''; });

      // Play button — uses shared .icon-btn .icon-btn--sm .icon-btn--outlined
      // from components.css. Hover/active/focus behavior is single-sourced.
      const playBtn = document.createElement('button');
      playBtn.setAttribute('data-dp-audio-play', item.id);
      playBtn.setAttribute('aria-label', `Play ${item.label}`);
      playBtn.title = `Play ${item.label}`;
      playBtn.innerHTML = ICON_CATALOG.play.svg;
      playBtn.className = 'icon-btn icon-btn--sm icon-btn--outlined';
      playBtn.style.flexShrink = '0';
      playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        onPlay(item);
      });
      row.appendChild(playBtn);

      // Label text — flex:1 fills remaining space.
      const labelEl = document.createElement('span');
      labelEl.textContent = item.label;
      labelEl.style.cssText = 'flex:1;font-size:13px;color:var(--color-text,#1e293b);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
      row.appendChild(labelEl);

      // Selection indicator — dot by default, checkbox on hover or checked.
      // Reuses dp-def-dot / dp-def-box CSS classes from popupShell style block.
      const checkLabel = document.createElement('label');
      checkLabel.className = 'def-check' + (isChecked ? ' def-check--checked' : '');
      checkLabel.style.cssText = 'position:relative;width:28px;height:28px;cursor:pointer;box-sizing:border-box;display:flex;align-items:center;justify-content:center;flex-shrink:0;';
      const dot = document.createElement('span');
      dot.className = 'def-check__dot';
      checkLabel.appendChild(dot);
      const box = document.createElement('span');
      box.className = 'def-check__box';
      const tick = document.createElement('span');
      tick.className = 'def-check__tick';
      tick.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="width:10px;height:10px;display:block"><path d="M20 6 9 17l-5-5"/></svg>`;
      box.appendChild(tick);
      checkLabel.appendChild(box);
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = isChecked;
      checkbox.setAttribute('data-dp-audio-checkbox', item.id);
      checkbox.className = 'def-check__input';
      checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        onToggle(item.id, checkbox.checked);
        checkLabel.classList.toggle('is-checked', checkbox.checked);
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
    empty.style.cssText = 'color:var(--color-text-muted,#64748b);font-style:italic;padding:8px 0;';
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
  panel.setAttribute('data-dp-panel', 'image');
  panel.style.cssText = 'padding:8px 12px;overflow-x:auto;max-height:200px;display:flex;gap:8px;';

  if (images.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'color:var(--color-text-muted,#64748b);font-style:italic;padding:8px 0;';
    empty.textContent = 'No images available.';
    panel.appendChild(empty);
    // MVP: link to Google Images search (no scrape — ponytail: scrape later).
    if (searchTerm) {
      const link = document.createElement('a');
      link.href = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(searchTerm)}`;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.style.cssText = 'display:block;margin-top:4px;font-size:12px;color:var(--color-primary,#3b82f6);';
      link.textContent = 'Search on Google Images →';
      panel.appendChild(link);
    }
    container.appendChild(panel);
    return;
  }

  for (const img of images) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;flex-shrink:0;';

    const imgEl = document.createElement('img');
    imgEl.src = img.src;
    imgEl.alt = img.alt;
    imgEl.style.cssText = 'width:80px;height:60px;object-fit:cover;border-radius:4px;border:1px solid var(--color-border,#e2e8f0);';
    wrap.appendChild(imgEl);

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = selection.get(img.id) ?? img.defaultSelected;
    checkbox.style.cssText = 'position:absolute;top:2px;right:2px;margin:0;';
    checkbox.addEventListener('change', () => onToggle(img.id, checkbox.checked));
    wrap.appendChild(checkbox);

    panel.appendChild(wrap);
  }

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
  panel.setAttribute('data-dp-panel', 'translate');
  panel.style.cssText = 'padding:8px 12px;';

  if (translation) {
    // Show translation result.
    const result = document.createElement('div');
    result.style.cssText = 'padding:8px;border-radius:6px;background:var(--color-surface-hover,#f1f5f9);margin-bottom:8px;';
    result.textContent = translation;
    panel.appendChild(result);
  } else {
    // Show translate button.
    const btn = document.createElement('button');
    btn.textContent = `Translate to ${targetLang}`;
    btn.style.cssText = 'padding:4px 12px;border-radius:6px;border:1px solid var(--color-border,#cbd5e1);background:transparent;cursor:pointer;font-size:13px;width:100%;';
    btn.addEventListener('click', onTranslate);
    panel.appendChild(btn);
  }

  // Source sentence card.
  if (sourceSentence) {
    const card = document.createElement('div');
    card.style.cssText = 'padding:6px 8px;border-radius:6px;border:1px solid var(--color-border,#e2e8f0);font-size:12px;color:var(--color-text-muted,#64748b);';
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
  panel.setAttribute('data-dp-panel', 'links');
  panel.style.cssText = 'padding:8px 12px;';

  if (links.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'color:var(--color-text-muted,#64748b);font-style:italic;padding:8px 0;';
    empty.textContent = 'No external dictionary links configured.';
    panel.appendChild(empty);
    container.appendChild(panel);
    return;
  }

  for (const link of links) {
    const anchor = document.createElement('a');
    anchor.href = link.url;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.textContent = link.name;
    anchor.style.cssText = 'display:block;padding:6px 8px;border-radius:6px;color:var(--color-primary,#3b82f6);text-decoration:none;font-size:13px;margin-bottom:4px;';
    anchor.addEventListener('mouseenter', () => {
      anchor.style.background = 'var(--color-primary-subtle,rgba(59,130,246,0.1))';
    });
    anchor.addEventListener('mouseleave', () => {
      anchor.style.background = 'transparent';
    });
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
