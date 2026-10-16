# Analyze review — ai-bridge-dictionary

Fresh-context audit of `docs/intent/ai-bridge-dictionary.md` (subagent_explore, read-only).

## Citation spot-checks

| Claim | Result |
|---|---|
| `popupTypes.ts:26` PopupTab union | ✅ exact |
| `DictionaryToolbar.tsx` TABS keys | ✅ audio/image/translate/links/pronunciation |
| `src/features/aiBridge/` + `chatgptBridge.ts` | ✅ working PoC, MutationObserver reply detection |
| `src/features/sync/adapters/google-drive/` | ✅ exists |
| `fieldMapping.ts:94` notes field | ✅ `/note\|extra\|comment/` → `notes` |
| `TranslatePanel.tsx` Google-only | ⚠️ handler is Google-primary with MyMemory fallback; no user-visible engine choice — need stands |
| `CandidateView.tsx:595` note lines | ⚠️ synonym-group display span, not a card-note field — weak relevance |
| `tmp/chatgpt-bridge-poc/probe-*.mjs` | ❌ gitignored scratch — unverifiable by fresh reader |
| `src/features/aiBridge/providers.ts` | ❌ does not exist yet |

## Gate checklist

1. Journey ✅ (AS-IS 5, TO-BE 7, ends on value)
2. Needs ⚠️ borderline pass — N7/N8 embed provider vocabulary (user-stated constraints)
3. ui_surface ✅
4. Decision=go ✅ supported by risk register
5. Confidence ⚠️ wall of `high`; N7/N8 rest on unverified providers + dead citations
6. Scope ✅
7. Stories ⚠️ S1/S2/S8 name UI elements ("AI tab", "retry button")

## Recommended changes

1. Fix dead evidence paths — cite `chatgptDom.ts`; drop `tmp/` citation.
2. Re-aim `CandidateView.tsx:595` (drop it — `fieldMapping.ts:94` already carries N5).
3. Downgrade N7/N8 confidence to `medium`.
4. Reword S1/S2/S8 to capability language.

Minor risks for SPEC stage (non-blocking): bridge `'busy'` interaction with concurrent popup asks; MV3 popup closed mid-request.

VERDICT: APPROVE_WITH_CHANGES

## Applied fixes

1. `Need` row: replaced weak `CandidateView.tsx:595` citation with `fieldMapping.ts:94` (real notes-field mapping).
2. `Supplier` row: dropped fabricated `providers.ts` citation; now cites `chatgptDom.ts` (committed PoC) + probe session evidence; confidence lowered to `medium`.
3. `Context` row: `tmp/` probe citation replaced with committed `src/features/aiBridge/` PoC.
4. `Organization` row: cites `chatgptDom.ts` as the probe-module exemplar.
5. N7/N8 confidence: `high` → `medium` with `[assumption]` tag (non-chatgpt providers unverified end-to-end).
6. Stories S1/S2/S8 reworded to capability language (dropped "AI tab"/"retry button" nouns).
7. Two minor risks forwarded to spec `## Open Questions` (busy-guard concurrency, popup-close mid-request).
