import {
  resolvePlayerModeHostStyles,
  resolvePlayerModeVideoStyles,
} from '../logic/playerModeGeometry';

type StyleMap = Readonly<Record<string, string>>;

interface StyleSnapshotEntry {
  readonly property: string;
  readonly value: string;
  readonly priority: string;
}

interface StyleSnapshot {
  readonly element: HTMLElement;
  readonly entries: readonly StyleSnapshotEntry[];
}

export interface PlayerModeHostController {
  readonly update: (videoStageHeight: number) => void;
  readonly restore: () => void;
}

function snapshotStyle(element: HTMLElement, styles: StyleMap): StyleSnapshot {
  return {
    element,
    entries: Object.keys(styles).map((property) => ({
      property,
      value: element.style.getPropertyValue(property),
      priority: element.style.getPropertyPriority(property),
    })),
  };
}

function applyStyle(element: HTMLElement, styles: StyleMap): void {
  for (const [property, value] of Object.entries(styles)) {
    element.style.setProperty(property, value, 'important');
  }
}

function restoreStyle(snapshot: StyleSnapshot): void {
  for (const entry of snapshot.entries) {
    if (entry.value === '') {
      snapshot.element.style.removeProperty(entry.property);
    } else {
      snapshot.element.style.setProperty(entry.property, entry.value, entry.priority);
    }
  }
}

/**
 * Temporarily aligns the detected host player to the top of the viewport.
 * Inline styles and priorities are restored exactly when Player Mode exits.
 */
export function createPlayerModeHostController(
  video: HTMLVideoElement,
  container: HTMLElement,
): PlayerModeHostController {
  const hostStyles = resolvePlayerModeHostStyles(0);
  const videoStyles = resolvePlayerModeVideoStyles();
  const hostSnapshot = snapshotStyle(container, hostStyles);
  const videoSnapshot = snapshotStyle(video, videoStyles);
  let restored = false;

  return {
    update(videoStageHeight: number): void {
      if (restored) return;
      applyStyle(container, resolvePlayerModeHostStyles(videoStageHeight));
      applyStyle(video, videoStyles);
    },
    restore(): void {
      if (restored) return;
      restored = true;
      restoreStyle(videoSnapshot);
      restoreStyle(hostSnapshot);
    },
  };
}
