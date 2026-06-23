# Intent: Chrome Extension Video Downloader

## Confirmed Statement of Intent

- **Outcome**: Extension Chrome MV3 tự động detect + download video + subtitle từ free streaming sites, convert m3u8→mp4 và subtitle (.ass/.vtt)→srt, đơn giản hóa flow để người học ngoại ngữ tập trung vào học thay vì technical overhead.
- **User**: Người học ngoại ngữ (personal use + public cho học viên khác).
- **Why now**: Current workflow download thủ công phức tạp (copy link, ffmpeg, yt-dl convert subtitle) quá rườm rà.
- **Success**: Download success 100% cho 2 site test (hoathinh3d, kisskh) + conversion đúng (quality quan trọng).
- **Constraint**: Technical constraint chính là m3u8 conversion complexity và Chrome extension permission (intercept network, download file). Legal constraint secondary (educational purpose). Browser limit không binding.
- **Out of scope**: DRM protected content (Netflix, Disney+) — triển khai sau. Chỉ focus free streaming sites.

## Flow

1. Người dùng cài đặt extension → vào trang web bất kỳ
2. Hệ thống tự động bắt link trang web thường có dạng m3u8 → .ts → convert → mp4 hoặc định dạng sẵn mp4
3. Hệ thống tự bắt link subtitle thường có định dạng .ass, .vtt → convert về srt. Nếu là srt rồi thì giữ nguyên
4. Sau khi convert, hệ thống tải về thiết bị

## Technology

- HTML, CSS, JavaScript
- Kiến trúc sạch, tinh gọn
- Extension điền nội dung vào interface thông qua JS để test auto dễ dàng
- Unit test: Jest
- E2E test: Playwright
- MCP browse để debug: https://developer.chrome.com/blog/chrome-devtools-mcp

## Test Input

- https://hoathinh3d.co/xem-phim-vinh-sinh/tap-1-sv1.html
- https://kisskh.co/Drama/A-Good-Girl-s-Guide-to-Murder---Season-2/Episode-1?id=13070&ep=214612&page=0&pageSize=100&tm=51.0816

## Status

- Intent confirmed: 2026-06-23
- Next step: spec-driven-development (/spec)
