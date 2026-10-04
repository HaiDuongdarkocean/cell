# Review: unified-resource-import — ANALYZE gate

> Stage: analyze → specify · Mode: interactive · Reviewer: Anh (product owner, interactive approval)
> Doc under review: `docs/intent/unified-resource-import.md`

## Approval record

Anh duyệt intent doc qua interactive gate (2026-10-04), chọn "Approve — sang specify" sau khi được trình bày hypothesis:

- Need: user đang phải trả lời câu file tự trả lời được (dictionary vs frequency); thả nhầm ô → ParseError hoặc mất nửa nội dung lặng lẽ.
- Hướng: resource = container của components — một dropzone auto-detect, một entry-store theo kiến trúc dictionary (freq = entry lean mang rank payload), `type` khai-báo → components suy từ nội dung, một danh sách một trục priority.
- Bằng chứng hội tụ: `serializeResourcePortable(dictRows, freqRows)` đã mô hình resource mixed-content; hai store giống hệt keyPath/index; repos mirror; `components`/`disabledComponents` đã ship.
- Rủi ro đã đăng ký: migration v14 cho 100k+ rows, đụng `dictLocalSource` của `sync-on-use` in-flight (sequence/rebase), sweep 41 files nhánh `type` chống dead-path, sqlite schema-sniff + parked-prompt fallback.

Decision trong doc: go — được duyệt nguyên trạng, không chỉnh scope.

VERDICT: APPROVE
