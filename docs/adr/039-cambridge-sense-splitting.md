# ADR-039: Robust Cambridge sense splitting for the popup dictionary

> Date: 2026-07-16
> Status: Decided — implemented in `lookupOrchestrator.splitSenses`
> Related: `docs/specs/spec-popup-dictionary.md`, ADR-023, ADR-037
> Scope: English popup dictionary definition rendering

## 1. Decision summary

When assembling a `LookupResult` from a Cambridge JSON dictionary entry, split a multi-sense `definition` string into one `DefinitionEntry` per sense by detecting every numeric marker that starts a sense boundary.

Rules:

1. A sense boundary is a marker of the form `N.` that appears either at the start of the string or after a blank line (`\n\n+`).
2. The marker may be followed immediately by a POS tag in parentheses (`1.(noun)`), or by plain text (`17.bring/call...`, `19.in question`).
3. To avoid false positives, the character after `N.` must be `(` or a non-digit, non-whitespace character. This excludes mid-sentence decimals like `1.5`.
4. If the POS is not on the same line as the marker, check the next line for a parenthesized POS tag (`bring/call...\n(noun) ...`) and promote it to the entry's `pos` field.
5. Strip the numeric marker from the rendered text. POS tags are also removed from the text and stored in `DefinitionEntry.pos`.
6. If no numeric markers are found, keep the whole definition as a single entry.

## 2. Why this decision is needed

Cambridge JSON packs all senses for a term into a single `definition` string. For example, the entry for `question` contains 23 numbered senses. Some of those senses are idioms whose markers do not include a POS in parentheses:

```text
16.(noun) a feeling of doubt about something
17.bring/call sth into question
(noun) to express doubt about something
```

The previous splitter only recognized boundaries when the marker was followed by a parenthesized POS (`N.(pos)`). Idiom markers like `17.`, `19.`, and `21.` were treated as continuation text, causing them to be glued to the preceding sense in the popup.

This produced a poor user experience: the user saw `noun. a feeling of doubt about something 17.bring/call sth into question...` instead of two separate, selectable definitions.

## 3. Alternatives considered

| Option | Pros | Cons |
|---|---|---|
| A. Keep the old regex and only split `N.(pos)` | Simple | Fails for all idiom markers; root cause remains. |
| B. Split at every `N.` anywhere in the text | Very simple | Would split on decimals inside examples (e.g., `1.5 kg`) and create empty/wrong senses. |
| C. Split at blank-line + `N.` plus second-line POS extraction | Correct for all observed Cambridge markers; avoids false positives | Slightly more code than option A. |

We chose **C**. It is the smallest change that correctly handles both standard senses and idiom markers.

## 4. Consequences

- Each Cambridge sense becomes an independent `DefinitionEntry` with its own checkbox in the popup.
- Idioms (`bring/call into question`, `in question`, `out of the question`) render as standalone definitions.
- Numbers are no longer displayed in the definition text, matching the requested UI.
- POS extraction is now consistent for both inline and next-line POS tags.
- No change to the dictionary import format or the database schema.

## 5. Validation

A unit test in `src/features/dictionaryPopup/logic/lookupOrchestrator.test.ts` seeds the real Cambridge `definition` for `question` and asserts:

- 23 separate definitions.
- No rendered text starts with a numeric marker.
- Idiom senses are present and have `pos: 'noun'`.
