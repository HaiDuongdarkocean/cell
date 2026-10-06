import type { BilingualCue } from '@/entities/media';
import type { OverlayStyleConfig } from '@/entities/subtitle';

export const MOCK_CUES: BilingualCue[] = [
  {
    index: 0,
    start: 330000,
    end: 339000,
    targetText: 'When it comes to techwear essentials',
    nativeText: 'Khi nói đến những món đồ techwear thiết yếu',
  },
  {
    index: 1,
    start: 340000,
    end: 349000,
    targetText: 'you might picture a black waterproof jacket',
    nativeText: 'bạn có thể hình dung một chiếc áo khoác đen chống nước',
  },
  {
    index: 2,
    start: 350000,
    end: 359000,
    targetText: 't-shirt, blue jeans, and combat boots',
    nativeText: 'áo phông, quần jeans xanh và giày combat boots',
  },
  {
    index: 3,
    start: 360000,
    end: 369000,
    targetText: 'but what about the bag you carry every day?',
    nativeText: 'nhưng còn chiếc túi bạn mang theo mỗi ngày thì sao?',
  },
  {
    index: 4,
    start: 370000,
    end: 379000,
    targetText: 'A good sling bag keeps your hands free',
    nativeText: 'Một chiếc túi đeo chéo tốt giúp bạn rảnh tay',
  },
];

export const MOCK_TARGET_STYLE: OverlayStyleConfig = {
  fontSize: 24,
  textColor: '#FFFFFF',
  backgroundColor: '#000000',
  backgroundOpacity: 0.7,
  textOpacity: 1,
  textShadow: { preset: 'soft', color: '#000000', blur: 2, offsetX: 1, offsetY: 1 },
  fontFamily: 'sans-serif',
  fontWeight: 600,
  horizontalAlign: 'center',
  visible: true,
};

export const MOCK_NATIVE_STYLE: OverlayStyleConfig = {
  ...MOCK_TARGET_STYLE,
  fontSize: 20,
};

export function fmtCueTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}
