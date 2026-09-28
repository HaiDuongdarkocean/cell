import type { Hlc } from './types';

export function compareHlc(a: Hlc, b: Hlc): number {
  if (a.wall !== b.wall) return a.wall - b.wall;
  if (a.counter !== b.counter) return a.counter - b.counter;
  return a.node < b.node ? -1 : a.node > b.node ? 1 : 0;
}

export function hlcEq(a: Hlc, b: Hlc): boolean {
  return compareHlc(a, b) === 0;
}

export function maxHlc(a: Hlc, b: Hlc): Hlc {
  return compareHlc(a, b) >= 0 ? a : b;
}

export class HybridClock {
  private lastWall = 0;
  private counter = 0;

  constructor(
    private readonly node: string,
    private readonly now: () => number = Date.now,
    seedWall = 0,
  ) {
    this.lastWall = seedWall;
  }

  tick(): Hlc {
    const wall = Math.max(this.now(), this.lastWall);
    this.counter = wall === this.lastWall ? this.counter + 1 : 0;
    this.lastWall = wall;
    return { wall, counter: this.counter, node: this.node };
  }

  observe(remote: Hlc): void {
    if (remote.wall > this.lastWall) {
      this.lastWall = remote.wall;
      this.counter = remote.counter;
      return;
    }
    if (remote.wall === this.lastWall && remote.counter > this.counter) {
      this.counter = remote.counter;
    }
  }

  seedWall(wall: number): void {
    if (wall > this.lastWall) {
      this.lastWall = wall;
      this.counter = 0;
    }
  }

  get nodeId(): string {
    return this.node;
  }

  get wallFloor(): number {
    return this.lastWall;
  }
}
