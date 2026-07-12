/**
 * declarativeNetRequest helpers — set/remove a dynamic rule that rewrites the
 * `Referer` (and `Origin`) header for a single URL.
 *
 * Why this exists: `fetch()` from the extension service worker cannot set
 * `Referer` — it is a forbidden header (Chrome 72+ strips it). Many subtitle
 * CDNs (e.g. `1oe.lostproject.club` behind `megaplay.buzz`) reject requests
 * whose `Referer` is not the iframe player origin and return 403.
 *
 * `declarativeNetRequest` runs in the network stack, AFTER the browser has
 * prepared the request headers, so it CAN rewrite `Referer`. The rule is
 * scoped to:
 *  - the exact subtitle URL (`urlFilter` with `||` anchor + `^` end)
 *  - requests initiated by this extension only (`initiatorDomains`)
 *  - `xmlhttprequest` resource type (fetch/XHR)
 *
 * This avoids affecting page-originated requests (e.g. the player's own VTT
 * fetch when video plays) — those keep their natural `Referer`.
 *
 * Rule ids are allocated from a per-extension counter persisted in
 * `chrome.storage.session` so they survive SW eviction but reset each browser
 * session. The caller MUST `removeRefererRule(ruleId)` after the fetch
 * completes (success or failure) to avoid rule accumulation (DNR has a
 * default cap of 30,000 dynamic rules, but leaving stale rules is wasteful
 * and can mask later bugs).
 */

// DNR rule ids must be unique integers >= 1 and persist across SW evictions
// (rules live in the browser, not the SW). Using Unix seconds as the base
// guarantees uniqueness across SW restarts — time only moves forward, so a
// restarted SW gets a higher base than any rule created before the restart.
// The in-memory `++ruleIdBase` handles multiple calls within the same
// second (JS is single-threaded, so the increment is atomic).
// Previous approaches (storage-backed counter with read-modify-write) raced
// when the fire-and-forget persist didn't complete before SW eviction →
// restarted SW read a stale base → created a duplicate id →
// "Rule with id N does not have a unique ID" error.
//
// ponytail: Date.now() (ms) overflows DNR int32 id (>2.1e9) → Chrome rejects
// with "Invalid type: expected integer, found number". Unix seconds fits
// int32 until Y2K38 (2038-01-19). Ceiling: after 2038, switch to
// (Date.now() - SOME_EPOCH_OFFSET) / 1000 or a storage-backed counter.
let ruleIdBase = 0;

function nextRuleId(): number {
  if (ruleIdBase === 0) {
    ruleIdBase = Math.floor(Date.now() / 1000);
  }
  return ++ruleIdBase;
}

/**
 * Register a dynamic DNR rule that sets `Referer` (and `Origin`) for a single
 * URL. Returns the rule id so the caller can remove it after the fetch.
 *
 * The rule only matches requests whose initiator is this extension (origin =
 * `chrome-extension://<id>`), so page-originated requests to the same URL are
 * unaffected.
 *
 * @param url - The exact subtitle URL to rewrite headers for
 * @param referer - The full Referer value (e.g. `https://megaplay.buzz/...`)
 * @returns The rule id (pass to `removeRefererRule` to clean up)
 */
export async function setRefererRule(url: string, referer: string): Promise<number> {
  const ruleId = nextRuleId();
  let origin: string;
  try {
    origin = new URL(referer).origin;
  } catch {
    origin = referer;
  }

  // Build a urlFilter that matches the exact URL. `||` anchors to the scheme
  // boundary, the rest is the full URL with `^` as end-of-URL terminator.
  // DNR urlFilter is a substring match with anchors — using the full URL is
  // the most specific match. We escape nothing because DNR urlFilter is not
  // regex; special chars are limited to `^`, `||`, `|` anchors.
  const urlFilter = `|${url}^`;

  const rule: chrome.declarativeNetRequest.Rule = {
    id: ruleId,
    priority: 1,
    action: {
      type: 'modifyHeaders' as chrome.declarativeNetRequest.RuleActionType,
      requestHeaders: [
        { header: 'Referer', operation: 'set' as chrome.declarativeNetRequest.HeaderOperation, value: referer },
        { header: 'Origin', operation: 'set' as chrome.declarativeNetRequest.HeaderOperation, value: origin },
      ],
    },
    condition: {
      urlFilter,
      resourceTypes: ['xmlhttprequest' as chrome.declarativeNetRequest.ResourceType],
      initiatorDomains: [chrome.runtime.id],
    },
  };

  await chrome.declarativeNetRequest.updateDynamicRules({
    addRules: [rule],
    removeRuleIds: [],
  });
  return ruleId;
}

/**
 * Remove a dynamic DNR rule by id. Silently resolves if the rule no longer
 * exists (already removed, or SW evicted and rules reset).
 */
export async function removeRefererRule(ruleId: number): Promise<void> {
  await chrome.declarativeNetRequest.updateDynamicRules({
    addRules: [],
    removeRuleIds: [ruleId],
  });
}
