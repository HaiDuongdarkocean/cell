/** Fetch with an abort-based timeout. Resolves to the Response, or rejects with
 *  a `TimeoutError`-style Error when the deadline elapses. */
export async function fetchWithTimeout(
  url: string,
  options?: RequestInit,
  timeoutMs = 10000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
