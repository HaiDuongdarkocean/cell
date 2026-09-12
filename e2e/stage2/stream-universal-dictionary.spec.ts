import { test, expect } from '../fixtures/actors/universalPanel.fixture';

test.describe('Stage 2: Universal Panel > Dictionary on StreamFlix', () => {
  test('opens Dictionary via the orbital badge', async ({ universalPanel, streamFlixPage }, testInfo) => {
    await universalPanel.open();
    await universalPanel.openTab('dictionary');
    await universalPanel.search('exclamation');
    await streamFlixPage.waitForTimeout(1500);

    await streamFlixPage.screenshot({ path: testInfo.outputPath('stream-universal-desktop-dictionary.png') });
  });

  test('mobile panel shows collapsed Card Creator sheet with only the pill', async ({ universalPanel, streamFlixPage }, testInfo) => {
    await streamFlixPage.setViewportSize({ width: 390, height: 844 });

    await universalPanel.open();
    const sheetBounds = await universalPanel.getCardCreatorSheetBounds();

    if (sheetBounds) {
      // Collapsed peek should expose the pill only (< 40px), not Card Creator fields.
      expect(sheetBounds.height).toBeLessThanOrEqual(40);
    }

    await streamFlixPage.screenshot({ path: testInfo.outputPath('stream-universal-mobile-sheet.png') });
  });
});
