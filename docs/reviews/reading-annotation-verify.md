# Verify — reading-annotation (browser gate)

> Date: 2026-10-07 (re-verify after fix) · Owner: devin-ux-coord
> Item stage: `deliver` · Gates: typecheck/lint/testUnit/build = pass · **browser = pass**
> Environment: Brave `:9224` (agent profile `C:\Tihoka-browser-sessions\brave-agent`), extension reloaded from current `dist/`, real Chromium, kisskh.do Cobra Kai S4E10.

## Root cause of the earlier `fail`

`videoTokenPreloader.flushPendingTerms` resolves dictionary readings in chunks of 100 terms, then calls `videoTokenMap.resolveMetadata` which treated the chunk's map as authoritative for **every** cue — terms outside the current chunk got `readings.get(term) === undefined` → `termReadingCache.delete()` + `reading=undefined`. Each subsequent chunk wiped the readings of all previous chunks, so after ~30 chunks only the last chunk's terms kept readings. The cue list path (`resolveTokenListMetadata`) resolves whole lists without chunking, which is why readings showed in the subtitle panel but not the overlay block.

Fixed in `d062d9d0` (authoritative covered-term tracking + `has()` semantics), with unit tests reproducing the chunk-wipe.

## What was verified this session

| # | Check | Result |
|---|-------|--------|
| 1 | Overlay mounts and renders token spans for a live cue ("I just want you to know" / "I haven't forgotten what you did for me.") | ✅ |
| 2 | Token spans carry `data-reading` — 6/6 and 7/8 word tokens hydrated (`aɪ`, `dʒʌst`, `wənt`, `ju`, `tu`, `noʊ`, `fərˈɡɑt(ə)n`, `wɑt`, `dɪd`, `fɔr`, `mi`); misses are contractions absent from the dictionary | ✅ |
| 3 | Caps render above glyphs and are readable — `0.68em`, opacity `0.92` (screenshot `tmp/reading-annotation/readings-on2.png`) | ✅ |
| 4 | Wrapped lines: `margin-top: 0.85em` headroom reserves space; caps sit in the reserved band and do not overlap the line above | ✅ |
| 5 | Toggle OFF → `data-reading` attributes removed, caps hidden, plain text renders ("I haven't forgotten what you did for me." with no caps — `readings-off.png`); toggle ON restores | ✅ |
| 6 | Subtitle block stays between left/right nav clusters — `transform: scale(1.3)` previously inflated visual width past the flex gap; `maxWidth = 100%/globalScale` keeps the scaled box inside (`block [62,332]` vs nav `[..,56]` / `[337,..]`; screenshot `subtitle-block-contained.png`, re-confirmed `contained:true` this session) | ✅ |
| 7 | Readings resolve via chunked fetch without wiping earlier chunks — unit tests in `videoTokenMap.test.ts`/`videoTokenPreloader` cover it | ✅ |
| 8 | Perf: `resolveTerms` resolves only cues containing newly fetched terms (term→cue index) instead of re-scanning all cues per chunk — synthetic bench 58.4ms → 1.9ms (~31×) | ✅ |

VERDICT: PASS
