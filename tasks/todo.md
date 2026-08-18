# TODO: Subtitle Manager — Mobile Sheet trên Host Page

## Vấn đề hiện tại
Sheet render trong iframe (75vh của iframe = ~350px = 12% host viewport).
Cần: sheet render trên host page (75vh của host viewport).

## AC phiên làm việc này

### AC-1: Iframe bridge — child → host message
- [ ] Khi manager mở trong iframe và viewport < 768px → child iframe gửi postMessage lên host page
- [ ] Message chứa: `{ type: '__CELL_MANAGER_SHEET_OPEN', frameSrc, managerState }`
- [ ] Host page nhận message, render sheet trên host viewport (top frame)

### AC-2: Host page sheet render
- [ ] Host page content script nhận message → tạo portal trên host document.body
- [ ] Sheet position: fixed, bottom: 0, width: 100vw, height: 75vh của HOST viewport
- [ ] Sheet có drag handle, rounded top corners, slide-up animation
- [ ] Sheet background: solid (không translucent — không cần thấy video phía sau trên mobile)

### AC-3: Close flow
- [ ] Click outside sheet (trên host page) → close
- [ ] Nút X trong sheet → close
- [ ] Close gửi postMessage ngược lại child iframe → child unmount manager state

### AC-4: Desktop iframe vẫn hoạt động
- [ ] Iframe viewport >= 768px → manager render trong iframe (overlay video area) — không đổi
- [ ] Host page không render sheet khi desktop

### AC-5: Same-origin (không iframe) vẫn hoạt động
- [ ] YouTube, themoviebox (không iframe) → manager render bình thường — không bridge

### AC-6: Build + verify
- [ ] Build pass
- [ ] Test trên animekai.be mobile: sheet cover 75vh host viewport
- [ ] Test trên animekai.be desktop: manager overlay video area (không đổi)
