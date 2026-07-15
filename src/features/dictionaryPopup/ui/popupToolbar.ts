// popupToolbar — spec §4.6.3 A8, §9: toolbar with tab toggle icons + lazy panels.
//
// Toolbar: icon SVG toggle buttons for Audio/Image/Translate/Links.
// Clicking a tab icon toggles the corresponding panel (lazy loaded).
// Only 1 tab active at a time (clicking active tab closes it).
//
// Panels are rendered lazily — content fetched only when tab is first
// opened (spec: "lazy load panel").

import type { PopupTab, AudioItem, ImageItem, ExternalDictLink } from '../types';

export type { PopupTab };

/** Toolbar tab config — icon label + which panel to show. */
const TAB_CONFIG: readonly { readonly tab: PopupTab; readonly label: string; readonly icon: string }[] = [
  { tab: 'audio', label: 'Audio', icon: '🔊' },
  { tab: 'image', label: 'Image', icon: '🖼' },
  { tab: 'translate', label: 'Translate', icon: '🌐' },
  { tab: 'links', label: 'Links', icon: '🔗' },
];

/** Render the toolbar with tab toggle icons. */
export function renderToolbar(
  container: HTMLElement,
  activeTab: PopupTab | null,
  onTabToggle: (tab: PopupTab) => void,
): void {
  const toolbar = document.createElement('div');
  toolbar.setAttribute('data-dp-toolbar', '');
  toolbar.style.cssText = 'display:flex;gap:4px;padding:4px 12px;border-bottom:1px solid var(--dp-border,#e2e8f0);';

  for (const config of TAB_CONFIG) {
    const btn = document.createElement('button');
    btn.setAttribute('data-dp-tab', config.tab);
    btn.setAttribute('aria-label', config.label);
    btn.title = config.label;
    btn.textContent = config.icon;
    const isActive = activeTab === config.tab;
    btn.style.cssText = `padding:4px 8px;border-radius:6px;border:1px solid ${isActive ? 'var(--dp-primary,#3b82f6)' : 'transparent'};background:${isActive ? 'var(--dp-primary-subtle,rgba(59,130,246,0.1))' : 'transparent'};cursor:pointer;font-size:16px;line-height:1;`;
    btn.addEventListener('click', () => onTabToggle(config.tab));
    toolbar.appendChild(btn);
  }

  container.appendChild(toolbar);
}

/** Render the audio panel — PLAY WORD / PLAY SENTENCE groups. */
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
    groupLabel.textContent = label;
    groupLabel.style.cssText = 'font-size:11px;font-weight:600;color:var(--dp-muted,#64748b);text-transform:uppercase;margin-bottom:4px;margin-top:8px;';
    panel.appendChild(groupLabel);

    for (const item of items) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:6px;padding:4px 0;';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = selection.get(item.id) ?? item.defaultSelected;
      checkbox.style.cssText = 'margin:0;';
      checkbox.addEventListener('change', () => onToggle(item.id, checkbox.checked));
      row.appendChild(checkbox);

      const labelEl = document.createElement('span');
      labelEl.textContent = item.label;
      labelEl.style.cssText = 'flex:1;font-size:13px;';
      row.appendChild(labelEl);

      const playBtn = document.createElement('button');
      playBtn.textContent = '▶';
      playBtn.style.cssText = 'border:none;background:transparent;cursor:pointer;font-size:14px;padding:2px 4px;';
      playBtn.setAttribute('aria-label', `Play ${item.label}`);
      playBtn.addEventListener('click', () => onPlay(item));
      row.appendChild(playBtn);

      panel.appendChild(row);
    }
  };

  renderGroup('PLAY WORD', wordAudios);
  renderGroup('PLAY SENTENCE', sentenceAudios);

  if (wordAudios.length === 0 && sentenceAudios.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'color:var(--dp-muted,#64748b);font-style:italic;padding:8px 0;';
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
): void {
  const panel = document.createElement('div');
  panel.setAttribute('data-dp-panel', 'image');
  panel.style.cssText = 'padding:8px 12px;overflow-x:auto;max-height:200px;display:flex;gap:8px;';

  if (images.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'color:var(--dp-muted,#64748b);font-style:italic;padding:8px 0;';
    empty.textContent = 'No images available.';
    panel.appendChild(empty);
    container.appendChild(panel);
    return;
  }

  for (const img of images) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;flex-shrink:0;';

    const imgEl = document.createElement('img');
    imgEl.src = img.src;
    imgEl.alt = img.alt;
    imgEl.style.cssText = 'width:80px;height:60px;object-fit:cover;border-radius:4px;border:1px solid var(--dp-border,#e2e8f0);';
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
    result.style.cssText = 'padding:8px;border-radius:6px;background:var(--dp-badge-bg,#f1f5f9);margin-bottom:8px;';
    result.textContent = translation;
    panel.appendChild(result);
  } else {
    // Show translate button.
    const btn = document.createElement('button');
    btn.textContent = `Translate to ${targetLang}`;
    btn.style.cssText = 'padding:4px 12px;border-radius:6px;border:1px solid var(--dp-border,#cbd5e1);background:transparent;cursor:pointer;font-size:13px;width:100%;';
    btn.addEventListener('click', onTranslate);
    panel.appendChild(btn);
  }

  // Source sentence card.
  if (sourceSentence) {
    const card = document.createElement('div');
    card.style.cssText = 'padding:6px 8px;border-radius:6px;border:1px solid var(--dp-border,#e2e8f0);font-size:12px;color:var(--dp-muted,#64748b);';
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
    empty.style.cssText = 'color:var(--dp-muted,#64748b);font-style:italic;padding:8px 0;';
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
    anchor.style.cssText = 'display:block;padding:6px 8px;border-radius:6px;color:var(--dp-primary,#3b82f6);text-decoration:none;font-size:13px;margin-bottom:4px;';
    anchor.addEventListener('mouseenter', () => {
      anchor.style.background = 'var(--dp-primary-subtle,rgba(59,130,246,0.1))';
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
