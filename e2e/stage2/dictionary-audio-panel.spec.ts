import { resolve } from 'node:path';
import { test, expect } from '../fixtures/actors/universalPanel.fixture';
import { getE2EAgentPaths } from '../lib/agent-paths';

/**
 * Contract:
 *   Given: StreamFlix loaded, Universal Panel open, dictionary searched,
 *          audio toolbar tab active
 *   Then:  each audio row is the checkable host (role=checkbox), the label
 *          is a plain <span> (not a <button>), the name/meta stack is
 *          centered in the space right of the play button, and clicking the
 *          play button does not toggle selection.
 */
test.describe('Stage 2: Universal Panel > Dictionary audio panel on StreamFlix', () => {
  test('audio row uses a plain centered span label on a checkbox host', async ({ universalPanel, streamFlixPage }, testInfo) => {
    await universalPanel.open();
    await universalPanel.openTab('dictionary');
    await universalPanel.search('exclamation');

    // Wait for the candidate view toolbar, then activate the audio tab.
    const audioTabReady = await streamFlixPage.evaluate(
      (maxWait) =>
        new Promise<boolean>((resolve) => {
          const start = Date.now();
          const tick = (): void => {
            const root = document.getElementById('cell-universal-panel-host')?.shadowRoot;
            const tab = root?.querySelector('[data-cell-id="dictionary-tab-audio"]') as HTMLElement | null;
            if (tab) {
              tab.click();
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
    expect(audioTabReady).toBe(true);

    const panelReady = await streamFlixPage.evaluate(
      (maxWait) =>
        new Promise<boolean>((resolve) => {
          const start = Date.now();
          const tick = (): void => {
            const root = document.getElementById('cell-universal-panel-host')?.shadowRoot;
            const panel = root?.querySelector('[data-cell-id="dictionary-audio-panel"]');
            const row = panel?.querySelector('[role="checkbox"]');
            if (row) return resolve(true);
            if (Date.now() - start > maxWait) return resolve(false);
            setTimeout(tick, 100);
          };
          tick();
        }),
      15_000,
    );
    expect(panelReady).toBe(true);

    // Structural assertions on the first audio row.
    const structure = await streamFlixPage.evaluate(() => {
      const root = document.getElementById('cell-universal-panel-host')?.shadowRoot;
      const panel = root?.querySelector('[data-cell-id="dictionary-audio-panel"]');
      const row = panel?.querySelector('[role="checkbox"]') as HTMLElement | null;
      if (!panel || !row) return null;

      const playBtn = row.querySelector('button[aria-label^="Play"]') as HTMLElement | null;
      const label = row.children[1] as HTMLElement | null;
      const nameEl = label?.children[0] as HTMLElement | null;

      const playRect = playBtn?.getBoundingClientRect();
      const labelRect = label?.getBoundingClientRect();
      const nameRect = nameEl?.getBoundingClientRect();

      return {
        rowRole: row.getAttribute('role'),
        rowChecked: row.getAttribute('aria-checked'),
        rowTabIndex: row.tabIndex,
        labelTag: label?.tagName ?? null,
        labelInsideButton: label?.closest('button') !== null,
        // Left alignment: the name text must start at the label's left edge,
        // i.e. right after the play button.
        nameLeftX: nameRect?.left ?? null,
        labelLeftX: labelRect?.left ?? null,
        playRightX: playRect?.right ?? null,
      };
    });

    expect(structure).not.toBeNull();
    expect(structure!.rowRole).toBe('checkbox');
    expect(structure!.rowTabIndex).toBe(0);
    expect(['true', 'false']).toContain(structure!.rowChecked);
    expect(structure!.labelTag).toBe('SPAN');
    expect(structure!.labelInsideButton).toBe(false);
    // Name text starts at the label's left edge, immediately right of the
    // play button (row gap is --space-1 = 4px).
    expect(Math.abs(structure!.nameLeftX! - structure!.labelLeftX!)).toBeLessThanOrEqual(1);
    expect(structure!.labelLeftX! - structure!.playRightX!).toBeLessThanOrEqual(8);

    await streamFlixPage.screenshot({ path: testInfo.outputPath('dictionary-audio-panel.png') });
    // Persistent evidence copy — testInfo.outputPath is cleaned on pass.
    // Playwright locators pierce open shadow roots, so this captures the
    // audio panel element itself, not the whole page.
    await streamFlixPage
      .locator('[data-cell-id="dictionary-audio-panel"]')
      .screenshot({ path: resolve(getE2EAgentPaths().agentRoot, 'dictionary-audio-panel.png') });

    // Behavior: clicking the row toggles aria-checked; clicking play does not.
    // Read via polling — React re-renders the attribute asynchronously.
    const checkedOf = (): Promise<string | null> =>
      streamFlixPage.evaluate(() => {
        const root = document.getElementById('cell-universal-panel-host')?.shadowRoot;
        return (
          root
            ?.querySelector('[data-cell-id="dictionary-audio-panel"] [role="checkbox"]')
            ?.getAttribute('aria-checked') ?? null
        );
      });

    const before = await checkedOf();
    expect(before).not.toBeNull();

    await streamFlixPage.evaluate(() => {
      const root = document.getElementById('cell-universal-panel-host')?.shadowRoot;
      (root?.querySelector('[data-cell-id="dictionary-audio-panel"] [role="checkbox"]') as HTMLElement | null)?.click();
    });
    await expect
      .poll(checkedOf, { timeout: 5_000 })
      .toBe(before === 'true' ? 'false' : 'true');
    const afterRowClick = await checkedOf();

    await streamFlixPage.evaluate(() => {
      const root = document.getElementById('cell-universal-panel-host')?.shadowRoot;
      const row = root?.querySelector('[data-cell-id="dictionary-audio-panel"] [role="checkbox"]');
      (row?.querySelector('button[aria-label^="Play"]') as HTMLElement | null)?.click();
    });
    await streamFlixPage.waitForTimeout(500);
    expect(await checkedOf()).toBe(afterRowClick);
  });
});
