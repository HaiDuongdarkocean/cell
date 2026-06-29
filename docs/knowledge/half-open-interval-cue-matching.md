# Half-open interval cue matching (learned while fixing replay-cue jump back)

> **Principle**: [Half-open intervals [start, end) for time-based matching](principles.md#half-open-intervals-start-end-for-time-based-matching)

## Problem

Khi replay một subtitle cue (seek về đầu cue hiện tại), side panel highlight **nhảy
về cue trước đó** rồi mới correction về cue đúng. Symptom: "jump back" flash ngắn.

## Root causes

### Closed interval `c.end >= currentTimeMs`

4 callsites dùng closed interval `[start, end]` để tìm current cue:

```typescript
// CueList.tsx, sidePanelStore.ts, content-script.ts (2 chỗ)
const currentIndex = bilingualCues.findIndex(
  (c) => c.start <= currentMs && c.end >= currentMs  // ← closed [start, end]
);
```

### Boundary overlap

Khi 2 cue liên tiếp có boundary trùng: `cue[i].end === cue[i+1].start` (VD: cue 1 end
5000ms, cue 2 start 5000ms). Tại thời điểm `t = 5000ms`:

- `cue[i].start <= 5000 && cue[i].end >= 5000` → **true** (closed interval match)
- `cue[i+1].start <= 5000 && cue[i+1].end >= 5000` → **true** (cũng match)

`findIndex` trả về **index đầu tiên match** = `cue[i]` (cue cũ). Hệ thống highlight
cue cũ trước, rồi `timeupdate` tiếp theo (t=5001ms) → `cue[i].end < 5001` → match
`cue[i+1]` → correction → "jump back" flash.

## Fix

### Half-open interval `[start, end)` tại 4 callsites

```typescript
// CueList.tsx, sidePanelStore.ts, content-script.ts (2 chỗ)
const currentIndex = bilingualCues.findIndex(
  (c) => c.start <= currentMs && c.end > currentMs  // ← half-open [start, end)
);
```

Tại boundary `t = cue[i].end = cue[i+1].start`:
- `cue[i].start <= t && cue[i].end > t` → `cue[i].end > cue[i].end` → **false**
- `cue[i+1].start <= t && cue[i+1].end > t` → **true**

→ `findIndex` trả `cue[i+1]` (cue mới) ngay lần đầu, không "jump back".

## Key insight

Time-based matching với boundary liền nhau (cue end = cue next start) phải dùng
**half-open interval `[start, end)`** — boundary thuộc về cue tiếp theo, không thuộc
về cue hiện tại. Closed interval `[start, end]` tạo overlap tại boundary → `findIndex`
trả index sai (earlier match) → flash/correction.

Rule: **`c.end > t` không `c.end >= t`** khi boundary liền nhau. Tương tự `c.start <= t`
không `c.start < t` (start thuộc về cue hiện tại).

## Verification

### Regression test (CueList.test.tsx)

```
✓ returns next cue at exact boundary t = cue[i].end = cue[i+1].start (half-open)
✓ does not match previous cue at boundary (no jump back)
```

### Unit tests: 1136/1137 pass (1 pre-existing isolation issue). `npx tsc --noEmit`: pass.

## Apply cho
- Time-range matching (cue, segment, chapter)
- Interval overlap detection (calendar, scheduling)
- Bucket assignment (timestamp → bucket, boundary thuộc bucket tiếp theo)
- Any `findIndex` với `start <= t && end >= t` khi boundary liền nhau
