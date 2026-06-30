# Subtitle Sidebar + Keyboard Shortcuts

## Problem Statement
How might we let language learners navigate subtitles efficiently with keyboard shortcuts + a visual sidebar showing all cues, while keeping the experience responsive and customizable?

## Recommended Direction
Language Reactor pattern adapted to Chrome extension: sidebar bên phải video (absolute trong video parent wrapper), hiển thị cue list với bilingual text (target trên, native dưới), keyboard shortcuts (a/d/s/w/t), remap trong settings tab riêng. Smooth seek + lazy load cho performance.

## Key Assumptions to Validate
- [ ] Bilingual SRT parse được (delimiter `\n` hoặc dual-file) — test với sample
- [ ] Smooth seek với `video.currentTime` + CSS transition — test Chrome
- [ ] Lazy load IntersectionObserver cho > 50 cues — test performance
- [ ] chrome.storage lưu shortcut mappings — đã có pattern settings

## MVP Scope
- Floating panel draggable (di chuyển lên xuống), bên phải video mặc định
- Cue list: timestamp (clickable → smooth seek) + bilingual text (target trên, native dưới nhỏ hơn mờ hơn)
- Current cue highlighted + auto-scroll into view
- Shortcuts: a=prev cue, d=next cue, s=replay current, w=toggle subtitles, t=toggle panel
- Remap: settings tab riêng trong popup, lưu chrome.storage
- Panel toggle button, switch position left/right
- Lazy load cue list (IntersectionObserver)
- Bilingual SRT parser (delimiter `\n` giữa target/native)

## Not Doing (and Why)
- AI word suggest — future, quá scope v1
- Mini-timeline — future, panel đủ
- Resizable panel — v1 fixed width, draggable position only
- Virtual scroll — lazy load đủ v1

## Open Questions
- Bilingual SRT format: delimiter `\n` hay dual-file? → v1: delimiter `\n` (1 file, target dòng lẻ, native dòng chẵn)
- Panel che video trên small screens? → v1: toggle button ẩn panel
