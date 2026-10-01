# Analyze review — anki-known-seed

Interactive gate: user (Anh) reviewed `docs/intent/anki-known-seed.md` and approved.

Decisions recorded during elicitation:
- Scope expanded from one-time seed → bidirectional 3-way status sync (Anki ↔ wordStatus ↔ Tihoka SRS). Cost revised S→XL; backlog row moved to queue bottom (#25) + Nhóm renamed "Quản lý Đồng bộ trạng thái Anki".
- Realtime = mini Anki addon push (user picked "làm mọi cách"); poll + manual + post-import remain fallback when addon absent.
- Write-back: mark `known` ở Tihoka → Anki card → mature (ivl≥21) via AnkiConnect — opt-in.
- Overwrite policy: upgrade tracking→known; never downgrade.
- New `learning` status added to wordStatus vocabulary.
- LWW conflict resolution by timestamp + provenance; suspended cards untouched.

VERDICT: APPROVE
