import type { UniversalPanelController, UniversalPanelTab } from './types';

export function createUniversalPanelController(): UniversalPanelController {
  let open = false;

  return {
    open: (_tab?: UniversalPanelTab) => {
      open = true;
    },
    close: () => {
      open = false;
    },
    switchTab: (_tab: UniversalPanelTab) => {
      // placeholder — tab switching will be wired when the React shell lands
    },
    isOpen: () => open,
    unmount: () => {
      open = false;
    },
  };
}
