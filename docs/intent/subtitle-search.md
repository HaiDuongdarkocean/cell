# Intent: Subtitle Search

## Confirmed statement of intent

- **Outcome:** User có thể search subtitle từ nguồn bên ngoài ngay trong SubtitleManagerPanel khi video không có subtitle (hoặc khi muốn thay subtitle khác)
- **User:** Persona 10-25 tuổi xem video đa dạng nguồn, gặp video không có subtitle hoặc muốn subtitle khác
- **Why now:** Hiện tại extension chỉ detect subtitle từ trang video; không có fallback khi trang không có subtitle
- **Success:** User gõ tên phim + chọn ngôn ngữ → nhận danh sách subtitle → click → subtitle load vào overlay và hoạt động như track thường
- **Constraint:**
  - 1 section search chung cho cả target + native (không per-section)
  - Nút search **luôn hiển thị**, kể cả khi đã có subtitle
  - Nguồn: **SubDL primary** (free 50 download/ngày) + **OpenSubtitles fallback** (free 5-20 download/ngày, kho lớn nhất)
  - Power user: nhập **API key riêng** trong Settings → quota cao hơn (SubDL Pro $5/mo = 2.000 download/ngày, OpenSubtitles VIP $20/năm = 1.000 download/ngày)
  - Extension là client-only, không bundle key chung, không billing
- **Out of scope:**
  - AI translation (SubDL/OpenSubtitles đều có nhưng trả phí thêm)
  - Search bằng file hash / IMDb ID (chỉ search by name + language)
  - Self-hosted sources (subscrape, MySubs)
  - Multi-source dedup / merge kết quả (SubDL-first, OpenSubtitles chỉ khi SubDL không có kết quả)

## Sources researched

| Source | API type | Search by name | Free tier | Power tier |
|--------|----------|---------------|-----------|------------|
| OpenSubtitles (REST) | REST JSON | `query=movie name` + `languages=en,vi` | 5-20 download/ngày | VIP $20/năm = 1.000 download/ngày |
| SubDL | REST JSON | `GET /api/v2/subtitles/search?film_name=...&languages=en,vi` | 2.000 search + 50 download/ngày | Pro $5/mo = 30.000 search + 2.000 download/ngày |
| Wyzie Subs | REST JSON | IMDb/TMDB ID only (no name search) | 1.000 req/ngày | Pro plans |
| subscrape | Self-hosted | IMDb ID only | Free (self-hosted) | — |
| MySubs | REST JSON | `/search?s=title&lang=en` | Free | — |

## Decision

- SubDL primary (free tier đủ cho persona, search by name OK)
- OpenSubtitles fallback (kho lớn nhất, khi SubDL không có kết quả)
- User nhập API key riêng trong Settings cho power user tier
