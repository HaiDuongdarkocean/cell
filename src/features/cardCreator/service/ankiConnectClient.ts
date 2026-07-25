/**
 * AnkiConnect client — pure HTTP functions for talking to AnkiConnect.
 *
 * All functions take a `baseUrl` (e.g. 'http://localhost:8765') and return the
 * raw AnkiConnect `result` field. They throw `AnkiConnectError` on any failure
 * (network, non-2xx, AnkiConnect `error` field, or timeout).
 *
 * These functions are transport-agnostic: callers inject a `fetch`-compatible
 * function. In production the background service worker passes `globalThis.fetch`;
 * in tests a mock fetch is injected. This keeps the client pure + testable.
 */

/** AnkiConnect JSON request body (version 6). */
export interface AnkiConnectRequest {
  readonly version: 6;
  readonly action: string;
  readonly params?: Record<string, unknown>;
}

/** AnkiConnect JSON response envelope. */
export interface AnkiConnectResponse {
  readonly result?: unknown;
  readonly error?: string | null;
}

/** Error thrown by all AnkiConnect client functions. */
export class AnkiConnectError extends Error {
  readonly action: string;
  readonly status?: number;
  constructor(message: string, action: string, status?: number) {
    super(message);
    this.name = 'AnkiConnectError';
    this.action = action;
    this.status = status;
  }
}

/** Fetch-like function signature (subset of global fetch). */
export type FetchFn = (
  input: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

/** Default timeout for AnkiConnect requests (10s). */
export const DEFAULT_ANKI_TIMEOUT_MS = 10_000;

/**
 * Invoke an AnkiConnect action. Throws `AnkiConnectError` on any failure.
 *
 * @param fetchFn  fetch-compatible function (injected for testability)
 * @param baseUrl  AnkiConnect base URL (no trailing slash)
 * @param action   AnkiConnect action name
 * @param params   action params (optional)
 * @param timeoutMs per-request timeout (default 10s)
 */
export async function invokeAnkiConnect(
  fetchFn: FetchFn,
  baseUrl: string,
  action: string,
  params?: Record<string, unknown>,
  timeoutMs: number = DEFAULT_ANKI_TIMEOUT_MS,
): Promise<unknown> {
  if (!baseUrl) {
    throw new AnkiConnectError('AnkiConnect URL is empty', action);
  }

  const body: AnkiConnectRequest = { version: 6, action, params: params ?? {} };
  let response: { ok: boolean; status: number; json: () => Promise<unknown> };

  // Race fetch against timeout. AbortController is the clean way, but to keep
  // the FetchFn signature minimal we use Promise.race + a timeout promise that
  // rejects. The fetch promise clears the timeout in finally so the timer does
  // not remain in the event loop after the request completes.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const fetchPromise = fetchFn(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).finally(() => { if (timer) clearTimeout(timer); });

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new AnkiConnectError(`Request timed out after ${timeoutMs}ms`, action)),
      timeoutMs,
    );
  });

  try {
    response = await Promise.race([fetchPromise, timeout]);
  } catch (err) {
    if (err instanceof AnkiConnectError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    throw new AnkiConnectError(`Network error: ${msg}`, action);
  }

  if (!response.ok) {
    throw new AnkiConnectError(`HTTP ${response.status}`, action, response.status);
  }

  let json: AnkiConnectResponse;
  try {
    json = (await response.json()) as AnkiConnectResponse;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new AnkiConnectError(`Invalid JSON response: ${msg}`, action, response.status);
  }

  if (json.error) {
    throw new AnkiConnectError(json.error, action, response.status);
  }

  return json.result;
}

// === Typed action wrappers ===
// Each wrapper calls invokeAnkiConnect with the right action + params and
// casts the result to the expected shape. Wrappers are thin: they do NOT
// validate the result shape (AnkiConnect is trusted at this layer).

export async function getVersion(fetchFn: FetchFn, baseUrl: string): Promise<number> {
  const result = await invokeAnkiConnect(fetchFn, baseUrl, 'version');
  return result as number;
}

export interface AnkiNote {
  readonly deckName: string;
  readonly modelName: string;
  readonly fields: Record<string, string>;
  readonly tags?: string[];
  /** AnkiConnect addNote options. allowDuplicate: true bypasses the
   *  duplicate check so the same card can be added multiple times. */
  readonly options?: { readonly allowDuplicate?: boolean };
}

export async function addNote(fetchFn: FetchFn, baseUrl: string, note: AnkiNote): Promise<number | null> {
  const result = await invokeAnkiConnect(fetchFn, baseUrl, 'addNote', { note });
  return result as number | null;
}

export interface StoreMediaFileParams {
  readonly filename: string;
  /** Base64-encoded file contents (no data: prefix). */
  readonly data: string;
}

export async function storeMediaFile(
  fetchFn: FetchFn,
  baseUrl: string,
  params: StoreMediaFileParams,
): Promise<string> {
  const result = await invokeAnkiConnect(
    fetchFn,
    baseUrl,
    'storeMediaFile',
    params as unknown as Record<string, unknown>,
  );
  return result as string;
}


