import type { UniversalPanelMountController } from './UniversalPanelController';

/** How long to wait for the settings tab to finish its async settings load. */
const NAV_ITEM_WAIT_MS = 3000;
const POLL_MS = 120;

/**
 * openSettingsSection — opens the universal panel on the Settings tab and
 * activates a specific sidebar section (e.g. 'resources').
 *
 * The settings tab loads settings asynchronously before rendering its
 * Navigation, so we poll the panel's shadow hosts for the nav item and let
 * Navigation's own click handler do the smooth scroll + scroll-spy update.
 */
export async function openSettingsSection(
  controller: UniversalPanelMountController | undefined,
  sectionId: string,
): Promise<void> {
  if (!controller) return;
  await controller.open('settings');

  const deadline = Date.now() + NAV_ITEM_WAIT_MS;
  while (Date.now() < deadline) {
    for (const host of controller.getHosts()) {
      // Shadow mount keeps content in host.shadowRoot; the legacy light-DOM
      // mount renders directly into the host.
      const root: ParentNode = host.shadowRoot ?? host;
      const item = root.querySelector(`[data-section-id="${sectionId}"]`);
      if (item instanceof HTMLElement) {
        item.click();
        return;
      }
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}
