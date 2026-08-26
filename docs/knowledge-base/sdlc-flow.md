# SDLC — Sơ đồ dòng chảy Idea → Khung quy trình → Sản phẩm

> Tài liệu khái niệm cho khách hàng chưa biết nói yêu cầu.
> Bám 3 từ khóa: **Idea → Khung quy trình → Sản phẩm**.
> Quy ước: khách hàng chỉ cần (1) nói idea mơ hồ, (2) trả lời câu hỏi BA, (3) dùng thử và nói cảm nhận. Phần còn lại khung quy trình lo.

## Bức tranh tổng thể

```
┌──────────┐    ┌──────────────────────┐    ┌──────────┐
│   IDEA   │ →  │   KHUNG QUY TRÌNH    │ →  │ SẢN PHẨM │
│ (mơ hồ)  │    │   (SDLC — 7 pha)     │    │(hoàn chỉnh)│
└──────────┘    └──────────────────────┘    └──────────┘
```

Khách hàng chỉ mang **idea** đến. Khung quy trình là cỗ máy biến idea mơ hồ thành sản phẩm — mỗi pha có người làm thay, anh không cần biết diễn đạt yêu cầu.

---

## Giai đoạn 1 — Idea (Khách hàng mang đến)

Giai đoạn **duy nhất khách hàng phải tự làm**, và nó **không cần rõ ràng**.

- Một câu mô tả mơ hồ + cảm giác "tôi muốn cái gì đó".
- Không cần biết nó là app, extension, hay website.
- Không cần viết spec, không cần vẽ wireframe.

| | |
|---|---|
| **Ai làm** | Khách hàng |
| **Output** | Một câu mô tả mơ hồ + cảm giác nhu cầu |
| **Ai giúp** | BA — dùng kỹ thuật elicitation (phỏng vấn, quan sát, prototype) kéo idea ra khỏi đầu khách hàng |

---

## Giai đoạn 2 — Khung quy trình SDLC (7 pha)

Cấu trúc xương sống, áp dụng cho mọi mô hình (Waterfall, Agile, Spiral...).

### Pha 1 — Requirements Gathering (Khai thác yêu cầu)

| | |
|---|---|
| **Ai làm** | BA (Business Analyst) |
| **Làm gì** | Phỏng vấn khách hàng, quan sát, dùng prototype mockup để kéo yêu cầu ra |
| **Output** | **Business Requirements Document (BRD)** — "khách hàng muốn gì" |
| **Ví dụ Cell** | Persona 10-25 tuổi, học ngoại ngữ, cần tải sub song ngữ, máy RAM ≥1GB |

> Pha quan trọng nhất với khách hàng chưa biết nói — BA làm hết, khách hàng chỉ trả lời câu hỏi.

### Pha 2 — Analysis (Phân tích)

| | |
|---|---|
| **Ai làm** | BA + System Analyst |
| **Làm gì** | Quy đổi business requirement → functional requirement (cụ thể, đo lường được) |
| **Output** | **Software Requirements Specification (SRS)** — "phần mềm phải làm gì" |
| **Ví dụ Cell** | "Tải sub" → "Hỗ trợ .srt/.vtt/.ass; merge vào video; detect ngôn ngữ tự động" |

### Pha 3 — Design (Thiết kế)

| | |
|---|---|
| **Ai làm** | Architect / Tech Lead + UX Designer |
| **Làm gì** | Thiết kế architecture (HLD) + chi tiết (LLD) + UI/UX mockup |
| **Output** | **Architecture document + Design system + Wireframe** |
| **Ví dụ Cell** | MV3 extension, Shadow DOM isolation, design system tokens, popup UI responsive |

> Khách hàng có thể tham gia: review mockup, nói "thấy thế nào" — vẫn không cần nói kỹ thuật.

### Pha 4 — Implementation / Coding (Phát triển)

| | |
|---|---|
| **Ai làm** | Developer |
| **Làm gì** | Viết code theo design |
| **Output** | **Source code** |
| **Ví dụ Cell** | Background SW, content script, popup, subtitle parser |

> Khách hàng không tham gia — pha thuần kỹ thuật.

### Pha 5 — Testing (Kiểm thử)

| | |
|---|---|
| **Ai làm** | QA / Tester |
| **Làm gì** | Kiểm tra code có khớp requirement không: unit test, integration test, UAT |
| **Output** | **Test report + Bug list** |
| **Ví dụ Cell** | Test tải sub trên 5 site, test trên máy RAM 1GB, test responsive |

> Khách hàng tham gia UAT (User Acceptance Testing) — dùng thử, nói "được/không được". Vẫn không cần nói kỹ thuật.

### Pha 6 — Deployment (Triển khai)

| | |
|---|---|
| **Ai làm** | DevOps / Release Manager |
| **Làm gì** | Đưa sản phẩm lên môi trường production |
| **Output** | **Sản phẩm chạy thật** |
| **Ví dụ Cell** | Publish lên Chrome Web Store, Edge Add-ons, Brave store |

### Pha 7 — Maintenance (Bảo trì)

| | |
|---|---|
| **Ai làm** | Toàn team |
| **Làm gì** | Sửa bug, tối ưu, thêm feature theo feedback |
| **Output** | **Bản update** |
| **Ví dụ Cell** | Fix site đổi DOM, thêm site mới, tối ưu RAM |

---

## Giai đoạn 3 — Sản phẩm (Hoàn chỉnh)

Sản phẩm cuối cùng có 3 đặc tính:

1. **Usable** — khách hàng dùng được (đã qua UAT)
2. **Valuable** — giải quyết đúng pain point (đã qua BA analysis)
3. **Maintainable** — team duy trì được (đã qua design + testing)

---

## Sơ đồ dòng chảy đầy đủ

```
IDEA (mơ hồ)
  │  Output: 1 câu mô tả mơ hồ + cảm giác nhu cầu
  │  Ai làm: Khách hàng (BA hỗ trợ elicitation)
  │
  ▼
┌─────────────────────────────────────────────────────────────┐
│  KHUNG QUY TRÌNH SDLC                                        │
│                                                              │
│  Pha 1 — Requirements Gathering                              │
│    Ai làm: BA                                                │
│    Output: Business Requirements Document (BRD)              │
│       │                                                      │
│       ▼                                                      │
│  Pha 2 — Analysis                                            │
│    Ai làm: BA + System Analyst                               │
│    Output: Software Requirements Specification (SRS)         │
│       │                                                      │
│       ▼                                                      │
│  Pha 3 — Design                                              │
│    Ai làm: Architect / Tech Lead + UX Designer               │
│    Output: Architecture doc + Design system + Wireframe      │
│       │                                                      │
│       ▼                                                      │
│  Pha 4 — Implementation / Coding                             │
│    Ai làm: Developer                                         │
│    Output: Source code                                       │
│       │                                                      │
│       ▼                                                      │
│  Pha 5 — Testing                                             │
│    Ai làm: QA / Tester (+ khách hàng UAT)                    │
│    Output: Test report + Bug list                            │
│       │                                                      │
│       ▼                                                      │
│  Pha 6 — Deployment                                          │
│    Ai làm: DevOps / Release Manager                          │
│    Output: Sản phẩm chạy thật                                │
│       │                                                      │
│       ▼                                                      │
│  Pha 7 — Maintenance                                         │
│    Ai làm: Toàn team                                         │
│    Output: Bản update                                        │
└─────────────────────────────────────────────────────────────┘
  │
  ▼
SẢN PHẨM (hoàn chỉnh)
  Đặc tính: Usable + Valuable + Maintainable
```

---

## Bảng tổng hợp — Khách hàng phải làm gì ở mỗi pha

| Pha | Khách hàng phải làm | Ai làm thay |
|---|---|---|
| **Idea** | Nói mơ hồ 1 câu | — |
| **1. Requirements** | Trả lời câu hỏi của BA | BA khai thác |
| **2. Analysis** | Không cần làm | BA + System Analyst |
| **3. Design** | Review mockup, nói "thích/không thích" | UX Designer |
| **4. Coding** | Không | Developer |
| **5. Testing** | Dùng thử, nói "được/không" (UAT) | QA |
| **6. Deployment** | Không | DevOps |
| **7. Maintenance** | Báo bug khi gặp | Team |

Khách hàng **chỉ cần làm 3 việc**: nói idea mơ hồ → trả lời câu hỏi BA → dùng thử và nói cảm nhận. Phần còn lại khung quy trình lo.

---

## BA vs PO vs TL — ranh giới

- **BA** — *hiểu đúng business*, dịch requirement. **Không** quyết định priority, **không** quyết định architecture.
- **PO (Product Owner)** — *quyết định* priority, scope, ROI. Dựa trên output của BA.
- **TL (Tech Lead)** — *quyết định* cách build, architecture, tech stack. Dựa trên requirement của BA.

Trong team nhỏ, một người thường wear nhiều hat — nhưng **vai trò BA vẫn tồn tại như một trách nhiệm**, không phải một vị trí riêng.

> Lỗi đắt nhất là lỗi requirement — build đúng một thứ không ai cần. BA ngăn lỗi đó ở giai đoạn rẻ nhất: **trước khi viết dòng code đầu tiên**.
