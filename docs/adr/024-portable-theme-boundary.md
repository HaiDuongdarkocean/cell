# ADR-024: Component-level `data-theme` boundary for portable content-script UI

> Date: 2026-07-10
> Status: Accepted
> Amends: ADR-022 D4 (Content-script inject customColors)

## Context

ADR-022 quyết định theme token cho content-script được inject thành `<style>` global và `data-theme` attribute đặt trên video container. Mọi component con (nav cluster, overlay, manager panel, toast) đều kế thừa token từ container.

Bug phát hiện: `NavClusterController` khi fullscreen re-parent cluster sang `document.fullscreenElement` (có thể là `HTML` hoặc một player element khác với container). Khi đó cluster rời khỏi container, mất `data-theme` context, rơi về `:root` light fallback → đổi từ dark sang light.

## Decision

1. **Content-script theme boundary = component root, không chỉ container.**
   - Mọi component có khả năng được re-parent (hoặc có thể rời container) phải tự mang `data-theme` attribute trên root element.
   - Container vẫn giữ `data-theme` như boundary mặc định cho các component tĩnh.

2. **Thêm `syncElementTheme(element, container)` helper trong `themeTokens.ts`.**
   - Sync `container` `data-theme` sang `element` ngay lập tức.
   - Dùng `MutationObserver` theo dõi `data-theme` attribute của `container` và cập nhật `element` realtime.
   - Trả về cleanup function.

3. **Tách static tokens ra `:root`, color tokens chỉ bind với `[data-theme]`.**
   - `:root` chỉ chứa static tokens (font, spacing, radius, nav-cluster static).
   - `[data-theme="light"]` chứa light color tokens.
   - `[data-theme="dark"]` chứa dark color tokens.
   - Giúp color boundary rõ ràng: element không có `data-theme` sẽ dùng fallback trong component CSS, không bị ép light bởi `:root`.

## Alternatives Considered

- **Container-only (ADR-022 hiện tại):** Đơn giản nhưng lỗi khi component rời container. Từ chối.
- **Inline CSS variables trên mỗi component:** Tự chứa, không cần `data-theme`, nhưng phải set 20+ variables mỗi lần theme đổi, code nặng. Từ chối.
- **Shadow DOM:** Cách ly style tốt, nhưng phức tạp với positioning, drag, z-index trong page. Từ chối.

## Consequences

- Positive: cluster và các portable component luôn đúng theme dù được re-parent; không cần refactor component khác.
- Positive: `themeTokens` style rõ ràng hơn, không cần `:root` light fallback.
- Negative: thêm `MutationObserver` trên mỗi portable element; chỉ số nhỏ, dùng `attributeFilter` nên hiệu năng không đáng kể.
- Neutral: `data-theme` xuất hiện trên nhiều element hơn, có thể dùng làm selector trong test.

## Migration

- `navClusterController.ts` gọi `syncElementTheme(cluster, container)` trong `init()` và `destroy()` cleanup.
- Các component khác nếu cần re-parent tương lai chỉ cần gọi `syncElementTheme`.
