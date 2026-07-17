# Drag-drop inner handler stopPropagation blocks outer file-drop handler

> **Principle**: [Conditional stopPropagation — only swallow when inner actually handled](principles.md#conditional-stoppropagation--only-swallow-when-inner-actually-handled)

## Problem
Card Creator `MediaList` (image gallery + audio list) có 2 lớp drop handler:
- **Inner** (`handleDrop` trên mỗi thumbnail/row): xử lý drag-to-reorder giữa các item nội bộ.
- **Outer** (`mediaZone` onDrop trên container): xử lý drop file ngoài (từ desktop) → `onFilesDrop`.

Khi user drag file audio từ desktop thả lên audio area có sẵn file (hoặc thumbnail image), `onFilesDrop` không bao giờ được gọi — file không được add. Chỉ drop lên area rỗng mới hoạt động.

## Root causes
`handleDrop` (inner) gọi `e.stopPropagation()` **unconditionally** ở đầu hàm:
```ts
const handleDrop = (e, index) => {
  e.stopPropagation();          // ← always, regardless of whether reorder happened
  if (draggingIndex === null) return;  // external file drop — but already swallowed
  // ... reorder logic
};
```
Khi `draggingIndex === null` (external file drop, không có internal drag), handler return sớm nhưng `stopPropagation` đã chặn event bubble lên `mediaZone` → outer handler không chạy → `onFilesDrop` không gọi.

Same bug ở `handleListDrop` (container-level reorder handler) cũng `stopPropagation` unconditionally.

## Fix
`MediaList.tsx` — chỉ `stopPropagation` khi internal reorder thực sự diễn ra (`draggingIndex !== null`). Khi `draggingIndex === null` (external file drop), để event bubble lên outer `mediaZone`:
```ts
const handleDrop = (e, index) => {
  if (draggingIndex === null) return;  // external drop — let it bubble, NO stopPropagation
  e.stopPropagation();                  // internal reorder — swallow to prevent outer misfire
  // ... reorder logic
};
```

## Key insight
`stopPropagation` là "swallow event" — chỉ swallow khi handler thực sự tiêu thụ event. Khi inner handler return early vì không match case của nó (external drop khi inner chỉ xử lý internal reorder), event phải được phép bubble lên outer handler. Unconditional `stopPropagation` ở đầu hàm = silent dead path cho mọi case inner không handle.

## Verification
- `MediaList.test.tsx` — thêm 3 test:
  - drop audio file lên empty audio area → `onFilesDrop` called (đã hoạt động, guard regression)
  - drop audio file lên non-empty audio area (existing row) → `onFilesDrop` called (trước fix: fail, sau fix: pass)
  - drop image file lên non-empty image gallery (existing thumbnail) → `onFilesDrop` called (trước fix: fail, sau fix: pass)
- 2218 test pass, typecheck pass, build pass.
