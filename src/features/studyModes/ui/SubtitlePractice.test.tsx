import { render, screen, fireEvent } from '@testing-library/react';
import { PracticeOptions, SubtitlePracticeSession } from './SubtitlePractice';
import { createClozeExercise } from '../lib/subtitlePractice';
import type { BilingualCue } from '@/entities/media';

const cues: BilingualCue[] = [
  { index: 5, start: 42000, end: 47000, targetText: 'AT THE END OF EVERY ROAD', nativeText: 'native 5' },
  { index: 6, start: 47233, end: 49133, targetText: 'YOU WERE GOOD TO ME', nativeText: 'native 6' },
  { index: 7, start: 51633, end: 55500, targetText: 'YOU WERE GOOD TO ME, YEAH', nativeText: 'native 7' },
  { index: 8, start: 56000, end: 60000, targetText: 'FAR AWAY NOW', nativeText: 'native 8' },
];

const noop = (): void => undefined;

function renderOptions(overrides: Partial<Parameters<typeof PracticeOptions>[0]> = {}) {
  const props = {
    mode: 'off' as const,
    translationEnabled: false,
    playbackSpeed: 1 as const,
    onModeChange: noop,
    onTranslationChange: noop,
    onPlaybackSpeedChange: noop,
    ...overrides,
  };
  return { props, ...render(<PracticeOptions {...props} />) };
}

function renderSession(overrides: Partial<Parameters<typeof SubtitlePracticeSession>[0]> = {}) {
  const props = {
    mode: 'dictation' as const,
    cues,
    currentTimeMs: 48000,
    translationEnabled: false,
    isPlaying: false,
    onSeek: jest.fn(),
    onPrevious: jest.fn(),
    onReplay: jest.fn(),
    onContinue: jest.fn(),
    onPlayPause: jest.fn(),
    ...overrides,
  };
  const utils = render(<SubtitlePracticeSession {...props} />);
  return { props, ...utils };
}

describe('PracticeOptions', () => {
  it('renders one exclusive radiogroup with Off, Dictation, Cloze', () => {
    renderOptions({ mode: 'dictation' });
    const group = screen.getByRole('radiogroup', { name: 'Practice mode' });
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
    expect(group.contains(radios[0])).toBe(true);
    expect(screen.getByTestId('practice-mode-off').getAttribute('aria-checked')).toBe('false');
    expect(screen.getByTestId('practice-mode-dictation').getAttribute('aria-checked')).toBe('true');
    expect(screen.getByTestId('practice-mode-cloze').getAttribute('aria-checked')).toBe('false');
    expect(screen.queryByRole('switch', { name: 'Dictation' })).toBeNull();
    expect(screen.queryByRole('switch', { name: 'Cloze' })).toBeNull();
  });

  it('calls onModeChange with the clicked segment', () => {
    const onModeChange = jest.fn();
    renderOptions({ mode: 'off', onModeChange });
    fireEvent.click(screen.getByTestId('practice-mode-dictation'));
    expect(onModeChange).toHaveBeenCalledWith('dictation');
    fireEvent.click(screen.getByTestId('practice-mode-cloze'));
    expect(onModeChange).toHaveBeenCalledWith('cloze');
    fireEvent.click(screen.getByTestId('practice-mode-off'));
    expect(onModeChange).toHaveBeenCalledWith('off');
  });

  it('exposes Auto-translate switch and Speed select', () => {
    const onTranslationChange = jest.fn();
    const onPlaybackSpeedChange = jest.fn();
    renderOptions({ onTranslationChange, onPlaybackSpeedChange });
    const toggle = screen.getByRole('switch', { name: 'Auto-translate' });
    expect(screen.getByTestId('practice-translation')).toBe(toggle);
    fireEvent.click(toggle);
    expect(onTranslationChange).toHaveBeenCalledWith(true);
    const speed = screen.getByTestId('practice-speed');
    fireEvent.click(speed.querySelector('button')!);
    fireEvent.click(screen.getByRole('option', { name: '1.5x' }));
    expect(onPlaybackSpeedChange).toHaveBeenCalledWith(1.5);
  });
});

describe('SubtitlePracticeSession — layout', () => {
  it('keeps the single input inside the footer and never inside a cue item', () => {
    renderSession();
    const footer = screen.getByTestId('practice-footer');
    const input = screen.getByTestId('practice-input');
    expect(footer.contains(input)).toBe(true);
    for (const item of screen.getAllByTestId('cue-item')) {
      expect(item.querySelector('input')).toBeNull();
    }
    expect(document.querySelectorAll('[data-cell-id="practice-input"]')).toHaveLength(1);
  });

  it('renders navigation buttons and a shortcut legend', () => {
    renderSession();
    expect(screen.getByTestId('practice-previous')).toBeTruthy();
    expect(screen.getByTestId('practice-replay')).toBeTruthy();
    expect(screen.getByTestId('practice-next')).toBeTruthy();
    expect(screen.getByTestId('practice-shortcuts').textContent).toContain('Replay');
  });

  it('masks every inactive cue target in dictation mode', () => {
    renderSession();
    const masked = screen.getAllByTestId('cue-masked-target');
    expect(masked.length).toBe(3);
    expect(screen.queryByText('AT THE END OF EVERY ROAD')).toBeNull();
    expect(screen.queryByText('FAR AWAY NOW')).toBeNull();
    for (const item of screen.getAllByTestId('cue-item')) {
      expect(item.querySelector('[data-cell-id="cue-timestamp"]')).toBeTruthy();
    }
  });

  it('disables footer input when no cue is active', () => {
    renderSession({ currentTimeMs: 40000 });
    const input = screen.getByTestId('practice-input') as HTMLInputElement;
    expect(input.disabled).toBe(true);
    expect(screen.queryByTestId('practice-active-cue')).toBeNull();
  });
});

describe('SubtitlePracticeSession — dictation', () => {
  it('hides the target text behind guides before typing', () => {
    renderSession();
    const active = screen.getByTestId('practice-active-cue');
    expect(active.textContent).not.toContain('YOU WERE GOOD TO ME');
    expect(active.querySelectorAll('[data-guide]')).toHaveLength(5);
  });

  it('shows live positional feedback while typing without Enter', () => {
    renderSession();
    const input = screen.getByTestId('practice-input');
    fireEvent.change(input, { target: { value: 'you are good to me extra' } });
    const feedback = screen.getByTestId('practice-feedback');
    expect(feedback.getAttribute('role')).toBe('status');
    expect(feedback.textContent).toContain('%');
    expect(feedback.querySelector('[data-state="incorrect"]')).toBeTruthy();
    expect(feedback.querySelector('[data-state="extra"]')).toBeTruthy();
  });

  it('shows 100% live feedback for a normalized-correct answer', () => {
    renderSession();
    const input = screen.getByTestId('practice-input');
    fireEvent.change(input, { target: { value: 'you were, good to me!' } });
    expect(screen.getByTestId('practice-feedback').textContent).toContain('100%');
  });

  it('hides native text unless translation is enabled', () => {
    const { props, rerender } = renderSession();
    expect(screen.queryByText('native 6')).toBeNull();
    rerender(<SubtitlePracticeSession {...props} translationEnabled />);
    expect(screen.getByText('native 6')).toBeTruthy();
    expect(screen.queryByText('native 8')).toBeNull();
  });

  it('Enter continues, Shift+Enter goes previous, buttons use explicit cue', () => {
    const { props } = renderSession();
    const input = screen.getByTestId('practice-input');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(props.onContinue).toHaveBeenCalledWith(cues[1]);
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(props.onPrevious).toHaveBeenCalledWith(cues[1]);
    fireEvent.click(screen.getByTestId('practice-replay'));
    expect(props.onReplay).toHaveBeenCalledWith(cues[1]);
    fireEvent.click(screen.getByTestId('practice-next'));
    expect(props.onContinue).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByTestId('practice-previous'));
    expect(props.onPrevious).toHaveBeenCalledTimes(2);
  });

  it('Ctrl+R replays and Shift+Space toggles play without typing', () => {
    const { props } = renderSession();
    const input = screen.getByTestId('practice-input');
    fireEvent.keyDown(input, { key: 'r', ctrlKey: true });
    expect(props.onReplay).toHaveBeenCalledWith(cues[1]);
    fireEvent.keyDown(input, { key: ' ', shiftKey: true });
    expect(props.onPlayPause).toHaveBeenCalled();
    expect((input as HTMLInputElement).value).toBe('');
  });

  it('resets draft and feedback on cue change', () => {
    const { props, rerender } = renderSession();
    const input = screen.getByTestId('practice-input');
    fireEvent.change(input, { target: { value: 'draft' } });
    expect(screen.getByTestId('practice-feedback')).toBeTruthy();
    rerender(<SubtitlePracticeSession {...props} currentTimeMs={52000} />);
    expect((screen.getByTestId('practice-input') as HTMLInputElement).value).toBe('');
    expect(screen.queryByTestId('practice-feedback')).toBeNull();
  });
});

describe('SubtitlePracticeSession — cloze', () => {
  it('renders source-position blanks in the active cue and one combined footer input', () => {
    renderSession({ mode: 'cloze' });
    const exercise = createClozeExercise(cues[1]);
    const active = screen.getByTestId('practice-active-cue');
    expect(active.querySelectorAll('[data-cell-id="cloze-blank"]')).toHaveLength(exercise.blanks.length);
    const input = screen.getByTestId('practice-input') as HTMLInputElement;
    const n = exercise.blanks.length;
    expect(input.getAttribute('aria-label')).toBe(`Type ${n} missing word${n === 1 ? '' : 's'}`);
    expect(input.maxLength).toBe(600);
  });

  it('maps typed tokens to blanks in source order with live state', () => {
    renderSession({ mode: 'cloze' });
    const exercise = createClozeExercise(cues[1]);
    const input = screen.getByTestId('practice-input');
    const answers = exercise.blanks.map((b) => b.answer).join(' ');
    fireEvent.change(input, { target: { value: answers.toLowerCase() } });
    const active = screen.getByTestId('practice-active-cue');
    const blanks = active.querySelectorAll('[data-cell-id="cloze-blank"]');
    expect(blanks).toHaveLength(exercise.blanks.length);
    for (const blank of blanks) {
      expect(blank.getAttribute('data-state')).toBe('correct');
    }
  });

  it('marks a wrong token incorrect at its source position', () => {
    renderSession({ mode: 'cloze' });
    const input = screen.getByTestId('practice-input');
    fireEvent.change(input, { target: { value: 'wrong' } });
    const blank = screen
      .getByTestId('practice-active-cue')
      .querySelector('[data-cell-id="cloze-blank"][data-state="incorrect"]');
    expect(blank).toBeTruthy();
    expect(blank?.textContent).toContain('wrong');
  });

  it('reports extra typed words in the live summary without adding cue rows', () => {
    renderSession({ mode: 'cloze' });
    const exercise = createClozeExercise(cues[1]);
    const input = screen.getByTestId('practice-input');
    const answers = exercise.blanks.map((b) => b.answer).join(' ');
    fireEvent.change(input, { target: { value: `${answers} unexpected extra` } });
    const feedback = screen.getByTestId('practice-feedback');
    expect(feedback.textContent).toContain('extra');
    const active = screen.getByTestId('practice-active-cue');
    expect(active.textContent).not.toContain('unexpected');
  });

  it('Enter always continues to the next cue', () => {
    const { props } = renderSession({ mode: 'cloze' });
    const input = screen.getByTestId('practice-input');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(props.onContinue).toHaveBeenCalledWith(cues[1]);
  });

  it('shows neutral prompts on adjacent cues and masks farther cues', () => {
    renderSession({ mode: 'cloze' });
    const items = screen.getAllByTestId('cue-item');
    expect(items[0].querySelector('[data-cell-id="cloze-prompt"]')).toBeTruthy();
    expect(items[0].querySelector('[data-cell-id="cue-target-text"]')).toBeNull();
    expect(items[0].textContent).not.toContain('AT THE END OF EVERY ROAD');
    expect(items[0].querySelector('[data-state="correct"]')).toBeNull();
    expect(items[2].querySelector('[data-cell-id="cloze-prompt"]')).toBeTruthy();
    expect(items[3].querySelector('[data-cell-id="cue-masked-target"]')).toBeTruthy();
    expect(items[3].textContent).not.toContain('FAR AWAY NOW');
  });

  it('shows unavailable state for punctuation-only cues', () => {
    const punctCues: BilingualCue[] = [
      { index: 1, start: 2066, end: 20166, targetText: '♪ ♪', nativeText: '' },
    ];
    renderSession({ mode: 'cloze', cues: punctCues, currentTimeMs: 5000 });
    expect(screen.getByText('No fillable words in this cue')).toBeTruthy();
    expect((screen.getByTestId('practice-input') as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByTestId('practice-next')).toBeTruthy();
  });

  it('resets the combined draft on cue change', () => {
    const { props, rerender } = renderSession({ mode: 'cloze' });
    const input = screen.getByTestId('practice-input');
    fireEvent.change(input, { target: { value: 'something' } });
    rerender(<SubtitlePracticeSession {...props} currentTimeMs={52000} />);
    expect((screen.getByTestId('practice-input') as HTMLInputElement).value).toBe('');
  });
});
