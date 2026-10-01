# Intent: Quản lý Đồng bộ trạng thái Anki ↔ Tihoka

> Slug: `anki-known-seed` · Mode: interactive · Source: backlog row #18 (idea-grab 2026-10-01; jpdb.io Anki import + jiten known→Mastered precedent) — **scope expanded by user**: từ one-time seed → đồng bộ trạng thái hai chiều realtime giữa Anki ↔ wordStatus ↔ Tihoka SRS
> ui_surface: yes
> confidence: medium

## Business Case

| Concept | Statement | Evidence | Confidence |
|---|---|---|---|
| Need | Immersionist dùng Anki bên cạnh Tihoka có hai "sự thật" về từ đã biết — chúng drift: Anki biết nghìn từ mature nhưng extension highlight mọi thứ như từ lạ; học trong Tihoka SRS không phản ánh về Anki | user direction 2026-10-01; verified: `ankiImport` không ghi `wordStatus` nào | high |
| Change | Hiện: import Anki chỉ mang card + FSRS state sang SRS, status list rỗng. Tương lai: trạng thái từ hợp nhất — Anki/Tihoka SRS thay đổi gì thì wordStatus đổi theo, và mark `known` ở Tihoka write-back sang card Anki | user direction; `wordStatusClient.setWordStatus`, `connectAdapter` | high |
| Solution | Một status-sync bridge: (a) rules map trạng thái card → wordStatus (thêm status `learning`), (b) Anki addon push event cho realtime + poll/manual sync fallback, (c) write-back mark mature qua AnkiConnect, (d) conflict bằng last-write-wins theo timestamp có provenance | user chọn: addon push + mark mature ivl≥21 + upgrade tracking→known | high |
| Value | Coverage score / i+1 / adaptive subtitles đúng ngay cho user Anki; một nguồn truth về "từ đã biết" khỏi phải mark tay ở hai nơi | jpdb.io/jiten.moe chứng minh giá trị coverage-đúng-từ-đầu | high |
| Stakeholder | Immersionist đã/đang dùng Anki (Anh là persona đầu tiên) | backlog source jpdb+jiten | high |
| Context | MV3 local-first; AnkiConnect localhost:8765 đã tích hợp (`ankiImport/adapters/connectAdapter.ts`); wordStatus trong sync domain (Drive) — seed xong tự đồng bộ thiết bị | `src/features/dictionary/sync/dictLocalSource.ts:390` | high |

## Stakeholders

| Group | Who | Their need re: this change | Capability/constraint |
|---|---|---|---|
| Team | Cell maintainer | Build 3 chiều sync + status mới + Anki addon | Anki addon = codebase thứ hai (Python) + kênh phân phối riêng; AnkiConnect version drift |
| Customer | Immersionist có deck Anki | Không mark tay; trạng thái nhất quán mọi nơi | Cần cài addon thủ công — friction, phải degrade êm khi chưa cài |
| Supplier/Dependency | AnkiConnect (localhost HTTP, no push), Anki addon API (Python hooks) | Push events, `setSpecificValueOfCard` cho mark-mature | Anki không có native push — addon bắt buộc cho realtime; `setSpecificValueOfCard` version-sensitive [verify SPECIFY] |
| Organization | Repo + release channel | Addon ship như artifact nào (zip trong release? AnkiWeb?) | Chưa có precedent — quyết ở SPECIFY |
| Regulator | Bản quyền dữ liệu user — write-back vào collection Anki có thể corrupt scheduling | legal/operational | Anki auto-backup; write-back phải opt-in + log undo-able; test trên collection clone |

## Needs

| ID | Need | FURPS+ | Evidence/`[assumption]` | Confidence |
|---|---|---|---|---|
| N1 | Map trạng thái card Anki → wordStatus theo rules rõ ràng (new/learn/day-learn/buried/review<21d → `learning`; review ivl≥21d → `known`; suspended → không đụng) | F | `NormalizedAnkiCard.queue/ivl/memoryState` (`model/normalized.ts:44-53`); user-approved mapping draft | high |
| N2 | Status `learning` mới trong wordStatus vocabulary — biểu "đang học" khác `tracking` | F, U | hiện statuses: unknown/tracking/known/ignore (`wordStatusStore.ts`); user direction "chuyển thành learning (hệ thống đang không có)" | high |
| N3 | Tihoka SRS card state → wordStatus (card tồn tại chưa mature → `learning`; mature → `known`) — "tihoka study memory" cũng là nguồn truth | F | `entities/srs` FSRS memory_state + revlog | high |
| N4 | wordStatus `known` → write-back Anki card mark mature (ivl≥21, queue=review) | F | user chọn mark mature; AnkiConnect `setSpecificValueOfCard`/`suspend` [verify API surface ở SPECIFY] | medium |
| N5 | Realtime: Anki addon push events (review/edit/add) → extension; fallback poll định kỳ + manual sync + post-import khi addon vắng | F, R | user chọn addon push; AnkiConnect no-push constraint | medium — addon feasibility cần spike |
| N6 | Conflict: last-write-wins theo timestamp + provenance (nguồn ghi cuối) chống echo loop A→B→A | R | user direction "nhìn vào thời gian để biết trạng thái nào cập nhật cuối"; `WordStatusEntry.updatedAt`; Anki card `mod` | medium — clock skew + Anki `mod` granularity (giây) cần xử lý |
| N7 | Upgrade path: tracking→known khi mature; không bao giờ downgrade known | R | user chọn "Upgrade tracking→known" | high |
| N8 | Người dùng thấy trạng thái sync (last sync, số thay đổi, addon connected?) | U | surface cần nơi hiển thị | medium |

## Scope

- **In:** rules-engine map 3 chiều (Anki ↔ wordStatus ↔ Tihoka SRS); status `learning` mới xuyên suốt (tokenize color, status-key cycle, vocabulary browser, sync schema); AnkiConnect write-back mark-mature opt-in; mini Anki addon push events (polling + manual + post-import fallback); LWW provenance store; sync status surface; migration cho status vocabulary.
- **Out:** sửa semantic các status sẵn có; Anki→wordStatus cho clozes/suspended (suspended bỏ qua); realtime khi Anki tắt (bất khả thi — poll resume sau); tự tạo card Anki khi Tihoka có từ Anki chưa có (chỉ đổi state card đã tồn tại).
- **Non-goals:** thay thế SRS engine bằng Anki (hai hệ vẫn độc lập, chỉ đồng bộ trạng thái từ); import lại toàn bộ collection mỗi lần sync; conflict UI merge tay.

## Workflow

Ba nguồn truth (Anki collection qua AnkiConnect, Tihoka SRS qua `entities/srs`, wordStatus qua `langWordStatus`) được bridge bởi một sync service chạy trong background SW. Chiều vào: addon Anki push event (hoặc poll định kỳ/manual/post-import) → đọc card states của các term đã biết liên quan → rules engine → ghi wordStatus (chỉ khi rule-outcome khác hiện tại và provenance timestamp mới hơn). Chiều ra: user mark status trong Tihoka (subtitle/web/vocabulary) → nếu status=known và Anki có card từ đó → write-back mark mature qua AnkiConnect. Tihoka SRS state change (review qua, card mature) → cùng rules engine → wordStatus. Mọi ghi status đều stamp provenance (source + timestamp) — ghi do sync sinh ra không trigger lại sync (echo suppression). User xem trạng thái sync + bật/tắt write-back trong settings; addon chưa cài → banner hướng dẫn, sync vẫn chạy qua poll/manual.

## Journey

### AS-IS
1. User import deck Anki 5k từ vào Tihoka SRS → cards và FSRS state chuyển qua, nhưng `langWordStatus` vẫn rỗng.
2. Xem video: mọi token highlight như từ lạ → comprehension score báo 40% dù thực tế ~95% → i+1 queue và adaptive subtitles đều sai.
3. User học từ trong Tihoka SRS; bên Anki card cùng từ vẫn coi là mới/đang học → hai nơi review trùng hoặc lệch nhau.
4. Muốn sửa phải mark tay từng từ một trong vocabulary browser — nghìn từ = bất khả thi.

### TO-BE
1. User cài Anki addon (một lần) hoặc bấm sync; extension đọc card states → `learning`/`known` được ghi vào wordStatus theo rules.
2. Xem video: coverage đúng ngay, highlight chỉ còn từ thật sự lạ; từ đang học hiện màu `learning`.
3. User mark `known` một từ trong Tihoka → card Anki tương ứng tự chuyển mature; ngược lại review xong một card trong Anki → từ đổi status trong Tihoka gần như ngay lập tức (push) hoặc poll kỳ sau.
4. Edge: Anki tắt → poll skip êm, resume khi mở lại; hai nơi cùng đổi → timestamp mới nhất thắng; write-back thất bại → log + retry sau, không crash flow mark status.

## Stories

- S1: As an immersionist dùng Anki, I want từ tôi đã học trong Anki tự biết là đã biết trong Tihoka so that coverage/highlight đúng từ ngày đầu — done when sau sync, mọi term có card mature hiện `known` mà không cần thao tác tay.
- S2: As a learner, I want từ đang học (SRS/Anki learning) hiện trạng thái riêng so that tôi phân biệt đang-học vs chưa-biết — done when status `learning` tồn tại và hiển thị xuyên suốt (tokenize, vocabulary, panel).
- S3: As an immersionist, I want mark known ở Tihoka cập nhật card Anki so that tôi không phải sửa ở hai hệ — done when mark `known` → card Anki mature (opt-in) và thất bại được báo.
- S4: As a user, I want sync tin cậy không vòng lặp và không ghi đè thay đổi mới hơn của tôi so that tôi dám bật nó — done when LWW + provenance chứng minh bằng test hai chiều.

## Risks

| Risk | Type | Impact | Team's ability to respond |
|---|---|---|---|
| Write-back sai corrupt Anki scheduling (ivl/queue inconsistent) | legal/operational | High — mất trust, mất data review | Opt-in default OFF, clone-collection test, Anki auto-backup guidance, undo log |
| Anki addon = codebase Python thứ hai, install thủ công, version drift Anki/AnkiConnect | external | Realtime không hoạt động với một nửa user không cài | Fallback poll/manual vẫn đủ dùng; addon scope tối thiểu (chỉ push event) |
| Echo loop: sync-write status → status-change event → write-back → Anki mod → push → repeat | internal | High — infinite churn | Provenance + origin tag trên mọi ghi; test loop-break |
| `learning` status mới rủi ro ripple: coloring contrast, cycle order, sync schema, migration user data | internal | Medium | Design-system token + schema version bump; migration test |
| LWW với clock khác nhau (Anki mod seconds vs ms) + sync Drive merge | hidden | Sai winner trong race hiếm | Conservative: timestamp + source-priority tiebreak; log conflicts |
| `setSpecificValueOfCard` API đổi giữa AnkiConnect versions | external | Write-back gãy | Capability-detect + degrade sang suspend + cảnh báo |
| User không expect addon cần cài → "realtime" không chạy | human | Feature coi như hỏng | Onboarding rõ: sync vẫn chạy poll; addon chỉ nâng cấp độ trễ |

## Decision

go — user mở rộng scope có chủ đích (bidirectional realtime + SRS bridge), value cao cho persona Anki-heavy; rủi ro lớn nhất (Anki write-back, addon surface) đã có giảm thiểu: opt-in, fallback, provenance. Cost thực XL — backlog cập nhật tương ứng.

## Draft Acceptance Criteria

- [ ] Import/sync Anki → term có card mature (ivl≥21, queue=review) hiện `known`; card learning/new → `learning`; suspended không bị đụng.
- [ ] Từ có SRS card trong Tihoka đổi trạng thái học → wordStatus `learning`/`known` theo cùng rules engine.
- [ ] Mark `known` ở Tihoka + card Anki tồn tại → Anki card thành mature qua AnkiConnect (opt-in setting); lỗi báo rõ, không chặn mark status.
- [ ] Addon Anki push event → status cập nhật không cần thao tác; addon vắng → poll/manual sync vẫn hoạt động.
- [ ] LWW: thay đổi mới hơn thắng bất kể nguồn; sync-write không sinh echo loop (test hai chiều).
- [ ] Status `learning` có màu/token riêng, trong status-key cycle, vocabulary browser, và sync Drive round-trip.
