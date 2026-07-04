import { findCurrentLine } from '@/features/subtitle/logic/subtitleSync';

describe('findCurrentLine', () => {
  const mockLines = [
    { index: 0, start: 0, end: 900, text: 'Line 1' },
    { index: 1, start: 1000, end: 1900, text: 'Line 2' },
    { index: 2, start: 2000, end: 2900, text: 'Line 3' },
    { index: 3, start: 3000, end: 3900, text: 'Line 4' },
    { index: 4, start: 4000, end: 4900, text: 'Line 5' },
  ];

  it('should return index when currentTime is within a line', () => {
    expect(findCurrentLine(mockLines, 500)).toBe(0);
    expect(findCurrentLine(mockLines, 1500)).toBe(1);
    expect(findCurrentLine(mockLines, 2500)).toBe(2);
  });

  it('should return -1 when currentTime is in gap between lines', () => {
    expect(findCurrentLine(mockLines, 950)).toBe(-1);
    expect(findCurrentLine(mockLines, 1950)).toBe(-1);
  });

  it('should return -1 when currentTime is outside all lines', () => {
    expect(findCurrentLine(mockLines, -100)).toBe(-1);
    expect(findCurrentLine(mockLines, 6000)).toBe(-1);
  });

  it('should return -1 when lines array is empty', () => {
    expect(findCurrentLine([], 1000)).toBe(-1);
  });

  it('should handle edge case: currentTime equals line start', () => {
    expect(findCurrentLine(mockLines, 0)).toBe(0);
    expect(findCurrentLine(mockLines, 1000)).toBe(1);
  });

  it('should handle edge case: currentTime equals line end', () => {
    expect(findCurrentLine(mockLines, 900)).toBe(0);
    expect(findCurrentLine(mockLines, 4900)).toBe(4);
  });

  // === offsetMs param (ADR-019 Contract 3) ===
  it('should default offsetMs to 0 (backward-compat)', () => {
    expect(findCurrentLine(mockLines, 500)).toBe(0);
    expect(findCurrentLine(mockLines, 500, 0)).toBe(0);
  });

  it('should apply positive offset (sub muộn → search time tăng)', () => {
    // currentTime=500, offset=+500 → effective=1000 → line 1 (1000-1900)
    expect(findCurrentLine(mockLines, 500, 500)).toBe(1);
    // currentTime=0, offset=+2000 → effective=2000 → line 2
    expect(findCurrentLine(mockLines, 0, 2000)).toBe(2);
  });

  it('should apply negative offset (sub sớm → search time giảm)', () => {
    // currentTime=1500, offset=-500 → effective=1000 → line 1
    expect(findCurrentLine(mockLines, 1500, -500)).toBe(1);
    // currentTime=2500, offset=-2000 → effective=500 → line 0
    expect(findCurrentLine(mockLines, 2500, -2000)).toBe(0);
  });

  it('should return -1 when effective time is in gap', () => {
    // currentTime=450, offset=+500 → effective=950 → gap (900-1000)
    expect(findCurrentLine(mockLines, 450, 500)).toBe(-1);
  });

  it('should handle large offset ±5000ms', () => {
    // currentTime=0, offset=+5000 → effective=5000 → outside all lines
    expect(findCurrentLine(mockLines, 0, 5000)).toBe(-1);
    // currentTime=5000, offset=-5000 → effective=0 → line 0
    expect(findCurrentLine(mockLines, 5000, -5000)).toBe(0);
  });
});
