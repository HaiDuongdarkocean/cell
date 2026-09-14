import { describe, it, expect, afterEach } from '@jest/globals';
import {
  setActiveStudyMode,
  subscribeToStudyMode,
  getActiveStudyMode,
  applyStudyModeState,
} from './studyModeController';
import { PRESET_LOOKUP } from '@/entities/studyMode';
import type { StudyModeAdvancedSettings } from '@/entities/studyMode';

const ADVANCED: StudyModeAdvancedSettings = { skipNoDialogue: 'OFF', removeBracketed: false };

const listenMode = PRESET_LOOKUP.get('listen');
const dictationMode = PRESET_LOOKUP.get('dictation');
if (!listenMode || !dictationMode) throw new Error('presets missing');

describe('studyModeController', () => {
  const cleanups: (() => void)[] = [];

  afterEach(() => {
    cleanups.forEach((fn) => fn());
    cleanups.length = 0;
    setActiveStudyMode(null);
  });

  it('notifies once when the same mode is re-applied from parallel paths', () => {
    // Mode clicks dispatch through the runtime message AND the storage
    // onChanged listener — both land on setActiveStudyMode. Identical payloads
    // must collapse to a single apply so the player doesn't reset its step
    // state mid-flight.
    const cb = jest.fn();
    cleanups.push(subscribeToStudyMode(cb));

    const payload = { activeMode: listenMode, advanced: ADVANCED };
    setActiveStudyMode(payload);
    setActiveStudyMode({ ...payload });
    setActiveStudyMode({ activeMode: { ...listenMode }, advanced: { ...ADVANCED } });

    expect(cb).toHaveBeenCalledTimes(1);
    expect(getActiveStudyMode()?.activeMode.id).toBe('listen');
  });

  it('notifies again when the mode actually changes', () => {
    const cb = jest.fn();
    cleanups.push(subscribeToStudyMode(cb));

    setActiveStudyMode({ activeMode: listenMode, advanced: ADVANCED });
    setActiveStudyMode({ activeMode: dictationMode, advanced: ADVANCED });

    expect(cb).toHaveBeenCalledTimes(2);
    expect(cb).toHaveBeenLastCalledWith({ activeMode: dictationMode, advanced: ADVANCED });
  });

  it('notifies when only the advanced settings change', () => {
    const cb = jest.fn();
    cleanups.push(subscribeToStudyMode(cb));

    setActiveStudyMode({ activeMode: listenMode, advanced: ADVANCED });
    setActiveStudyMode({
      activeMode: listenMode,
      advanced: { skipNoDialogue: 'JUMP', removeBracketed: false },
    });

    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('applyStudyModeState resolves the preset and falls back to normal on unknown ids', () => {
    applyStudyModeState({
      version: 1,
      activeModeId: 'listen',
      customModes: [],
      advanced: ADVANCED,
    });
    expect(getActiveStudyMode()?.activeMode.id).toBe('listen');

    applyStudyModeState({
      version: 1,
      activeModeId: 'does-not-exist',
      customModes: [],
      advanced: ADVANCED,
    });
    expect(getActiveStudyMode()?.activeMode.id).toBe('normal');
  });
});
