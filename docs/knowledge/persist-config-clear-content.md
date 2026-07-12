# Persist config + tags, clear field content on dialog close

> **Principle**: [Persist selections, clear content — scope autosave to intent](principles.md#persist-selections-clear-content--scope-autosave-to-intent)

## Problem
Card Creator autosave draft (debounced 500ms → `chrome.storage.local`) persist toàn bộ text field content (targetWord, sentence, definitions, note, moreExample) + tags + config (noteType, deck, fieldMapping, mediaUpdateMode). Khi user đóng dialog rồi mở lại, text field content cũ được restore.

Yêu cầu UX mới: đóng dialog = xóa hết content mọi field **trừ tags** (tags + config selection được giữ). Lý do: content (sentence, definitions...) gắn với card cụ thể vừa làm — giữ lại gây nhầm lẫn khi tạo card mới. Tags + config là selection ổn định — giữ lại tiết kiệm retry.

## Root causes
`cardDraft.ts` `SerializedDraft` persist text field content:
```ts
interface SerializedDraft {
  fields: { targetWord, sentence, sentenceTranslation, definitions, note, moreExample };
  ...
}
```
`deserializeDraft` restore text fields → `loadData` dùng `rf?.targetWord ?? ''` etc. → content cũ quay lại.

ADR-026 ban đầu persist work-in-progress để chống tab crash mất work. Nhưng UX thực tế: content cũ gây nhầm lẫn hơn là cứu vãn — user tạo card mới với sentence cũ của card trước.

## Fix
1. **`cardDraft.ts`** — `SerializedDraft` bỏ `fields` entirely, chỉ persist `noteType`, `deck`, `fieldMapping`, `tags`, `mediaUpdateMode`, `savedAt`. `deserializeDraft` trả text fields = `''`, media = `[]`. `isValidSerializedDraft` bỏ check `fields` object.
2. **`useCardCreatorState.ts`** `loadData` — bỏ `rf?.targetWord`/`rf?.definitions`/`rf?.note`/`rf?.moreExample`, dùng `''` trực tiếp. Chỉ `tags` + config (noteType/deck/mapping/mediaUpdateMode) restore. `sentence`/`sentenceTranslation` luôn lấy từ cue hiện tại.

## Key insight
Autosave scope phải match intent, không match shape. "Chống mất work" (crash recovery) ≠ "giữ content qua session" (persistence). Config selections (noteType, deck, mapping, mode) + tags là **selections** — ổn định, retry-friendly, persist. Field content (text, media) là **work product** — gắn với entity cụ thể, clear khi đóng entity. Persist selections + clear content = giữ cái ổn định, xóa cái nhầm-lẫn-gây-rối. Persist toàn bộ (old ADR-026) confuse 2 intent — cố cứu content nhưng content cũ lại là noise khi tạo entity mới.

## Verification
- `cardDraft.test.ts` — update 3 test:
  - round-trip: config + tags persist, text fields cleared (`targetWord === ''`, `sentence === ''`, `note === ''` etc.)
  - debounce: dùng `tags` thay `targetWord` (vì targetWord không còn persist)
  - load: restores config + tags, clears field content (`fields.targetWord === ''`)
- 2218 test pass, typecheck pass, build pass.
