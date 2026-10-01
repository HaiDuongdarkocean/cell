# Analyze review — condensed-audio

Interactive gate: user (Anh) reviewed `docs/intent/condensed-audio.md` and approved.

Decisions recorded during elicitation:
- Both legs in scope (leg A file-based ffmpeg condense; leg B realtime record via JUMP + captureStream) — cost revised M→L.
- Output: export dir path setting (unset → directory picker), new Playlist tab, Drive sync per item.
- Entry: subtitle panel only (covers streaming + local player).
- Playlist tab explicitly future home for watch-later — out of scope here.
- `condensed-playback` dropped — `skipNoDialogue` already ships the in-player capability; folded into this item's leg B.

VERDICT: APPROVE
