# Debugging — patterns, traps, evidence

## Common root-cause patterns

| Symptom | Likely root cause | Falsify by |
|---|---|---|
| Works once, fails on reload | State leak or not initialized | Fresh profile reload |
| Works locally, fails on host | Host page interference | Test on clean page |
| Works first item, fails others | Off-by-one, cursor offset, phrase boundary | Test middle and last |
| Works fast, fails slow | Race condition or missing await | Throttle network / CPU |
| Works one word, fails another | Casing, lemma, or phrase mismatch | Same action, different words |
| UI updated but reverts | Cache not invalidated or stale source | Rebind, check source of truth |
| Popup wrong but token right | Different term keys between set and get | Log both keys |
| Data exists but user can't see it | DOM queried but not rendered/visible | `getComputedStyle` + `getBoundingClientRect` vs `innerText` |
| Works first time, fails second | State leak or cache reuse | Repeat without reloading |
| Source correct, runtime wrong | Builder/minifier strips code | Grep build output for the fix |
| Snippet fixes it, source fix doesn't | Snippet patched a different path | Trace which path the snippet touched |
| Bug only near boundaries (last items, edges) | API affects all ancestors/containers | Layout precondition set + boundary target; log ancestor state over time |
| Hypothesis feels right, snippet does nothing | Second hidden root cause | Step 4 — look for a second failure layer |

## Browser extension traps

| Trap | Why | Falsify by |
|---|---|---|
| Service worker terminated | MV3 ephemeral | Reload, re-run immediately |
| Content script in wrong world | `chrome.runtime` missing | Check injection target + `world` |
| Subframe injection | `all_frames` hits ads/challenge frames | Count injection logs per frame |
| Storage desync | Different `dbHash` across contexts | Compare `getDbHash()` both sides |
| Handler not registered | Handler added after message | Check registration order |
| Host page mutates DOM | Re-render wipes tokenized nodes | Watch `MutationObserver` + rebind count |

## Evidence by bug category

| Bug type | Gather first |
|---|---|
| Test failure | Full output, order dependence, isolation, recent changes |
| Build error | Exact error line, config diff, lockfile, Node version |
| Runtime crash | Stack trace, input data, state at crash, last action |
| UI/SPA bug | DOM snapshot, `innerText`, computed style, bounding rect, visibility, `readyState`, network, console, iframes; add a Playwright E2E for regression |
| Extension bug | `manifest.json`, injection logs, top/subframe state, storage |
| Performance | Flame graph, memory snapshot, network waterfall, metrics |

## Socratic questions

Ask before any hypothesis: What exactly is failing? What am I taking for granted? What do I know and why? What would disprove my theory? If X is true, what follows? Could there be another cause? **Does my reproduction match every condition in the contract's Given/When?**

## Evidence board template

```text
Known facts:
-
-
-

Guesses / theories:
-  ← test this
-  ← test this

Contract conditions checklist:
- [ ] Condition 1 from Given: met / not met
- [ ] Condition 2 from Given: met / not met
```

Do not start Snippet Verify until the board has more facts than guesses AND every contract condition is met.

## Pause at Certainty

At 90% confidence: What evidence haven't I gathered? What's the weakest link? If wrong, what will I have wasted? Can I explain the bug without jargon? Did I repeat the action ≥2× under the real flow? Did I log state over time or take one snapshot? Does my snippet re-trigger the contract's When or an isolated API?

## Full anti-patterns list

- Skipping a failing test to work on new features
- Guessing fixes without reproducing; fixing symptoms not root causes
- "It works now" without understanding what changed
- No regression test after a fix; multiple unrelated changes while debugging
- `setTimeout` without a lifecycle signal; subframe DOM mutation without a top-frame guard
- Stopping at the first plausible explanation; writing the fix before the failing regression test
- Declaring pass after one manual test; DOM text treated as user-visible behavior
- Probing multiple times instead of capturing all evidence in one pass
- Editing source before the snippet proves the hypothesis; declaring pass before the source fix reproduces the snippet's effect
- Trusting source over build output when runtime behaves differently
- Isolated API call replacing the contract's real flow; wrong mode/context vs the contract
- Single before/after snapshot for continuous-state bugs; skipped contract preconditions
