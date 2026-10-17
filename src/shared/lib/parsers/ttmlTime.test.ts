import { parseTtmlTime } from './ttmlTime';

describe('parseTtmlTime', () => {
  const TICK = 10_000_000;
  const FPS = 30;

  it('parses tick expressions', () => {
    expect(parseTtmlTime('162245417t', TICK, FPS)).toBeCloseTo(16_224.5417);
    expect(parseTtmlTime('0t', TICK, FPS)).toBe(0);
  });

  it('parses frame expressions', () => {
    expect(parseTtmlTime('30f', TICK, FPS)).toBeCloseTo(1000);
    expect(parseTtmlTime('24f', TICK, 24)).toBeCloseTo(1000);
  });

  it('parses second expressions', () => {
    expect(parseTtmlTime('12.5s', TICK, FPS)).toBeCloseTo(12_500);
    expect(parseTtmlTime('0.75s', TICK, FPS)).toBeCloseTo(750);
  });

  it('parses clock expressions', () => {
    expect(parseTtmlTime('01:02:03', TICK, FPS)).toBe(3_723_000);
    expect(parseTtmlTime('00:00:05.250', TICK, FPS)).toBe(5_250);
    expect(parseTtmlTime('00:00:05.25', TICK, FPS)).toBe(5_250);
    expect(parseTtmlTime('00:00:05.2', TICK, FPS)).toBe(5_200);
  });

  it('scales 1-2 digit fractions as sub-second units', () => {
    expect(parseTtmlTime('00:00:05:15', TICK, FPS)).toBe(5_150);
    expect(parseTtmlTime('00:00:05.5', TICK, FPS)).toBe(5_500);
  });

  it('treats >3-digit fraction as SMPTE frames', () => {
    expect(parseTtmlTime('00:00:05.2500', TICK, FPS)).toBeCloseTo(5_000 + (2500 / 30) * 1000);
    expect(parseTtmlTime('00:00:05:0150', TICK, FPS)).toBeCloseTo(5_000 + (150 / 30) * 1000);
  });

  it('returns null for invalid input', () => {
    expect(parseTtmlTime('', TICK, FPS)).toBeNull();
    expect(parseTtmlTime('abc', TICK, FPS)).toBeNull();
    expect(parseTtmlTime('xt', TICK, FPS)).toBeNull();
    expect(parseTtmlTime('1:2:3', TICK, FPS)).toBeNull();
  });
});
