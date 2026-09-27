import type { ConnectionId } from '../domain/types';

export const BACKOFF_BASE_MS = 30_000;
export const BACKOFF_CAP_MS = 30 * 60_000;

export type EngineState =
  | 'idle'
  | 'running'
  | 'backoff'
  | 'needs-reauth'
  | 'offline'
  | 'storage-full';

export function backoffDelayMs(failures: number): number {
  const exponent = Math.max(0, failures - 1);
  return Math.min(BACKOFF_BASE_MS * 2 ** exponent, BACKOFF_CAP_MS);
}

interface BackoffEntry {
  failures: number;
  retryAt: number;
  state: EngineState;
}

export class BackoffTracker {
  private readonly entries = new Map<ConnectionId, BackoffEntry>();

  recordFailure(
    connectionId: ConnectionId,
    now: number,
    state: EngineState = 'backoff',
  ): number {
    const previous = this.entries.get(connectionId);
    const failures = (previous?.failures ?? 0) + 1;
    const retryAt = now + backoffDelayMs(failures);
    this.entries.set(connectionId, { failures, retryAt, state });
    return retryAt;
  }

  recordSuccess(connectionId: ConnectionId): void {
    this.entries.delete(connectionId);
  }

  retryAt(connectionId: ConnectionId): number | undefined {
    return this.entries.get(connectionId)?.retryAt;
  }

  stateOf(connectionId: ConnectionId): EngineState | undefined {
    return this.entries.get(connectionId)?.state;
  }

  snapshot(): ReadonlyMap<ConnectionId, { state: EngineState; retryAt: number }> {
    const out = new Map<ConnectionId, { state: EngineState; retryAt: number }>();
    for (const [connectionId, entry] of this.entries) {
      out.set(connectionId, { state: entry.state, retryAt: entry.retryAt });
    }
    return out;
  }

  earliestRetryAt(): number | undefined {
    let earliest: number | undefined;
    for (const entry of this.entries.values()) {
      if (earliest === undefined || entry.retryAt < earliest) earliest = entry.retryAt;
    }
    return earliest;
  }
}
