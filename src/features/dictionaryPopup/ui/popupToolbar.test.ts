// popupToolbar tests — spec §4.6.3 A8, §9: toolbar + audio/image panels.

import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { renderToolbar, renderAudioPanel, renderImagePanel, renderTranslatePanel, renderLinksPanel, fillExternalDictLinks } from './popupToolbar';
import type { AudioItem, ImageItem } from '../types';

function makeAudio(overrides: Partial<AudioItem> = {}): AudioItem {
  return {
    id: 'a1',
    kind: 'word',
    source: 'community',
    label: 'Forvo · US',
    state: 'idle',
    defaultSelected: true,
    ...overrides,
  };
}

function makeImage(overrides: Partial<ImageItem> = {}): ImageItem {
  return {
    id: 'img1',
    alt: 'a cat',
    src: 'https://example.com/cat.jpg',
    defaultSelected: true,
    ...overrides,
  };
}

describe('renderToolbar', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
  });

  it('renders 4 tab buttons + None button', () => {
    renderToolbar(container, null, jest.fn(), jest.fn());
    const tabs = container.querySelectorAll('.js-cell-tab');
    const close = container.querySelector('.js-cell-tab-close');
    expect(tabs.length).toBe(4);
    expect(close).not.toBeNull();
  });

  it('marks active tab with icon-btn--active class', () => {
    renderToolbar(container, 'audio', jest.fn(), jest.fn());
    const audioTab = container.querySelector('.js-cell-tab[data-cell-tab="audio"]') as HTMLButtonElement;
    expect(audioTab.className).toContain('icon-btn--active');
  });

  it('inactive tab does not have icon-btn--active class', () => {
    renderToolbar(container, 'image', jest.fn(), jest.fn());
    const audioTab = container.querySelector('.js-cell-tab[data-cell-tab="audio"]') as HTMLButtonElement;
    expect(audioTab.className).not.toContain('icon-btn--active');
  });

  it('tab click triggers onTabToggle', () => {
    const onToggle = jest.fn();
    renderToolbar(container, null, onToggle, jest.fn());
    const audioTab = container.querySelector('.js-cell-tab[data-cell-tab="audio"]') as HTMLButtonElement;
    audioTab.click();
    expect(onToggle).toHaveBeenCalledWith('audio');
  });

  it('has aria-label on each tab', () => {
    renderToolbar(container, null, jest.fn(), jest.fn());
    const tabs = container.querySelectorAll('.js-cell-tab');
    tabs.forEach((t) => {
      expect(t.getAttribute('aria-label')).toBeTruthy();
    });
  });

  it('None button click triggers onClose', () => {
    const onClose = jest.fn();
    renderToolbar(container, 'audio', jest.fn(), onClose);
    const noneBtn = container.querySelector('.js-cell-tab-close') as HTMLButtonElement;
    noneBtn.click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders SVG icon inside each tab button', () => {
    renderToolbar(container, null, jest.fn(), jest.fn());
    const allBtns = container.querySelectorAll('.js-cell-tab, .js-cell-tab-close');
    allBtns.forEach((t) => {
      expect(t.querySelector('svg')).not.toBeNull();
    });
  });

  it('renders badge when selectionCounts > 0', () => {
    renderToolbar(container, null, jest.fn(), jest.fn(), { audio: 2, image: 1 });
    const audioTab = container.querySelector('.js-cell-tab[data-cell-tab="audio"]') as HTMLButtonElement;
    const imageTab = container.querySelector('.js-cell-tab[data-cell-tab="image"]') as HTMLButtonElement;
    const translateTab = container.querySelector('.js-cell-tab[data-cell-tab="translate"]') as HTMLButtonElement;
    expect(audioTab.querySelector('.cell-toolbar__badge')?.textContent).toBe('2');
    expect(imageTab.querySelector('.cell-toolbar__badge')?.textContent).toBe('1');
    expect(translateTab.querySelector('.cell-toolbar__badge')).toBeNull();
  });

  it('does not render badge when count is 0', () => {
    renderToolbar(container, null, jest.fn(), jest.fn(), { audio: 0 });
    const audioTab = container.querySelector('.js-cell-tab[data-cell-tab="audio"]') as HTMLButtonElement;
    expect(audioTab.querySelector('.cell-toolbar__badge')).toBeNull();
  });
});

describe('renderAudioPanel', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
  });

  it('renders word + sentence groups with renamed headers', () => {
    const wordAudios = [makeAudio({ id: 'w1', label: 'Forvo · US' })];
    const sentenceAudios = [makeAudio({ id: 's1', kind: 'sentence', label: 'System TTS' })];
    renderAudioPanel(container, wordAudios, sentenceAudios, new Map(), jest.fn(), jest.fn());
    const groups = container.querySelectorAll('.cell-audio__group-label');
    expect(groups.length).toBe(2);
    expect(groups[0]!.textContent).toBe('Word Audio');
    expect(groups[1]!.textContent).toBe('Sentence Audio');
  });

  it('renders play buttons with SVG icon (not text ▶)', () => {
    const wordAudios = [makeAudio({ id: 'w1' })];
    renderAudioPanel(container, wordAudios, [], new Map(), jest.fn(), jest.fn());
    const playBtns = container.querySelectorAll('.js-cell-audio-play');
    expect(playBtns.length).toBe(1);
    // Must contain SVG, not text ▶
    const playBtn = playBtns[0] as HTMLButtonElement;
    expect(playBtn.querySelector('svg')).not.toBeNull();
    expect(playBtn.textContent).not.toContain('▶');
  });

  it('play button click triggers onPlay', () => {
    const onPlay = jest.fn();
    const wordAudios = [makeAudio({ id: 'w1' })];
    renderAudioPanel(container, wordAudios, [], new Map(), jest.fn(), onPlay);
    const playBtn = container.querySelector('.js-cell-audio-play') as HTMLButtonElement;
    playBtn.click();
    expect(onPlay).toHaveBeenCalledWith(wordAudios[0]);
  });

  it('label click triggers onToggle', () => {
    const onToggle = jest.fn();
    const wordAudios = [makeAudio({ id: 'w1', label: 'Forvo · US · Female' })];
    renderAudioPanel(container, wordAudios, [], new Map([['w1', true]]), onToggle, jest.fn());
    const labelEl = container.querySelector('.js-cell-audio-label') as HTMLSpanElement;
    labelEl.click();
    expect(onToggle).toHaveBeenCalledWith('w1', false);
  });

  it('splits label into name + meta by " · "', () => {
    const wordAudios = [makeAudio({ id: 'w1', label: 'Forvo · US · Female' })];
    renderAudioPanel(container, wordAudios, [], new Map(), jest.fn(), jest.fn());
    const nameEl = container.querySelector('.cell-audio__label-name') as HTMLSpanElement;
    const metaEl = container.querySelector('.cell-audio__label-meta') as HTMLSpanElement;
    expect(nameEl.textContent).toBe('Forvo');
    expect(metaEl.textContent).toBe('US · Female');
  });

  it('checkbox hidden when unchecked, visible when checked', () => {
    const wordAudios = [makeAudio({ id: 'w1' }), makeAudio({ id: 'w2' })];
    renderAudioPanel(container, wordAudios, [], new Map([['w1', true], ['w2', false]]), jest.fn(), jest.fn());
    const checks = container.querySelectorAll('.cell-audio__check');
    expect(checks.length).toBe(2);
    expect(checks[0]!.classList.contains('cell-audio__check--checked')).toBe(true);
    expect(checks[1]!.classList.contains('cell-audio__check--checked')).toBe(false);
  });

  it('renders empty state with icon + title + button', () => {
    renderAudioPanel(container, [], [], new Map(), jest.fn(), jest.fn());
    expect(container.textContent).toContain('No audio available');
    expect(container.querySelector('.cell-audio__empty-icon svg')).not.toBeNull();
    expect(container.querySelector('.js-cell-audio-tts-fallback')).not.toBeNull();
  });

  it('audio item has layout: play button, label, checkbox', () => {
    const wordAudios = [makeAudio({ id: 'w1', label: 'Forvo · US' })];
    renderAudioPanel(container, wordAudios, [], new Map(), jest.fn(), jest.fn());
    const item = container.querySelector('.js-cell-audio-item') as HTMLDivElement;
    expect(item).not.toBeNull();
    const playBtn = item.querySelector('.js-cell-audio-play');
    const label = item.querySelector('.js-cell-audio-label');
    const check = item.querySelector('.js-cell-audio-check');
    expect(playBtn).not.toBeNull();
    expect(label).not.toBeNull();
    expect(check).not.toBeNull();
  });
});

describe('renderImagePanel', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
  });

  it('renders images as clickable cards with role=checkbox', () => {
    const images = [makeImage({ id: 'img1' }), makeImage({ id: 'img2' })];
    renderImagePanel(container, images, new Map([['img1', true], ['img2', false]]), jest.fn());
    const imgs = container.querySelectorAll('img');
    expect(imgs.length).toBe(2);
    const cards = container.querySelectorAll('.js-cell-image-card');
    expect(cards.length).toBe(2);
    expect(cards[0]!.getAttribute('aria-checked')).toBe('true');
    expect(cards[1]!.getAttribute('aria-checked')).toBe('false');
  });

  it('card click triggers onToggle', () => {
    const onToggle = jest.fn();
    const images = [makeImage({ id: 'img1' })];
    renderImagePanel(container, images, new Map([['img1', true]]), onToggle);
    const card = container.querySelector('.js-cell-image-card') as HTMLButtonElement;
    card.click();
    expect(onToggle).toHaveBeenCalledWith('img1', false);
  });

  it('renders empty state when no images', () => {
    renderImagePanel(container, [], new Map(), jest.fn());
    expect(container.textContent).toContain('No images available');
  });

  it('sets alt text on images', () => {
    const images = [makeImage({ alt: 'a cat sitting' })];
    renderImagePanel(container, images, new Map(), jest.fn());
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img.alt).toBe('a cat sitting');
  });
});

describe('renderTranslatePanel', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
  });

  it('shows empty state with icon + title + button when no translation', () => {
    renderTranslatePanel(container, '', '', 'vi', jest.fn());
    expect(container.textContent).toContain('No translation');
    expect(container.querySelector('.cell-translate__empty-icon svg')).not.toBeNull();
    const btn = container.querySelector('.js-cell-translate-btn') as HTMLButtonElement;
    expect(btn.textContent).toContain('Translate to vi');
  });

  it('shows empty state when source sentence exists but no translation', () => {
    renderTranslatePanel(container, '', 'Hello world', 'vi', jest.fn());
    expect(container.textContent).toContain('No translation');
    const btn = container.querySelector('.js-cell-translate-btn') as HTMLButtonElement;
    expect(btn).not.toBeNull();
  });

  it('shows single block with target + native when translation present', () => {
    renderTranslatePanel(container, 'Xin chào thế giới', 'Hello world', 'vi', jest.fn());
    const block = container.querySelector('.js-cell-translate-block');
    expect(block).not.toBeNull();
    expect(container.querySelector('.cell-translate__target')?.textContent).toBe('Hello world');
    expect(container.querySelector('.cell-translate__native')?.textContent).toBe('Xin chào thế giới');
  });

  it('translate button click triggers onTranslate', () => {
    const onTranslate = jest.fn();
    renderTranslatePanel(container, '', 'Hello world', 'vi', onTranslate);
    const btn = container.querySelector('.js-cell-translate-btn') as HTMLButtonElement;
    btn.click();
    expect(onTranslate).toHaveBeenCalledTimes(1);
  });

  it('block click triggers onToggleSelect', () => {
    const onToggle = jest.fn();
    renderTranslatePanel(container, 'Xin chào', 'Hello', 'vi', jest.fn(), false, onToggle);
    const block = container.querySelector('.js-cell-translate-block') as HTMLDivElement;
    block.click();
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('checkbox hidden when not selected, visible when selected', () => {
    renderTranslatePanel(container, 'Xin chào', 'Hello', 'vi', jest.fn(), true);
    const check = container.querySelector('.js-cell-translate-check') as HTMLSpanElement;
    expect(check.classList.contains('cell-translate__check--checked')).toBe(true);

    container.innerHTML = '';
    renderTranslatePanel(container, 'Xin chào', 'Hello', 'vi', jest.fn(), false);
    const check2 = container.querySelector('.js-cell-translate-check') as HTMLSpanElement;
    expect(check2.classList.contains('cell-translate__check--checked')).toBe(false);
  });

  it('selected block has --selected modifier', () => {
    renderTranslatePanel(container, 'Xin chào', 'Hello', 'vi', jest.fn(), true);
    const block = container.querySelector('.js-cell-translate-block') as HTMLDivElement;
    expect(block.classList.contains('cell-translate__block--selected')).toBe(true);
  });
});

describe('renderLinksPanel', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
  });

  it('renders external dict links', () => {
    const links = [
      { id: 'cambridge', name: 'Cambridge', url: 'https://dictionary.cambridge.org/dictionary/english/take' },
      { id: 'wiktionary', name: 'Wiktionary', url: 'https://en.wiktionary.org/wiki/take' },
    ];
    renderLinksPanel(container, links);
    const anchors = container.querySelectorAll('a');
    expect(anchors.length).toBe(2);
    expect(anchors[0]!.textContent).toBe('Cambridge');
    expect(anchors[0]!.getAttribute('href')).toBe('https://dictionary.cambridge.org/dictionary/english/take');
  });

  it('links open in new tab with noopener', () => {
    const links = [{ id: 'g', name: 'Google', url: 'https://translate.google.com/' }];
    renderLinksPanel(container, links);
    const anchor = container.querySelector('a') as HTMLAnchorElement;
    expect(anchor.target).toBe('_blank');
    expect(anchor.rel).toContain('noopener');
  });

  it('renders empty state when no links', () => {
    renderLinksPanel(container, []);
    expect(container.textContent).toContain('No external dictionary links');
  });
});

describe('fillExternalDictLinks', () => {
  const templates = [
    { id: 'cambridge', name: 'Cambridge', urlTemplate: 'https://dictionary.cambridge.org/dictionary/english/{term}', langCodes: ['en'] },
    { id: 'gtranslate', name: 'Google Translate', urlTemplate: 'https://translate.google.com/?sl=auto&tl={lang}&text={term}', langCodes: [] },
  ];

  it('fills term + lang in URL template', () => {
    const links = fillExternalDictLinks(templates, 'take off', 'en');
    expect(links[0]!.url).toBe('https://dictionary.cambridge.org/dictionary/english/take%20off');
    expect(links[1]!.url).toBe('https://translate.google.com/?sl=auto&tl=en&text=take%20off');
  });

  it('filters by langCode', () => {
    const links = fillExternalDictLinks(templates, '你好', 'zh');
    // Cambridge only applies to 'en', so only gtranslate should appear.
    expect(links.length).toBe(1);
    expect(links[0]!.id).toBe('gtranslate');
  });

  it('includes links with empty langCodes for all languages', () => {
    const links = fillExternalDictLinks(templates, 'test', 'fr');
    expect(links.length).toBe(1);
    expect(links[0]!.id).toBe('gtranslate');
  });
});
