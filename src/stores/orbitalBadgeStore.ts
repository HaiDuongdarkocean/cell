import { getStorage, setStorage } from '@/shared/lib/chrome-apis';
import type { PointerPreset } from '@/features/dictionaryPopup/badgePointer/pointerPosition';

export type OrbitalBadgeEdge = 'left' | 'right' | 'top' | 'bottom';

export interface OrbitalBadgePosition {
  x: number;
  y: number;
  edge: OrbitalBadgeEdge;
  preset: PointerPreset;
}

const STORAGE_KEY = 'orbitalBadgePosition';

const DEFAULT_POSITION: OrbitalBadgePosition = {
  x: 0,
  y: 0,
  edge: 'right',
  preset: 'center',
};

export async function loadOrbitalBadgePosition(): Promise<OrbitalBadgePosition | undefined> {
  const stored = await getStorage<Record<string, OrbitalBadgePosition | undefined>>(STORAGE_KEY);
  const position = stored[STORAGE_KEY];
  if (!position) return undefined;
  return {
    ...DEFAULT_POSITION,
    ...position,
  };
}

export async function saveOrbitalBadgePosition(position: OrbitalBadgePosition): Promise<void> {
  await setStorage({ [STORAGE_KEY]: position });
}
