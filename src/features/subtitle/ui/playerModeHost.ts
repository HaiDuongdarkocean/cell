// Player Mode host controller — canvas capture approach.
// Video stays in host container (no DOM move, no style changes).
// Overlay canvas draws video frames; overlay bg black covers host UI.
// This controller is a no-op placeholder for API compatibility.

export interface PlayerModeHostController {
  readonly update: (_videoStageHeight: number) => void;
  readonly restore: () => void;
}

export function createPlayerModeHostController(
  _video: HTMLVideoElement,
  _container: HTMLElement,
): PlayerModeHostController {
  let restored = false;
  return {
    update(): void {
      if (restored) return;
    },
    restore(): void {
      restored = true;
    },
  };
}
