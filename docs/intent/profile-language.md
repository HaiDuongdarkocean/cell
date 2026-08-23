# Intent: Language Profile

## Confirmed intent

- **Tính năng:** Quản lý **Language Profile** trong Cell.
- **Vị trí Settings:** `Settings → Profile Language card`.
  - **Universal Native language** ở trên cùng (global option, một tài khoản/ một người dùng).
  - Danh sách **Language Profile** hiển thị dạng card.
- **Nội dung một profile:**
  - **Native** — mặc định theo universal Native language, cho phép override trong profile.
  - **Target** — bắt buộc khi tạo.
  - Tên tự sinh `Native → Target`.
  - Cài đặt theo target:
    - `selectedSubtitleLanguages`
    - `subtitleOverlayTargetStyle` / `subtitleOverlayNativeStyle`
    - `subtitleOverlayAutoLoad` / `subtitleOverlayAutoLoadAsr` / `subtitleOverlayAutoTranslate`
    - `dictionaryPopup` settings (enabled, trigger, default tabs, TTS, external dict links, size, badge)
    - Danh sách tài nguyên **Dictionary/Frequency** đã import được gắn với profile.
- **Thao tác:** thêm / sửa / xóa / kéo thả sắp xếp / chọn active.
  - Thêm mới: chọn Target, sau đó chọn **Clean** hoặc **Duplicate hoàn toàn** từ profile active.
- **Universal panel:** Nút cờ của Target language active ở đầu sidebar; nhấn → mở danh sách profile → chọn profile khác để active đổi.
- **Danh sách ngôn ngữ:** ISO 639-1, có thể mở rộng ISO 639-3 sau.
- **Lưu trữ:** `chrome.storage.local`, MV3.
- **Out of scope:** multi-user, backend sync, ISO 639-3 đầy đủ, global settings (`concurrentDownloads`, `defaultQuality`, `convertToMp4`, `navCluster`, `subtitleBlock`, `keyboardShortcuts`).
- **Ràng buộc:** responsive, <3s, FSD, named export, no `any`, SSOT components/tokens.
