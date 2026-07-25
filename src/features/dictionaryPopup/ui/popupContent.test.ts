// popupContent tests — spec redesign: active entry + candidates (Variant D).

import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import {
  renderHeader,
  renderDefinitions,
  renderActiveEntry,
  renderCandidateChips,
  renderPopupContent,
  getOrCreateMaterialsSlot,
  getOrCreateCandidatesContainer,
  initDefinitionSelection,
  getSelectedDefinitions,
  clearContainer,
} from './popupContent';
import type { LookupResult, DefinitionEntry, WordStatus } from '../types';

function makeDefinition(overrides: Partial<DefinitionEntry> = {}): DefinitionEntry {
  return {
    id: 'd1',
    pos: 'verb',
    text: 'to take something off',
    examples: ['Take off your shoes.'],
    source: 'Cambridge',
    defaultSelected: true,
    ...overrides,
  };
}

function makeResult(overrides: Partial<LookupResult> = {}): LookupResult {
  return {
    term: 'take off',
    langCode: 'en',
    reading: '/teɪk ɒf/',
    readingKind: 'ipa',
    frequency: { rank: 1234, source: 'BNC' },
    status: 'unknown',
    partsOfSpeech: ['verb'],
    definitions: [makeDefinition()],
    rawDefinitions: [],
    detectedPhrase: null,
    matchSource: 'dictionary',
    ...overrides,
  };
}

describe('renderHeader', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
  });

  function callHeader(result: LookupResult, status: string, onCycle = jest.fn(), onQuickAdd = jest.fn()) {
    renderHeader(container, result, status as WordStatus, onCycle, onQuickAdd, jest.fn());
  }

  it('renders term + reading in word-row', () => {
    const result = makeResult();
    callHeader(result, 'unknown');
    const term = container.querySelector('.js-cell-term');
    expect(term?.textContent).toBe('take off');
    const reading = container.querySelector('.js-cell-reading');
    expect(reading?.textContent).toBe('/teɪk ɒf/');
  });

  it('wraps IPA in /.../ when readingKind is ipa and not already slashed', () => {
    const result = makeResult({ reading: 'teɪk ɒf', readingKind: 'ipa' });
    callHeader(result, 'unknown');
    const reading = container.querySelector('.js-cell-reading');
    expect(reading?.textContent).toBe('/teɪk ɒf/');
  });

  it('does not double-wrap IPA when already slashed', () => {
    const result = makeResult({ reading: '/teɪk/', readingKind: 'ipa' });
    callHeader(result, 'unknown');
    const reading = container.querySelector('.js-cell-reading');
    expect(reading?.textContent).toBe('/teɪk/');
  });

  it('renders frequency badge in second header row', () => {
    const result = makeResult();
    callHeader(result, 'unknown');
    const second = container.querySelector('.cell-header__second');
    expect(second).not.toBeNull();
    const freq = second!.querySelector('.js-cell-frequency');
    expect(freq?.textContent).toBe('BNC1,234');
  });

  it('colors frequency badge by band', () => {
    const result = makeResult({ frequency: { rank: 1234, source: 'BNC' } });
    callHeader(result, 'unknown');
    const freq = container.querySelector('.cell-header__frequency');
    const source = container.querySelector('.cell-header__frequency-source');
    const rank = container.querySelector('.cell-header__frequency-rank');
    expect(freq?.classList.contains('cell-header__frequency--core')).toBe(true);
    expect(source).not.toBeNull();
    expect(rank).not.toBeNull();
  });

  it('does not render frequency badge when null', () => {
    const result = makeResult({ frequency: null });
    callHeader(result, 'unknown');
    expect(container.querySelector('.js-cell-frequency')).toBeNull();
  });

  it('renders status badge in header second row', () => {
    const result = makeResult();
    callHeader(result, 'tracking');
    const second = container.querySelector('.cell-header__second');
    const status = second!.querySelector('.js-cell-status');
    expect(status?.textContent).toBe('tracking');
  });

  it('status badge click triggers onStatusCycle', () => {
    const onCycle = jest.fn();
    renderHeader(container, makeResult(), 'unknown', onCycle, jest.fn(), jest.fn());
    const badge = container.querySelector('.js-cell-status') as HTMLButtonElement;
    badge.click();
    expect(onCycle).toHaveBeenCalledTimes(1);
  });

  it('does not render reading when empty', () => {
    const result = makeResult({ reading: '' });
    callHeader(result, 'unknown');
    expect(container.querySelector('.js-cell-reading')).toBeNull();
  });

  it('renders Quick Add button in header', () => {
    const result = makeResult();
    callHeader(result, 'unknown');
    expect(container.querySelector('.js-cell-quick-add')).not.toBeNull();
  });

  it('Quick Add click triggers onQuickAdd', () => {
    const onQuickAdd = jest.fn();
    renderHeader(container, makeResult(), 'unknown', jest.fn(), onQuickAdd, jest.fn());
    const btn = container.querySelector('.js-cell-quick-add') as HTMLButtonElement;
    btn.click();
    expect(onQuickAdd).toHaveBeenCalledTimes(1);
  });

  it('does not render a close button (removed — dismiss via Esc/click-outside/swipe)', () => {
    callHeader(makeResult(), 'unknown');
    expect(container.querySelector('.js-cell-close')).toBeNull();
  });

  it('Play term button is rendered and triggers onPlayTerm', () => {
    const onPlayTerm = jest.fn();
    renderHeader(container, makeResult(), 'unknown', jest.fn(), jest.fn(), jest.fn(), onPlayTerm);
    const btn = container.querySelector('.js-cell-play-term') as HTMLButtonElement;
    expect(btn).not.toBeNull();
    btn.click();
    expect(onPlayTerm).toHaveBeenCalledTimes(1);
  });

  it('Play sentence button is rendered and triggers onPlaySentence', () => {
    const onPlaySentence = jest.fn();
    renderHeader(container, makeResult(), 'unknown', jest.fn(), jest.fn(), jest.fn(), undefined, onPlaySentence);
    const btn = container.querySelector('.js-cell-play-sentence') as HTMLButtonElement;
    expect(btn).not.toBeNull();
    btn.click();
    expect(onPlaySentence).toHaveBeenCalledTimes(1);
  });

  it('audio group contains word + sentence buttons close together', () => {
    renderHeader(container, makeResult(), 'unknown', jest.fn(), jest.fn(), jest.fn(), jest.fn(), jest.fn());
    const group = container.querySelector('.cell-header__audio-group');
    expect(group).not.toBeNull();
    expect(group!.querySelector('.js-cell-play-term')).not.toBeNull();
    expect(group!.querySelector('.js-cell-play-sentence')).not.toBeNull();
  });

  it('term gets id for active entry', () => {
    renderHeader(container, makeResult(), 'unknown', jest.fn(), jest.fn(), jest.fn(), jest.fn());
    const term = container.querySelector('.js-cell-term') as HTMLElement;
    expect(term.id).toBe('cell-popup-term');
  });
});

describe('renderDefinitions', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
  });

  it('renders definitions with checkboxes', () => {
    const result = makeResult({
      definitions: [makeDefinition({ id: 'd1' }), makeDefinition({ id: 'd2', text: 'to leave the ground' })],
    });
    const selection = new Map([['d1', true], ['d2', true]]);
    renderDefinitions(container, result, selection, jest.fn());
    const checkboxes = container.querySelectorAll('.js-cell-def-checkbox');
    expect(checkboxes.length).toBe(2);
    expect((checkboxes[0] as HTMLInputElement).checked).toBe(true);
  });

  it('renders pos combined with text (no separate pos span)', () => {
    const result = makeResult();
    renderDefinitions(container, result, new Map(), jest.fn());
    // POS is now combined into the text: "• verb to run"
    const pos = container.querySelector('.cell-def__pos');
    expect(pos).toBeNull();
    const text = container.querySelector('.cell-def__text span');
    expect(text?.textContent).toContain('verb');
  });

  it('renders examples', () => {
    const result = makeResult();
    renderDefinitions(container, result, new Map(), jest.fn());
    const examples = container.querySelectorAll('.js-cell-definitions .js-cell-definition > div > div');
    expect(examples.length).toBeGreaterThan(0);
  });

  it('renders empty state when no definitions', () => {
    const result = makeResult({ definitions: [] });
    renderDefinitions(container, result, new Map(), jest.fn());
    expect(container.textContent).toContain('No definitions found');
  });

  it('checkbox change triggers onToggle', () => {
    const onToggle = jest.fn();
    const result = makeResult();
    renderDefinitions(container, result, new Map([['d1', true]]), onToggle);
    const checkbox = container.querySelector('.js-cell-def-checkbox') as HTMLInputElement;
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change'));
    expect(onToggle).toHaveBeenCalledWith('d1', false);
  });

  it('respects selection map over defaultSelected', () => {
    const result = makeResult();
    const selection = new Map([['d1', false]]);
    renderDefinitions(container, result, selection, jest.fn());
    const checkbox = container.querySelector('.js-cell-def-checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
  });
});

describe('renderActiveEntry', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
  });

  it('wraps header + materials slot + definitions in .js-cell-active-entry', () => {
    const result = makeResult();
    const selection = initDefinitionSelection(result);
    renderActiveEntry(container, result, 'unknown', selection, {
      onStatusCycle: jest.fn(),
      onDefinitionToggle: jest.fn(),
      onQuickAdd: jest.fn(),
      onSendToCreator: jest.fn(),
    });
    const entry = container.querySelector('.js-cell-active-entry');
    expect(entry).not.toBeNull();
    expect(entry?.querySelector('.js-cell-header')).not.toBeNull();
    expect(entry?.querySelector('.js-cell-materials-slot')).not.toBeNull();
    expect(entry?.querySelector('.js-cell-definitions')).not.toBeNull();
  });

  it('active entry has header, materials slot, then definitions in order', () => {
    const result = makeResult();
    const selection = initDefinitionSelection(result);
    renderActiveEntry(container, result, 'unknown', selection, {
      onStatusCycle: jest.fn(),
      onDefinitionToggle: jest.fn(),
      onQuickAdd: jest.fn(),
      onSendToCreator: jest.fn(),
    });
    const entry = container.querySelector('.js-cell-active-entry') as HTMLElement;
    const children = Array.from(entry.children);
    const headerIdx = children.findIndex((c) => c.classList.contains('js-cell-header'));
    const materialsIdx = children.findIndex((c) => c.classList.contains('js-cell-materials-slot'));
    const defIdx = children.findIndex((c) => c.classList.contains('js-cell-definitions'));
    expect(headerIdx).toBeLessThan(materialsIdx);
    expect(materialsIdx).toBeLessThan(defIdx);
  });
});

describe('renderCandidateChips', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
  });

  it('renders chips for candidates with active highlight', () => {
    const candidates = [
      { idx: 0, result: makeResult({ term: 'take off' }), status: 'unknown' as WordStatus },
      { idx: 1, result: makeResult({ term: 'takeaway' }), status: 'unknown' as WordStatus },
    ];
    renderCandidateChips(container, candidates, 1, jest.fn());
    const chips = container.querySelectorAll('.js-cell-chip');
    expect(chips.length).toBe(2);
    expect(chips[1]!.classList.contains('btn--primary')).toBe(true);
  });

  it('click chip triggers onChipClick with idx', () => {
    const onChipClick = jest.fn();
    const candidates = [
      { idx: 0, result: makeResult(), status: 'unknown' as WordStatus },
      { idx: 1, result: makeResult({ term: 'takeaway' }), status: 'unknown' as WordStatus },
    ];
    renderCandidateChips(container, candidates, 0, onChipClick);
    const chip = container.querySelectorAll('.js-cell-chip')[1] as HTMLButtonElement;
    chip.click();
    expect(onChipClick).toHaveBeenCalledWith(1);
  });
});

describe('renderPopupContent', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
  });

  it('renders active entry + candidates container', () => {
    const result = makeResult();
    const selection = initDefinitionSelection(result);
    renderPopupContent(container, result, 'unknown', selection, {
      onStatusCycle: jest.fn(),
      onDefinitionToggle: jest.fn(),
      onQuickAdd: jest.fn(),
      onSendToCreator: jest.fn(),
      onCandidateSelect: jest.fn(),
    });
    expect(container.querySelector('.js-cell-active-entry')).not.toBeNull();
    expect(container.querySelector('.js-cell-candidates')).not.toBeNull();
  });

  it('active entry is before candidates', () => {
    const result = makeResult();
    const selection = initDefinitionSelection(result);
    renderPopupContent(container, result, 'unknown', selection, {
      onStatusCycle: jest.fn(),
      onDefinitionToggle: jest.fn(),
      onQuickAdd: jest.fn(),
      onSendToCreator: jest.fn(),
      onCandidateSelect: jest.fn(),
    });
    const children = Array.from(container.children);
    const activeEntryIdx = children.findIndex((c) => c.classList.contains('js-cell-active-entry'));
    const candidatesIdx = children.findIndex((c) => c.classList.contains('js-cell-candidates'));
    expect(activeEntryIdx).toBeLessThan(candidatesIdx);
  });
});

describe('getOrCreateCandidatesContainer', () => {
  it('creates .js-cell-candidates when none exists', () => {
    const container = document.createElement('div');
    const el = getOrCreateCandidatesContainer(container);
    expect(el).not.toBeNull();
    expect(el.classList.contains('js-cell-candidates')).toBe(true);
    expect(container.querySelector('.js-cell-candidates')).toBe(el);
  });

  it('returns existing .js-cell-candidates', () => {
    const container = document.createElement('div');
    const first = getOrCreateCandidatesContainer(container);
    const second = getOrCreateCandidatesContainer(container);
    expect(second).toBe(first);
    expect(container.querySelectorAll('.js-cell-candidates')).toHaveLength(1);
  });
});

describe('getOrCreateMaterialsSlot', () => {
  it('creates .js-cell-materials-slot when none exists', () => {
    const container = document.createElement('div');
    const el = getOrCreateMaterialsSlot(container);
    expect(el).not.toBeNull();
    expect(el.classList.contains('js-cell-materials-slot')).toBe(true);
    expect(container.querySelector('.js-cell-materials-slot')).toBe(el);
  });

  it('returns existing .js-cell-materials-slot', () => {
    const container = document.createElement('div');
    const first = getOrCreateMaterialsSlot(container);
    const second = getOrCreateMaterialsSlot(container);
    expect(second).toBe(first);
    expect(container.querySelectorAll('.js-cell-materials-slot')).toHaveLength(1);
  });
});

describe('getOrCreateCandidatesContainer', () => {
  it('returns the candidates container', () => {
    const container = document.createElement('div');
    const el = getOrCreateCandidatesContainer(container);
    expect(el.classList.contains('js-cell-candidates')).toBe(true);
  });
});

describe('initDefinitionSelection + getSelectedDefinitions', () => {
  it('defaults all definitions selected', () => {
    const result = makeResult();
    const sel = initDefinitionSelection(result);
    expect(sel.get('d1')).toBe(true);
  });

  it('getSelectedDefinitions respects explicit false over defaultSelected true', () => {
    const result = makeResult();
    const sel = new Map([['d1', false]]);
    const selected = getSelectedDefinitions(result, sel);
    expect(selected.length).toBe(0);
  });

  it('getSelectedDefinitions returns selected definitions', () => {
    const result = makeResult({
      definitions: [
        makeDefinition({ id: 'd1', defaultSelected: true }),
        makeDefinition({ id: 'd2', text: 'to leave the ground', defaultSelected: false }),
      ],
    });
    const sel = new Map([['d1', true], ['d2', true]]);
    const selected = getSelectedDefinitions(result, sel);
    expect(selected.length).toBe(2);
    expect(selected[0]!.text).toBe('to take something off');
    expect(selected[1]!.text).toBe('to leave the ground');
  });
});

describe('clearContainer', () => {
  it('removes all children', () => {
    const container = document.createElement('div');
    container.appendChild(document.createElement('span'));
    container.appendChild(document.createElement('span'));
    clearContainer(container);
    expect(container.children.length).toBe(0);
  });
});
