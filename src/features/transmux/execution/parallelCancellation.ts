/**
 * Cancellation and cleanup for parallel conversion jobs.
 *
 * Provides a cancellation token that can be checked during long-running
 * parallel conversion, and a cleanup coordinator that ensures temp
 * files are removed even if the conversion is cancelled mid-flight.
 */

import { deleteFile, ensureDownloadSubdir } from '@/shared/lib/storage/opfsStorage';

/**
 * Cancellation token for parallel conversion.
 *
 * The background script creates a token per downloadId and checks
 * `isCancelled()` at key points during conversion. If cancelled,
 * the conversion throws `ParallelConversionCancelledError`.
 */
export class CancellationToken {
  private cancelled = false;
  private readonly listeners: Array<() => void> = [];

  /** Cancel the operation. Idempotent. */
  cancel(): void {
    if (this.cancelled) return;
    this.cancelled = true;
    for (const listener of this.listeners) {
      try {
        listener();
      } catch {
        // Listener errors are non-fatal.
      }
    }
  }

  /** Check if cancelled. */
  isCancelled(): boolean {
    return this.cancelled;
  }

  /** Register a callback to run when cancelled. */
  onCancel(listener: () => void): void {
    if (this.cancelled) {
      listener();
    } else {
      this.listeners.push(listener);
    }
  }

  /** Throw if cancelled. */
  throwIfCancelled(): void {
    if (this.cancelled) {
      throw new ParallelConversionCancelledError();
    }
  }
}

/** Error thrown when a parallel conversion is cancelled. */
export class ParallelConversionCancelledError extends Error {
  constructor() {
    super('Parallel conversion was cancelled');
    this.name = 'ParallelConversionCancelledError';
  }
}

/**
 * Registry of active cancellation tokens, keyed by downloadId.
 * Allows the background script to cancel a conversion by downloadId.
 */
export class CancellationTokenRegistry {
  private readonly tokens = new Map<string, CancellationToken>();

  /** Create and register a new token for a downloadId. */
  create(downloadId: string): CancellationToken {
    const token = new CancellationToken();
    this.tokens.set(downloadId, token);
    return token;
  }

  /** Get the token for a downloadId, or undefined. */
  get(downloadId: string): CancellationToken | undefined {
    return this.tokens.get(downloadId);
  }

  /** Cancel the conversion for a downloadId. No-op if not found. */
  cancel(downloadId: string): void {
    this.tokens.get(downloadId)?.cancel();
  }

  /** Remove and dispose the token for a downloadId. */
  dispose(downloadId: string): void {
    this.tokens.delete(downloadId);
  }

  /** Check if a downloadId is cancelled. */
  isCancelled(downloadId: string): boolean {
    return this.tokens.get(downloadId)?.isCancelled() ?? false;
  }

  /** Clear all tokens. */
  clear(): void {
    this.tokens.clear();
  }
}

/**
 * Clean up all temp part files for a downloadId.
 *
 * Scans the download directory for files matching `part-*.fmp4` and
 * removes them. Safe to call even if no part files exist.
 */
export async function cleanupParallelTempFiles(
  downloadId: string,
): Promise<{ cleaned: number; errors: number }> {
  let cleaned = 0;
  let errors = 0;

  try {
    const dirHandle = await ensureDownloadSubdir(downloadId);

    for await (const entry of dirHandle.values()) {
      if (entry.kind === 'file' && entry.name.startsWith('part-') && entry.name.endsWith('.fmp4')) {
        try {
          await deleteFile(dirHandle, entry.name);
          cleaned++;
        } catch {
          errors++;
        }
      }
    }
  } catch {
    // Directory doesn't exist — nothing to clean.
  }

  return { cleaned, errors };
}

