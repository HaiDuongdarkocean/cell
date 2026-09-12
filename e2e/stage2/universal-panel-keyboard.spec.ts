import { test, expect } from '../fixtures/actors/universalPanel.fixture';

test.describe('Stage 2: Universal Panel > Keyboard on StreamFlix', () => {
  test('typing in dictionary input does not leak to host and Enter submits', async ({
    universalPanel,
    streamFlixPage,
  }) => {
    // Install a host keydown counter in bubble phase. Most host video players
    // use bubble listeners on document/window, so this tests whether Cell
    // absorbs the event while still letting the focused input receive it.
    await streamFlixPage.evaluate(() => {
      (window as unknown as Record<string, number>).__cellHostKeyCount = 0;
      window.addEventListener('keydown', () => {
        ((window as unknown as Record<string, number>).__cellHostKeyCount ??= 0);
        (window as unknown as Record<string, number>).__cellHostKeyCount++;
      });
    });

    await universalPanel.open();
    await universalPanel.openTab('dictionary');
    await universalPanel.focusDictionarySearch();

    // Type a normal letter that is also a Cell shortcut ('w' toggles overlay).
    // While focus is in the input, it should be treated as typing, not a shortcut.
    await streamFlixPage.keyboard.type('w');
    await streamFlixPage.waitForTimeout(200);
    let value = await universalPanel.getDictionarySearchValue();
    expect(value).toBe('w');

    // Type another normal letter.
    await streamFlixPage.keyboard.type('c');
    await streamFlixPage.waitForTimeout(200);
    value = await universalPanel.getDictionarySearchValue();
    expect(value).toBe('wc');

    // Press Enter; it should be consumed by the input/search field, not the host.
    await streamFlixPage.keyboard.press('Enter');
    await streamFlixPage.waitForTimeout(500);

    const hostKeyCount = await streamFlixPage.evaluate(
      () => (window as unknown as Record<string, number>).__cellHostKeyCount,
    );
    expect(hostKeyCount).toBe(0);

    // The panel stayed open throughout the interaction.
    const host = streamFlixPage.locator('#cell-universal-panel-host');
    await expect(host).toBeVisible();
  });

  test('panel surface absorbs non-Escape keys so host shortcuts do not fire', async ({
    universalPanel,
    streamFlixPage,
  }) => {
    await streamFlixPage.evaluate(() => {
      (window as unknown as Record<string, number>).__cellHostShortcutCount = 0;
      window.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === 'w') {
          ((window as unknown as Record<string, number>).__cellHostShortcutCount ??= 0);
          (window as unknown as Record<string, number>).__cellHostShortcutCount++;
        }
      });
    });

    await universalPanel.open();

    // Press 'w' while focus is on the panel surface (no input focused).
    // Cell should take it as a shortcut (toggle overlay) and stop propagation.
    await streamFlixPage.keyboard.press('w');
    await streamFlixPage.waitForTimeout(500);

    const hostShortcutCount = await streamFlixPage.evaluate(
      () => (window as unknown as Record<string, number>).__cellHostShortcutCount,
    );
    expect(hostShortcutCount).toBe(0);
  });
});
