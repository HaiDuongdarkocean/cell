import { loadOrbitalBadgePosition, saveOrbitalBadgePosition } from './orbitalBadgeStore';
import { getStorage, setStorage } from '@/shared/lib/chrome-apis';

jest.mock('@/shared/lib/chrome-apis', () => ({
  getStorage: jest.fn(),
  setStorage: jest.fn(),
}));

describe('orbitalBadgeStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns undefined when nothing stored', async () => {
    (getStorage as jest.Mock).mockResolvedValue({});
    const pos = await loadOrbitalBadgePosition();
    expect(pos).toBeUndefined();
  });

  it('returns stored position merged with defaults', async () => {
    const stored = { x: 100, y: 200, edge: 'left' as const, preset: 'top' as const };
    (getStorage as jest.Mock).mockResolvedValue({ orbitalBadgePosition: stored });
    const pos = await loadOrbitalBadgePosition();
    expect(pos).toEqual({ x: 100, y: 200, edge: 'left', preset: 'top' });
  });

  it('saves position to storage', async () => {
    const position = { x: 50, y: 60, edge: 'bottom' as const, preset: 'right' as const };
    await saveOrbitalBadgePosition(position);
    expect(setStorage).toHaveBeenCalledWith({ orbitalBadgePosition: position });
  });
});
