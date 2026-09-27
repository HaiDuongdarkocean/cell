import type { ConnectionId } from '../domain/types';

export const BACKOFF_BASE_MS = 30_000;
export const BACKOFF_CAP_MS = 30 * 60_000;

export function backoffDelayMs(failures: number): number {
  const exponent = Math.max(0, failures - 1);
  return Math.min(BACKOFF_BASE_MS * 2 ** exponent, BACKOFF_CAP_MS);
}

interface BackoffEntry {
  failures: number;
  retryAt: number;
}

export class BackoffTracker {
  private readonly entries = new Map<ConnectionId, BackoffEntry>();

  recordFailure(connectionId: ConnectionId, now: number): number {
    const previous = this.entries.get(connectionId);
    const failures = (previous?.failures ?? 0) + 1;
    const retryAt = now + backoffDelayMs(failures);
    this.entries.set(connectionId, { failures, retryAt });
    return retryAt;
  }

  recordSuccess(connectionId: ConnectionId): void {
    this.entries.delete(connectionId);
  }

  retryAt(connectionId: ConnectionId): number | undefined {
    return this.entries.get(connectionId)?.retryAt;
  }

  earliestRetryAt(): number | undefined {
    let earliest: number | undefined;
    for (const entry of this.entries.values()) {
      if (earliest === undefined || entry.retryAt < earliest) earliest = entry.retryAt;
    }
    return earliest;
  }
}
