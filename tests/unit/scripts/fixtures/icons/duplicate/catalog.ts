import duplicateASvg from './svg/duplicate-a.svg?raw';
import duplicateBSvg from './svg/duplicate-b.svg?raw';

export const ICON_CATALOG = {
  duplicateA: { svg: duplicateASvg, source: 'lucide/duplicate-a', tags: ['duplicate'] },
  duplicateB: { svg: duplicateBSvg, source: 'lucide/duplicate-b', tags: ['duplicate'] },
} as const;
