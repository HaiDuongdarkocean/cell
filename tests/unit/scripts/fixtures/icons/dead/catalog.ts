import goodSvg from './svg/good.svg?raw';
import ghostSvg from './svg/ghost.svg?raw';

export const ICON_CATALOG = {
  good: { svg: goodSvg, source: 'lucide/good', tags: ['good', 'ok'] },
  ghost: { svg: ghostSvg, source: 'lucide/ghost', tags: ['ghost'] },
} as const;
