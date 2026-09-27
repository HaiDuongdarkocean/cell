import type { Clock } from '../../ports/clock';

export class SeededClock implements Clock {
  private current: number;

  constructor(seed = 0) {
    this.current = seed;
  }

  now(): number {
    return this.current;
  }

  set(ms: number): void {
    this.current = ms;
  }

  advance(ms: number): void {
    this.current += ms;
  }
}
