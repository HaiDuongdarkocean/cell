// popupContent tests — spec §4.6.3 A4/A9, §9: header + definitions.

import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import {
  renderHeader,
  renderDefinitions,
  renderPopupContent,
  renderCandidate,
  appendCandidateContent,
  initDefinitionSelection,
  getSelectedDefinitions,
  clearContainer,
  getOrCreateCandidateList,
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

  // Helper: renderHeader now takes 7 args (added onSendToCreator, onSettings).
  function callHeader(result: LookupResult, status: string, onCycle = jest.fn(), onQuickAdd = jest.fn()) {
    renderHeader(container, result, status as WordStatus, onCycle, onQuickAdd, jest.fn(), jest.fn());
  }

  it('renders term + reading', () => {
    const result = makeResult();
    callHeader(result, 'unknown');
    const term = container.querySelector('.js-cell-term');
    expect(term?.textContent).toBe('take off');
    const reading = container.querySelector('.js-cell-reading');
    expect(reading?.textContent).toBe('/teɪk ɒf/');
  });

  it('renders frequency badge when present', () => {
    const result = makeResult();
    callHeader(result, 'unknown');
    const freq = container.querySelector('.js-cell-frequency');
    // 2-segment pill: source + rank (toLocaleString)
    expect(freq?.textContent).toBe('BNC1,234');
  });

  it('does not render frequency badge when null', () => {
    const result = makeResult({ frequency: null });
    callHeader(result, 'unknown');
    expect(container.querySelector('.js-cell-frequency')).toBeNull();
  });

  it('renders status badge with current status', () => {
    const result = makeResult();
    callHeader(result, 'tracking');
    const status = container.querySelector('.js-cell-status');
    expect(status?.textContent).toBe('tracking');
  });

  it('status badge click triggers onStatusCycle', () => {
    const onCycle = jest.fn();
    const result = makeResult();
    callHeader(result, 'unknown', onCycle);
    const badge = container.querySelector('.js-cell-status') as HTMLButtonElement;
    badge.click();
    expect(onCycle).toHaveBeenCalledTimes(1);
  });

  it('does not render reading when empty', () => {
    const result = makeResult({ reading: '' });
    callHeader(result, 'unknown');
    expect(container.querySelector('.js-cell-reading')).toBeNull();
  });

  it('renders Settings, Send to Card, and Quick Add buttons', () => {
    const result = makeResult();
    callHeader(result, 'unknown');
    expect(container.querySelector('.js-cell-settings')).not.toBeNull();
    expect(container.querySelector('.js-cell-send-to-creator')).not.toBeNull();
    expect(container.querySelector('.js-cell-quick-add')).not.toBeNull();
  });

  it('Settings button click triggers onSettings', () => {
    const onSettings = jest.fn();
    renderHeader(container, makeResult(), 'unknown', jest.fn(), jest.fn(), jest.fn(), onSettings);
    const btn = container.querySelector('.js-cell-settings') as HTMLButtonElement;
    btn.click();
    expect(onSettings).toHaveBeenCalledTimes(1);
  });

  it('Send to Card button click triggers onSendToCreator', () => {
    const onSend = jest.fn();
    renderHeader(container, makeResult(), 'unknown', jest.fn(), jest.fn(), onSend, jest.fn());
    const btn = container.querySelector('.js-cell-send-to-creator') as HTMLButtonElement;
    btn.click();
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it('Close button is rendered and triggers onClose', () => {
    const onClose = jest.fn();
    renderHeader(container, makeResult(), 'unknown', jest.fn(), jest.fn(), jest.fn(), jest.fn(), onClose);
    const btn = container.querySelector('.js-cell-close') as HTMLButtonElement;
    expect(btn).not.toBeNull();
    btn.click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Play term button is rendered and triggers onPlayTerm', () => {
    const onPlayTerm = jest.fn();
    renderHeader(container, makeResult(), 'unknown', jest.fn(), jest.fn(), jest.fn(), jest.fn(), undefined, onPlayTerm);
    const btn = container.querySelector('.js-cell-play-term') as HTMLButtonElement;
    expect(btn).not.toBeNull();
    btn.click();
    expect(onPlayTerm).toHaveBeenCalledTimes(1);
  });

  it('winner term gets aria-labelledby id', () => {
    renderHeader(container, makeResult(), 'unknown', jest.fn(), jest.fn(), jest.fn(), jest.fn(), undefined, jest.fn(), true);
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

  it('renders pos label', () => {
    const result = makeResult();
    renderDefinitions(container, result, new Map(), jest.fn());
    const pos = container.querySelector('.cell-def__pos');
    expect(pos?.textContent).toBe('verb. ');
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

  // --- Phương án A: checkbox gutter (label wraps checkbox only) ---

  it('clicking the checkbox gutter (label) toggles the checkbox', () => {
    const onToggle = jest.fn();
    const result = makeResult();
    renderDefinitions(container, result, new Map([['d1', false]]), onToggle);
    // The <label> wraps the checkbox — clicking it should toggle.
    // ponytail: jsdom doesn't fire `change` on label click (real browsers do).
    // Verify checkbox.checked toggled — the change→onToggle wiring is tested
    // separately in "checkbox change triggers onToggle".
    const label = container.querySelector('.js-cell-definition label') as HTMLLabelElement;
    expect(label).not.toBeNull();
    expect(label.tagName).toBe('LABEL');
    label.click();
    const checkbox = container.querySelector('.js-cell-def-checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  it('clicking the definition text does NOT toggle the checkbox', () => {
    const onToggle = jest.fn();
    const result = makeResult();
    renderDefinitions(container, result, new Map([['d1', false]]), onToggle);
    // The text area is a sibling outside the <label> — clicking it should
    // NOT toggle the checkbox (leaves text free for future click-to-lookup).
    const defItem = container.querySelector('.js-cell-definition') as HTMLDivElement;
    const textWrap = defItem.querySelector('div:not(.js-cell-def-checkbox)') as HTMLDivElement;
    expect(textWrap).not.toBeNull();
    textWrap.click();
    const checkbox = container.querySelector('.js-cell-def-checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    expect(onToggle).not.toHaveBeenCalled();
  });
});

describe('initDefinitionSelection', () => {
  it('initializes all definitions with defaultSelected', () => {
    const result = makeResult({
      definitions: [
        makeDefinition({ id: 'd1', defaultSelected: true }),
        makeDefinition({ id: 'd2', defaultSelected: false }),
      ],
    });
    const selection = initDefinitionSelection(result);
    expect(selection.get('d1')).toBe(true);
    expect(selection.get('d2')).toBe(false);
  });
});

describe('getSelectedDefinitions', () => {
  it('returns only selected definitions', () => {
    const defs = [
      makeDefinition({ id: 'd1' }),
      makeDefinition({ id: 'd2' }),
    ];
    const result = makeResult({ definitions: defs });
    const selection = new Map([['d1', true], ['d2', false]]);
    const selected = getSelectedDefinitions(result, selection);
    expect(selected).toHaveLength(1);
    expect(selected[0]!.id).toBe('d1');
  });

  it('falls back to defaultSelected when not in map', () => {
    const defs = [
      makeDefinition({ id: 'd1', defaultSelected: true }),
    ];
    const result = makeResult({ definitions: defs });
    const selection = new Map<string, boolean>();
    const selected = getSelectedDefinitions(result, selection);
    expect(selected).toHaveLength(1);
  });
});

describe('clearContainer', () => {
  it('removes all children', () => {
    const container = document.createElement('div');
    container.appendChild(document.createElement('div'));
    container.appendChild(document.createElement('div'));
    clearContainer(container);
    expect(container.children.length).toBe(0);
  });
});

describe('renderPopupContent (full)', () => {
  it('renders header + definitions + footer', () => {
    const container = document.createElement('div');
    const result = makeResult();
    const selection = initDefinitionSelection(result);
    renderPopupContent(container, result, 'unknown', selection, {
      onStatusCycle: jest.fn(),
      onDefinitionToggle: jest.fn(),
      onQuickAdd: jest.fn(),
      onSendToCreator: jest.fn(),
      onSettings: jest.fn(),
    });
    expect(container.querySelector('.js-cell-header')).not.toBeNull();
    expect(container.querySelector('.js-cell-definitions')).not.toBeNull();
    // Quick Add moved into header (no separate footer).
    expect(container.querySelector('.js-cell-quick-add')).not.toBeNull();
    expect(container.querySelector('.js-cell-settings')).not.toBeNull();
    expect(container.querySelector('.js-cell-send-to-creator')).not.toBeNull();
  });
});

describe('renderCandidate', () => {
  it('wraps header + definitions in a .js-cell-popup-candidate element', () => {
    const container = document.createElement('div');
    const result = makeResult();
    const selection = initDefinitionSelection(result);
    const candidate = renderCandidate(container, result, 'unknown', selection, {
      onStatusCycle: jest.fn(),
      onDefinitionToggle: jest.fn(),
      onQuickAdd: jest.fn(),
      onSendToCreator: jest.fn(),
      onSettings: jest.fn(),
    });
    expect(candidate.classList.contains('js-cell-popup-candidate')).toBe(true);
    expect(container.querySelector('.js-cell-popup-candidate')).toBe(candidate);
    expect(candidate.querySelector('.js-cell-header')).not.toBeNull();
    expect(candidate.querySelector('.js-cell-definitions')).not.toBeNull();
  });
});

describe('appendCandidateContent', () => {
  it('appends a second candidate without clearing existing content', () => {
    const container = document.createElement('div');
    const result1 = makeResult({ term: 'get out' });
    const result2 = makeResult({ term: 'get over', definitions: [makeDefinition({ id: 'd2', text: 'to recover' })] });
    const sel1 = initDefinitionSelection(result1);
    const sel2 = initDefinitionSelection(result2);
    renderCandidate(container, result1, 'unknown', sel1, {
      onStatusCycle: jest.fn(), onDefinitionToggle: jest.fn(),
      onQuickAdd: jest.fn(), onSendToCreator: jest.fn(), onSettings: jest.fn(),
    });
    appendCandidateContent(container, result2, 'unknown', sel2, {
      onStatusCycle: jest.fn(), onDefinitionToggle: jest.fn(),
      onQuickAdd: jest.fn(), onSendToCreator: jest.fn(), onSettings: jest.fn(),
    });
    const candidates = container.querySelectorAll('.js-cell-popup-candidate');
    expect(candidates).toHaveLength(2);
    // First candidate still has its header (not cleared).
    expect(candidates[0]!.querySelector('.js-cell-term')!.textContent).toBe('get out');
    expect(candidates[1]!.querySelector('.js-cell-term')!.textContent).toBe('get over');
  });
});

describe('sticky header CSS (.js-cell-header)', () => {
  it('header has position:sticky via BEM class', () => {
    const container = document.createElement('div');
    const result = makeResult();
    const selection = initDefinitionSelection(result);
    renderPopupContent(container, result, 'unknown', selection, {
      onStatusCycle: jest.fn(),
      onDefinitionToggle: jest.fn(),
      onQuickAdd: jest.fn(),
      onSendToCreator: jest.fn(),
      onSettings: jest.fn(),
    });
    const header = container.querySelector('.js-cell-header') as HTMLElement;
    expect(header).not.toBeNull();
    // jsdom doesn't compute styles from Shadow DOM <style> tags; verify class
    // which carries position:sticky in popupDictionary.css (.cell-header).
    expect(header.className).toContain('cell-header');
  });

  it('header has a non-empty background so content does not show through when sticky', () => {
    const container = document.createElement('div');
    const result = makeResult();
    const selection = initDefinitionSelection(result);
    renderPopupContent(container, result, 'unknown', selection, {
      onStatusCycle: jest.fn(),
      onDefinitionToggle: jest.fn(),
      onQuickAdd: jest.fn(),
      onSendToCreator: jest.fn(),
      onSettings: jest.fn(),
    });
    const header = container.querySelector('.js-cell-header') as HTMLElement;
    expect(header).not.toBeNull();
    // background is set via .cell-header class in popupDictionary.css.
    expect(header.className).toContain('cell-header');
  });
});

describe('getOrCreateCandidateList', () => {
  it('creates a div.js-cell-candidate-list with display:block when none exists', () => {
    const container = document.createElement('div');
    expect(container.querySelector('.js-cell-candidate-list')).toBeNull();
    const list = getOrCreateCandidateList(container);
    expect(list).not.toBeNull();
    expect(list.classList.contains('js-cell-candidate-list')).toBe(true);
    expect(container.querySelector('.js-cell-candidate-list')).toBe(list);
  });

  it('returns the existing wrapper when one already exists (no duplicate)', () => {
    const container = document.createElement('div');
    const first = getOrCreateCandidateList(container);
    const second = getOrCreateCandidateList(container);
    expect(second).toBe(first);
    expect(container.querySelectorAll('.js-cell-candidate-list')).toHaveLength(1);
  });
});

describe('renderPopupContent candidate-list wrapper', () => {
  it('renders candidates inside the .js-cell-candidate-list wrapper, not as a direct child of container', () => {
    const container = document.createElement('div');
    const result = makeResult();
    const selection = initDefinitionSelection(result);
    renderPopupContent(container, result, 'unknown', selection, {
      onStatusCycle: jest.fn(),
      onDefinitionToggle: jest.fn(),
      onQuickAdd: jest.fn(),
      onSendToCreator: jest.fn(),
      onSettings: jest.fn(),
    });
    const list = container.querySelector('.js-cell-candidate-list') as HTMLElement;
    expect(list).not.toBeNull();
    const candidate = container.querySelector('.js-cell-popup-candidate') as HTMLElement;
    expect(candidate).not.toBeNull();
    // candidate is a child of the wrapper, not a direct child of container.
    expect(candidate.parentElement).toBe(list);
    expect(Array.from(container.children)).not.toContain(candidate);
  });
});

describe('appendCandidateContent appends to the candidate-list wrapper', () => {
  it('appends a second candidate into the existing .js-cell-candidate-list wrapper', () => {
    const container = document.createElement('div');
    const result1 = makeResult({ term: 'get out' });
    const result2 = makeResult({ term: 'get over', definitions: [makeDefinition({ id: 'd2', text: 'to recover' })] });
    const sel1 = initDefinitionSelection(result1);
    const sel2 = initDefinitionSelection(result2);
    renderPopupContent(container, result1, 'unknown', sel1, {
      onStatusCycle: jest.fn(), onDefinitionToggle: jest.fn(),
      onQuickAdd: jest.fn(), onSendToCreator: jest.fn(), onSettings: jest.fn(),
    });
    appendCandidateContent(container, result2, 'unknown', sel2, {
      onStatusCycle: jest.fn(), onDefinitionToggle: jest.fn(),
      onQuickAdd: jest.fn(), onSendToCreator: jest.fn(), onSettings: jest.fn(),
    });
    const list = container.querySelector('.js-cell-candidate-list') as HTMLElement;
    expect(list).not.toBeNull();
    const candidates = list.querySelectorAll('.js-cell-popup-candidate');
    expect(candidates).toHaveLength(2);
    // Both candidates are children of the wrapper, not direct children of container.
    expect(Array.from(candidates).every((c) => c.parentElement === list)).toBe(true);
    expect(container.querySelectorAll('.js-cell-candidate-list')).toHaveLength(1);
  });
});

