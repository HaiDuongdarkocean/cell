# Design System — Socratic Q&A

> Ghi lại các câu hỏi Socratic và best practice để thấm nhuần design system.
> Nguồn: Figma blog "Design Systems 101: What is a design system?" + định nghĩa:
> "A design system is a collection of reusable components, guided by clear standards,
> that can be assembled together to build any number of applications."

---

## Q1 — Why "guided by clear standards"?

**Câu hỏi:**
Tại sao lại là `guided by clear standards`, mà không chỉ đơn giản là `a collection of reusable components`?
Standards đóng vai trò gì mà không thể thiếu?

**Trả lời ngắn (từ session):**
> là luận lệ để tất cả cùng đồng nhất với nhau

**Best practice / principle:**
- Standards là **ngôn ngữ chung** giữa design, eng, product, content — không chỉ là "rule" cứng nhắc.
- Nó trả lời câu hỏi: *khi nào dùng cái này, dùng như thế nào, với ai, ở đâu, tại sao*.
- Reusable components không có standards = hộp LEGO đầy mảnh ghép nhưng không có sách hướng dẫn: mỗi người ráp một kiểu, cuối cùng vẫn rối.

**Ponytail / ceiling:**
- Standards quá nhiều/thiếu context sẽ gây adoption kém. Cần đi kèm ví dụ thực tế (do/don't) và lý do (why), không chỉ liệt kê.

---

## Q2 — What if we only have components, no standards?

**Câu hỏi:**
Nếu team chỉ có một bộ **reusable components** đẹp, đầy đủ, nhưng lại **thiếu clear standards**
— ví dụ không có quy định khi nào dùng button chính, khi nào dùng button phụ,
không có spacing scale, không có nguyên tắc accessibility — thì sản phẩm cuối cùng
có thể vẫn rối và không đồng nhất được không? Tại sao?

**Clarification (câu hỏi lại từ learner):**
> spacing scale và nguyên tắc accessibility là gì

**Giải thích:**
- **Spacing scale**: bộ khoảng cách cố định (ví dụ 4, 8, 12, 16, 24, 32, 48px) cho margin/padding/gap. Tránh tùy tiện 13px ở chỗ A, 17px ở chỗ B.
- **Accessibility principles**: WCAG contrast, touch target ≥44×44px, focus visible, reduced motion, alt text, semantic HTML, keyboard navigation — để mọi người đều dùng được.

**Câu hỏi 2 (rephrased):**
Nếu team có sẵn 50 components đẹp trong Figma, nhưng không có spacing scale, không có quy định contrast, không có hướng dẫn "button chính chỉ dùng 1 trên màn hình" — thì 2 designer ghép cùng 1 màn hình có thể cho ra 2 kết quả khác nhau không? Điều đó làm gì ảnh hưởng đến user?

**Trả lời:**
> có vì một người sẽ làm chỉnh chu biết khi nào thì dùng compoent phù hợp, có spacing scale và accessibility principles còn người kia design một khiểu không theo quy tắc chỉ có màn hình đẹp điều đó dẫn tới bất tiện cho người dùng và khiến sản phẩm bị người dùng tẩy chay

**Best practice / principle:**
- Component là **công cụ**; standard là **cách dùng công cụ đúng**.
- Thiếu standards → mỗi người tự hiểu một kiểu → **design drift** → UX không nhất quán → user mất trust, thậm chí bỏ sản phẩm.
- Một màn hình "đẹp" nhưng không accessible, không rõ hierarchy, không nhất quán với phần còn lại của app vẫn là **thiết kế thất bại**.

**Best practice / principle (dự kiến):**
- Thiếu standards dẫn đến **drift**: cùng một component được dùng sai context, sai trạng thái, sai khoảng cách, sai color intent.
- Consistency không đến từ component, mà đến từ **cách dùng component**.
- Đây là lý do design system phải có **documentation** như một phần không tách rời — không chỉ là Figma component hay code package.

---

## Q3 — Classify Cell pieces into design-system hierarchy

**Câu hỏi:**
Trong codebase Cell:
- `src/shared/styles/tokens.json`
- `src/shared/ui/` (Button, Card, Input, Dialog...)
- `src/shared/icons/index.ts`
- `src/features/*/ui/` (popup dictionary, subtitle panel, card creator...)

Mỗi cái thuộc tầng nào trong hierarchy design system? Và nếu thiếu `tokens.json` thì `src/shared/ui/` gặp vấn đề gì?

**Trả lời:**
> component thiếu token.json thì màu sắc sẽ không có ngôn ngữ chung

**Best practice / principle (bổ sung phân loại):**
- `tokens.json` → **Foundational elements** (color, spacing, typography, radius, shadow — visual language).
- `icons/index.ts` → **Foundational elements** (iconography + catalog rule: không inline SVG, reuse từ catalog).
- `src/shared/ui/` → **Component & pattern libraries** (reusable UI components + usage notes).
- `src/features/*/ui/` → **Product/Application layer** — nơi *lắp ráp* components theo business flow; nằm ngoài DS nhưng phải tuân theo DS.
- Top-level **Design system** ở Cell = `src/shared/styles/README.md` + `docs/adr/044-design-token-ssot.md` + quy ước trong `AGENTS.md` (principles, processes, SSOT).
- Thiếu `tokens.json` → component không có single source of truth cho color/space/type → mỗi component tự hardcode → drift nhanh → theme/dark mode khó maintain.

## Q4 — Does Cell have a complete design system?

**Câu hỏi:**
Cell đã có tokens, shared/ui, icons, styles README, nhiều ADRs. Nhưng nếu chưa có tài liệu rõ ràng về "khi nào dùng Dialog thay vì Card", "pattern cho flow tải video → chọn phụ đề → hiển thị" — thì Cell đã có design system hoàn chỉnh chưa? Còn thiếu gì?

**Trả lời:**
> chưa có đâu vì khi anh làm hệ thống thì mỗi nơi lại áp dụng một kiểu khác nhau. nút không theo nút. các spcacing đảo lộn

**Best practice / principle:**
- Có tokens + components là **necessary but not sufficient**. Đó là "foundational + library" layer.
- Design system thực sự cần **pattern + usage guidance** — nói rõ *khi nào, ở đâu, tại sao* dùng component nào.
- Hiện tượng "nút không theo nút, spacing đảo lộn" là **design drift** — dấu hiệu thiếu standards/audition, không phải thiếu components.

## Q5 — 3 lazy-senior actions to make Cell's design system real

**Câu hỏi:**
Theo nguyên tắc "lazy senior" — ít code nhất, hiệu quả cao nhất — chọn 3 việc làm đầu tiên để Cell từ "có tokens + components" thành "có design system thực sự".

**Trả lời / chuyển phase:**
> thiết kế từ cơ bản nhất. component được sinh ra bởi các items cơ bản nhất. anh muốn em trình bày các component hiện có tất cả những gì liên quan tới design system lên một trang html và nhớ là cần có hàm để chuyển hóa chúng từ codebase lên html chứ không tạo ra code mới. sau mỗi lần tôi muốn nhìn đánh giá và sửa designsystem thì nó đã có ở đó và không cần phải cập nhật gì. file html sẽ là nơi tôi nhìn tổng quan designsystem. hiện tại trong hệ thống của tôi đang có panel universal, block UI tôi muốn hệ thống có màn hình nào thì đều phải được thể hiện ở trong trang html này.

**Ghi chú phase mới:**
- Task chuyển từ Socratic Q&A sang **design + implement auto-generated design-system showcase HTML**.
- Yêu cầu: tự động sync từ codebase, không tạo code mới cho components, trưng bày tất cả màn hình/panel/block UI.
- Cần `interview-me` để xác định scope, output path, tần suất regenerate, và cách "chuyển hóa" cụ thể.

## Interview Me — Design System Showcase HTML

**HYPOTHESIS:**
Anh yêu muốn một trang HTML duy nhất là single source of truth cho design system của Cell, tự động render components/tokens/icons/panel/block UI từ codebase ra HTML, đặt tại `docs/design-system/design-system-showcase.html`.

**Q1:** Output path?  
**A1:** `docs/design-system/design-system-showcase.html`

**Q2:** Cơ chế chuyển hóa & scope?  
**A2:** Không build phức tạp. File reference hiển thị tất cả: từ components cơ bản → màn hình giao diện → standards — đều ở trong trang HTML.

**Q4:** Hook vào build hay watch?  
**A4:** Hook vào `npm run build`.

**Q5:** Components hiển thị ở mức độ nào?  
**A5:** **D** — tổng hợp tên + props + snippet + **phải render thật**.

**Q6:** Render thật kiểu gì?  
**A6:** **D** — cả component catalog + full-screen/panel preview.

## Implementation — Design System Showcase HTML

Kết quả từ intent:
- File: `docs/design-system/design-system-showcase.html`
- Source: `src/entrypoints/design-system-showcase/`
- Build hook: `vite.config.ts` → `designSystemShowcase()` plugin tự động copy sau `npm run build`
- Mở: `npm run design-system` (chạy `http-server` tại `docs/design-system`)
- Hiển thị:
  - Color tokens (light/dark)
  - Spacing scale
  - Typography scale
  - Icon grid (`ICON_CATALOG`)
  - All `shared/ui` components với variants
  - `UniversalPanel` preview

## Bloom ladder

| Level | Action | Gợi ý câu hỏi tiếp theo |
|-------|--------|--------------------------|
| Remember | Define, list | Design system gồm những tầng nào? |
| Understand | Explain, summarize | Tại sao design system không giết creativity? |
| Apply | Use, classify | Phân loại 5 thành phần Cell vào đúng tầng DS. |
| Analyze | Compare, relate | Component library vs pattern library khác gì? |
| Evaluate | Judge, decide | Cell có cần design system không? Metrics nào? |
| Create | Design, build | Viết mini design system cho Cell (3 principles + tokens + components + pattern). |
