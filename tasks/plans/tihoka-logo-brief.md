# Tihoka Logo Brief — paste vào ChatGPT/DALL-E

## Context cho Anh

- Product: **Tihoka** — Chrome extension biến mọi nội dung thành tài liệu học tập
  (video, stream, website, mạng xã hội → subtitle + flashcard Anki).
- Mascot: **Orca (cá voi sát thủ)**.
- Output cần: logo vuông, rõ nét ở 16px, bàn giao PNG nền trong suốt
  (sau đó em resize 16/32/48/128 → `public/icons/`).

## Vì sao là Orca (lý do để brief AI + làm brand story)

1. **Echolocation = detection.** Orca dò mục tiêu bằng sóng âm xuyên qua nước
   đục — đúng bản chất Tihoka: phát hiện video/subtitle giấu sâu trong
   trang web phức tạp (iframe cross-origin, stream m3u8, hardsub OCR).
2. **Apex predator của đại dương.** Orca săn được mọi con mồi — Tihoka bắt
   được mọi nguồn: YouTube, Netflix, iQIYI, streaming site, mạng xã hội.
   "Any content" = apex.
3. **Thông minh bậc nhất động vật.** Orca học, dạy con, truyền văn hóa săn
   mồi qua thế hệ — metafor hoàn hảo cho sản phẩm về học tập + hệ thống
   agent pipeline tự học từ kinh nghiệm (learning atoms).
4. **Săn theo bầy (pod hunting).** Orca phối hợp nhóm — giống kiến trúc
   multi-lane subagent của pipeline: nhiều lane song song, fan-in hợp nhất.
5. **Lặn sâu.** Orca lặn 100m+ bắt mực khổng lồ — Tihoka lặn sâu vào nội
   dung (subtitle, OCR hardsub, transcript) thay vì chỉ lướt bề mặt.
6. **Palette đen-trắng tương phản mạnh** — đọc tốt ở 16px, phù hợp
   light/dark theme, nhận diện ngay giữa hàng trăm tab extension.
7. Nốt "hệ sinh thái đại dương": username `The0cean`, ecosystem folder
   `The0cean ecosystem` — orca là linh vật đứng đầu đại dương đó.

## Prompt cho ChatGPT (copy nguyên đoạn này)

```
Design a brand logo for "Tihoka", a Chrome browser extension that turns any
online content (videos, streams, websites, social media) into study material
— subtitles, flashcards, and notes.

MASCOT: An orca (killer whale). Symbolic meaning:
- Echolocation = the extension detects hidden video/subtitle sources
- Apex predator = it captures content from ANY site
- Deep diver = it goes beneath the surface (OCR hardsubs, transcripts)
- Pod hunter = intelligent, collaborative, a learner

STYLE REQUIREMENTS:
- Flat vector logo mark, geometric and minimal (think: Firefox, Docker,
  GitLab animal logos — iconic, not realistic)
- The orca should be abstracted to a clean silhouette or a smart negative-
  space composition. Optionally combine with: a sound wave / sonar pulse
  (echolocation), a book page, or a play button triangle — pick ONE subtle
  secondary element, do not clutter
- Black, white + ONE accent color (suggest deep teal #0E7C7B or electric
  blue — oceanic but modern). Must work in pure black & white too
- Solid transparent background, no text, no wordmark in this version
- MUST remain legible at 16×16 pixels: bold shapes, no thin strokes,
  no fine details, generous negative space around the mark
- Square canvas with ~10% padding around the mark

DELIVERABLE: one 1024×1024 PNG with transparent background.
```

## Sau khi có ảnh

- Lưu vào `tmp/tihoka-logo/` (gitignored) hoặc `docs/design-system/`
- Em resize: 16/32/48/128 PNG → `public/icons/icon-*.png`
- Thêm `"32": "public/icons/icon-32.png"` vào `manifest.json` icons
- `npm run build` verify + load lên Chrome thật check 16px readability
