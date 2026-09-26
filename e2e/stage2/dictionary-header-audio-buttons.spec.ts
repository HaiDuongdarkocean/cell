import { test, expect } from '../fixtures/actors/universalPanel.fixture';

/**
 * Contract:
 *   Given: StreamFlix loaded, Universal Panel open, dictionary searched
 *   Then:  the candidate header renders NO speak buttons — word/sentence
 *          playback lives in the audio tab, not beside the reading row.
 */
test.describe('Stage 2: Universal Panel > Dictionary header audio buttons', () => {
  test('candidate reading row has no dictionary-play-* buttons', async ({ universalPanel, streamFlixPage }) => {
    await universalPanel.open();
    await universalPanel.openTab('dictionary');
    await universalPanel.search('exclamation');

    const candidateReady = await streamFlixPage.evaluate(
      (maxWait) =>
        new Promise<boolean>((resolve) => {
          const start = Date.now();
          const tick = (): void => {
            const root = document.getElementById('cell-universal-panel-host')?.shadowRoot;
            if (root?.querySelector('[data-cell-id="dictionary-content"]')) {
              resolve(true);
              return;
            }
            if (Date.now() - start > maxWait) return resolve(false);
            setTimeout(tick, 100);
          };
          tick();
        }),
      20_000,
    );
    expect(candidateReady).toBe(true);

    const leftovers = await streamFlixPage.evaluate(() => {
      const root = document.getElementById('cell-universal-panel-host')?.shadowRoot;
      const content = root?.querySelector('[data-cell-id="dictionary-content"]');
      if (!content) return ['<candidate missing>'];
      return [...content.querySelectorAll('[data-cell-id^="dictionary-play-"]')].map(
        (el) => el.getAttribute('data-cell-id'),
      );
    });
    expect(leftovers).toEqual([]);
  });
});
