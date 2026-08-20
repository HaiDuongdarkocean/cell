import {
  shouldPromptResume,
  formatPosition,
  createResumePositionService,
  createThrottledSaver,
  type ResumePositionRepository,
} from './useResumePosition';

import scenarios from '../../../../tests/data-test/local-player/samples/library-metadata/resume-scenarios.json';

type Scenario = {
  scenario: string;
  savedPositionMs: number;
  videoDurationMs: number;
  shouldPrompt: boolean;
  expectedPromptText?: string;
};

const typedScenarios = scenarios as Scenario[];

/* ── Mock repository factory (T9 not implemented yet) ───────────── */

type MockRepo = ResumePositionRepository & {
  updateResumePosition: jest.Mock;
  getVideo: jest.Mock;
};

function createMockRepo(): MockRepo {
  const videos = new Map<
    string,
    { resumePositionMs: number | null; durationMs: number | null }
  >();
  return {
    updateResumePosition: jest.fn(async (videoId: string, positionMs: number) => {
      videos.set(videoId, { resumePositionMs: positionMs, durationMs: null });
    }),
    getVideo: jest.fn(async (videoId: string) => videos.get(videoId) ?? null),
  };
}

/* ── Pure: shouldPromptResume — all 12 scenarios ────────────────── */

describe('shouldPromptResume — resume-scenarios.json (12 scenarios)', () => {
  it.each(typedScenarios.map((s) => [s.scenario, s] as const))(
    '%s',
    (_name, s: Scenario) => {
      expect(shouldPromptResume(s.savedPositionMs, s.videoDurationMs)).toBe(
        s.shouldPrompt,
      );
    },
  );
});

/* ── Pure: formatPosition — prompt text for scenarios with expectedPromptText ─ */

describe('formatPosition — prompt text matches expected', () => {
  const promptScenarios = typedScenarios.filter(
    (s) => s.expectedPromptText !== undefined,
  );
  it.each(promptScenarios.map((s) => [s.scenario, s] as const))(
    '%s',
    (_name, s: Scenario) => {
      const text = `Continue from ${formatPosition(s.savedPositionMs)}?`;
      expect(text).toBe(s.expectedPromptText);
    },
  );
});

/* ── saveResumePosition → calls repository.updateResumePosition ──── */

describe('saveResumePosition', () => {
  it('calls repository.updateResumePosition with videoId + positionMs', async () => {
    const repo = createMockRepo();
    const { saveResumePosition } = createResumePositionService(repo);
    await saveResumePosition('video-1', 120000);
    expect(repo.updateResumePosition).toHaveBeenCalledWith('video-1', 120000);
  });
});

/* ── getResumePosition → returns saved position or null ──────────── */

describe('getResumePosition', () => {
  it('returns 120000 from repository when position saved', async () => {
    const repo = createMockRepo();
    await repo.updateResumePosition('video-1', 120000);
    const { getResumePosition } = createResumePositionService(repo);
    const result = await getResumePosition('video-1');
    expect(result).toBe(120000);
  });

  it('returns null if no saved position', async () => {
    const repo = createMockRepo();
    const { getResumePosition } = createResumePositionService(repo);
    const result = await getResumePosition('nonexistent');
    expect(result).toBeNull();
  });
});

/* ── promptResume → dialog with formatted text when shouldPrompt ─── */

describe('promptResume', () => {
  it('shows dialog "Continue from 2:00?" and returns true when user accepts', async () => {
    const repo = createMockRepo();
    await repo.updateResumePosition('video-1', 120000);
    const showDialog = jest.fn(async (_text: string) => true);
    const { promptResume } = createResumePositionService(repo);
    const result = await promptResume('video-1', 3600000, showDialog);
    expect(result).toBe(true);
    expect(showDialog).toHaveBeenCalledWith('Continue from 2:00?');
  });

  it('returns false without dialog when position < 10s', async () => {
    const repo = createMockRepo();
    await repo.updateResumePosition('video-1', 5000);
    const showDialog = jest.fn(async () => true);
    const { promptResume } = createResumePositionService(repo);
    const result = await promptResume('video-1', 3600000, showDialog);
    expect(result).toBe(false);
    expect(showDialog).not.toHaveBeenCalled();
  });

  it('returns false without dialog when no saved position', async () => {
    const repo = createMockRepo();
    const showDialog = jest.fn(async () => true);
    const { promptResume } = createResumePositionService(repo);
    const result = await promptResume('nonexistent', 3600000, showDialog);
    expect(result).toBe(false);
    expect(showDialog).not.toHaveBeenCalled();
  });
});

/* ── Throttle: save every 5s, not every call ─────────────────────── */

describe('createThrottledSaver — throttle', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('does NOT save on every call — only after 5s interval with last position', async () => {
    const repo = createMockRepo();
    const { save } = createThrottledSaver(repo, 'video-1', 5000);

    // 5 rapid calls within the interval
    save(1000);
    save(2000);
    save(3000);
    save(4000);
    save(5000);

    // No save yet — interval not elapsed
    expect(repo.updateResumePosition).not.toHaveBeenCalled();

    // Advance 5s → single save with the LAST position
    await jest.advanceTimersByTimeAsync(5000);
    expect(repo.updateResumePosition).toHaveBeenCalledTimes(1);
    expect(repo.updateResumePosition).toHaveBeenCalledWith('video-1', 5000);
  });

  it('flush saves pending position immediately (for pause/unload)', async () => {
    const repo = createMockRepo();
    const { save, flush } = createThrottledSaver(repo, 'video-1', 5000);

    save(42000);
    expect(repo.updateResumePosition).not.toHaveBeenCalled();

    await flush();
    expect(repo.updateResumePosition).toHaveBeenCalledWith('video-1', 42000);
  });

  it('does not double-save when flush called after timer already fired', async () => {
    const repo = createMockRepo();
    const { save, flush } = createThrottledSaver(repo, 'video-1', 5000);

    save(10000);
    await jest.advanceTimersByTimeAsync(5000);
    expect(repo.updateResumePosition).toHaveBeenCalledTimes(1);

    // Nothing pending → flush is a no-op
    await flush();
    expect(repo.updateResumePosition).toHaveBeenCalledTimes(1);
  });
});
