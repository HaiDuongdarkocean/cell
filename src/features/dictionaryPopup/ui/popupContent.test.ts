// popupContent tests — spec §4.6.3 A4/A9, §9: header + definitions + footer.

import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import {
  renderHeader,
  renderDefinitions,
  renderFooter,
  renderPopupContent,
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
    const term = container.querySelector('[data-dp-term]');
    expect(term?.textContent).toBe('take off');
    const reading = container.querySelector('[data-dp-reading]');
    expect(reading?.textContent).toBe('/teɪk ɒf/');
  });

  it('renders frequency badge when present', () => {
    const result = makeResult();
    callHeader(result, 'unknown');
    const freq = container.querySelector('[data-dp-frequency]');
    expect(freq?.textContent).toBe('#1234');
  });

  it('does not render frequency badge when null', () => {
    const result = makeResult({ frequency: null });
    callHeader(result, 'unknown');
    expect(container.querySelector('[data-dp-frequency]')).toBeNull();
  });

  it('renders status badge with current status', () => {
    const result = makeResult();
    callHeader(result, 'tracking');
    const status = container.querySelector('[data-dp-status]');
    expect(status?.textContent).toBe('tracking');
  });

  it('status badge click triggers onStatusCycle', () => {
    const onCycle = jest.fn();
    const result = makeResult();
    callHeader(result, 'unknown', onCycle);
    const badge = container.querySelector('[data-dp-status]') as HTMLButtonElement;
    badge.click();
    expect(onCycle).toHaveBeenCalledTimes(1);
  });

  it('does not render reading when empty', () => {
    const result = makeResult({ reading: '' });
    callHeader(result, 'unknown');
    expect(container.querySelector('[data-dp-reading]')).toBeNull();
  });

  it('renders Settings, Send to Card, and Quick Add buttons', () => {
    const result = makeResult();
    callHeader(result, 'unknown');
    expect(container.querySelector('[data-dp-settings]')).not.toBeNull();
    expect(container.querySelector('[data-dp-send-to-creator]')).not.toBeNull();
    expect(container.querySelector('[data-dp-quick-add]')).not.toBeNull();
  });

  it('Settings button click triggers onSettings', () => {
    const onSettings = jest.fn();
    renderHeader(container, makeResult(), 'unknown', jest.fn(), jest.fn(), jest.fn(), onSettings);
    const btn = container.querySelector('[data-dp-settings]') as HTMLButtonElement;
    btn.click();
    expect(onSettings).toHaveBeenCalledTimes(1);
  });

  it('Send to Card button click triggers onSendToCreator', () => {
    const onSend = jest.fn();
    renderHeader(container, makeResult(), 'unknown', jest.fn(), jest.fn(), onSend, jest.fn());
    const btn = container.querySelector('[data-dp-send-to-creator]') as HTMLButtonElement;
    btn.click();
    expect(onSend).toHaveBeenCalledTimes(1);
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
    const checkboxes = container.querySelectorAll('[data-dp-def-checkbox]');
    expect(checkboxes.length).toBe(2);
    expect((checkboxes[0] as HTMLInputElement).checked).toBe(true);
  });

  it('renders pos label', () => {
    const result = makeResult();
    renderDefinitions(container, result, new Map(), jest.fn());
    const pos = container.querySelector('[data-dp-pos]');
    expect(pos?.textContent).toBe('verb. ');
  });

  it('renders examples', () => {
    const result = makeResult();
    renderDefinitions(container, result, new Map(), jest.fn());
    const examples = container.querySelectorAll('[data-dp-definitions] div > div > div > div');
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
    const checkbox = container.querySelector('[data-dp-def-checkbox]') as HTMLInputElement;
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change'));
    expect(onToggle).toHaveBeenCalledWith('d1', false);
  });

  it('respects selection map over defaultSelected', () => {
    const result = makeResult();
    const selection = new Map([['d1', false]]);
    renderDefinitions(container, result, selection, jest.fn());
    const checkbox = container.querySelector('[data-dp-def-checkbox]') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
  });
});

describe('renderFooter', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
  });

  it('renders status button with current status', () => {
    renderFooter(container, 'tracking', jest.fn(), jest.fn());
    const status = container.querySelector('[data-dp-footer-status]');
    expect(status?.textContent).toBe('tracking');
  });

  it('renders Quick Add button', () => {
    renderFooter(container, 'unknown', jest.fn(), jest.fn());
    const quickAdd = container.querySelector('[data-dp-quick-add]');
    expect(quickAdd?.textContent).toContain('Quick Add');
  });

  it('status button click triggers onStatusCycle', () => {
    const onCycle = jest.fn();
    renderFooter(container, 'unknown', onCycle, jest.fn());
    const btn = container.querySelector('[data-dp-footer-status]') as HTMLButtonElement;
    btn.click();
    expect(onCycle).toHaveBeenCalledTimes(1);
  });

  it('Quick Add button click triggers onQuickAdd', () => {
    const onQuickAdd = jest.fn();
    renderFooter(container, 'unknown', jest.fn(), onQuickAdd);
    const btn = container.querySelector('[data-dp-quick-add]') as HTMLButtonElement;
    btn.click();
    expect(onQuickAdd).toHaveBeenCalledTimes(1);
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
    expect(container.querySelector('[data-dp-header]')).not.toBeNull();
    expect(container.querySelector('[data-dp-definitions]')).not.toBeNull();
    // Quick Add moved into header (no separate footer).
    expect(container.querySelector('[data-dp-quick-add]')).not.toBeNull();
    expect(container.querySelector('[data-dp-settings]')).not.toBeNull();
    expect(container.querySelector('[data-dp-send-to-creator]')).not.toBeNull();
  });
});

