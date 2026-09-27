# Intent: User data sync — auto-sync toàn bộ dữ liệu lên Google Drive

> Slug: `user-data-sync` · Mode: interactive · Source: user statement — "tôi muốn có nơi lưu trữ tự động sync các dữ liệu của tôi như là dữ liệu các list tôi đang học, dữ liệu dictionary đã cài đặt, các config cần thiết cho những profile ngôn ngữ tôi đang dùng, và cả config chung của hệ thống"
> ui_surface: yes          ← auth connect + sync status + error surfacing là user-visible
> confidence: medium

## Business Case

| Concept | Statement | Evidence | Confidence |
|---|---|---|---|
| Need | Toàn bộ dữ liệu học tập + config chỉ sống trong local storage của 1 máy/1 browser profile — reinstall, máy mới, hoặc dùng 2 máy song song = mất SRS progress + word status (không thể rebuild) và phải setup lại profiles/dictionaries/config từ đầu | `src/features/srs/repositories/srsDatabase.ts:12-22` (SRS IndexedDB); `src/features/dictionary/repositories/baseRepository.ts:13-20` (dict IndexedDB per lang); `src/shared/lib/storage/settingsStore.ts:590,657` (settings trong chrome.storage.local); không tồn tại export/backup/sync nào trong `src/` | high |
| Change | Local-only persistence → dữ liệu replicate tự động lên Google Drive `appDataFolder` của chính user, merge được giữa nhiều máy; mỗi language profile bind vào 1 Google account (1 Drive cho mọi profile, hoặc mỗi profile 1 Drive riêng) | user answers 2026-09-27: backend=Drive, dict=full content, pattern=multi-device active, binding per profile | high |
| Solution | Một sync engine trong background (SW) + Drive REST backend, **multi-account**: mỗi profile có 1 sync account (tất cả trỏ cùng account = mode "1 Drive cho nhiều profile"); global config đi vào 1 **system account** do user chọn; settings/config sync dạng snapshot, SRS + dict IndexedDB dạng per-entity delta có merge policy; auth một đường cho cả 2 browser qua `identity.launchWebAuthFlow` + token per account (`getAuthToken` chỉ trả account đang sign-in Chrome → không phục vụ được multi-account) | user chọn Drive + binding per profile; `manifest.json` chưa có `identity` permission — phải thêm | medium |
| Value | Không mất tiến trình học khi đổi máy/cài lại; học liền mạch trên nhiều máy; zero setup lại | user statement + journey AS-IS | high |
| Stakeholder | Người học dùng Cell trên >1 máy hoặc muốn an toàn dữ liệu; Anh (product owner + sole dev) | user statement | high |
| Context | MV3 Chrome + Firefox port đã shipped (`docs/intent/firefox-port.md`); không có backend server; Drive `appDataFolder` scope = `drive.appdata` (least-privilege, hidden folder, tính vào quota Drive của user); dict data order 10s–100s MB/ngôn ngữ `[assumption]`; SRS assets quota mặc định 50+50MB (`config.ts:232-237`); MV3 SW bị evict → upload lớn phải resumable/chunked | `manifest.json` permissions; `docs/specs/firefox-port.md` | medium |

## Stakeholders

| Group | Who | Their need re: this change | Capability/constraint |
|---|---|---|---|
| Team | Anh + agents | Sync engine build được trong extension, không cần server riêng; verify được cả 2 browser | Drive REST API thuần fetch — không dependency nặng; IndexedDB repositories đã tách layer (`repositories/`) làm seam tự nhiên cho delta hooks. **Anh phải tự tạo Google Cloud project + OAuth client ID + consent screen** (cần account của Anh — agent chỉ viết hướng dẫn) |
| Customer | Người học đa thiết bị / reinstall | Data theo họ tới mọi máy; sync "tự chạy" không cần hiểu kỹ thuật | Persona 5–80 tuổi → flow connect phải 1–2 click, lỗi phải nói ngôn ngữ người |
| Supplier/Dependency | Google Drive API v3 (`drive.appdata` scope); `identity.launchWebAuthFlow` (Chrome + Firefox) | Ổn định, quota Drive của chính user, nhiều account cùng lúc | `launchWebAuthFlow` có trên cả 2 browser → 1 auth path; phải tự quản token/refresh per account; Drive rate limit ~10 req/s mỗi user — phải batch/chunk |
| Organization | Maintainers tương lai | Serialization format versioned, merge policy documented, không khóa chặt vào Drive (backend interface) | Mỗi schema/settings migration sau này phải nghĩ tới wire format sync |
| Regulator | Chrome Web Store + AMO policy | `identity` + OAuth scope cần justification; privacy disclosure cho data rời máy user | `drive.appdata` là scope hẹp nhất, data chỉ vào Drive của user — nhưng vẫn phải khai trong privacy practices; AMO review đọc data-collection declaration |

## Needs

| ID | Need (statement) | FURPS+ | Evidence/`[assumption]` | Confidence |
|---|---|---|---|---|
| N1 | SRS study data (collections/decks/studyConfigs/notetypes/notes/cards/reviewEvents + audio/image assets) tồn tại trên mọi máy user | F | `srsDatabase.ts:12-22`; user: "các list tôi đang học" | high |
| N2 | Dictionary đã cài (entries/frequency/phraseIndex/wordStatus/wordTrash) theo user tới máy mới mà không cần file gốc | F | `baseRepository.ts:13-20`; user chọn "Full nội dung" | high |
| N3 | Language profiles + toàn bộ `settings` đồng nhất giữa các máy; profile đang dùng (`activeProfileId`) là lựa chọn riêng của từng máy | F | `types.ts:347-349` (profiles nằm trong settings object); user: "config cho những profile ngôn ngữ"; owner 2026-09-27 chọn active profile "Riêng từng máy" | high |
| N4 | Secondary local keys (theme, tokenize, OCR prefs, studyModes, auto-download whitelist) cũng sync | F | `config.ts:344-392` STORAGE_KEYS; user: "config chung của hệ thống" | medium |
| N5 | Sync tự động — mutation-triggered + periodic + on-startup, không bước export tay | R | user: "tự động sync" | high |
| N6 | Multi-device merge — concurrent edits không destroy lặng lẽ: reviewEvents/notes merge theo id (append-only), wordStatus LWW-per-term, config LWW-per-slice | R | user chọn "Multi-device active" | high |
| N7 | Data chỉ nằm trong Drive `appDataFolder` của chính user — coi đó là trust boundary; `subtitleApiKeys` sync bình thường như config khác | +security/privacy | user 2026-09-27 chọn "Sync bình thường"; `config.ts:320`; OAuth scope `drive.appdata` | high |
| N8 | User thấy được trạng thái sync (last synced, đang sync, lỗi) + manual "sync now" + disconnect | U | cần thiết cho multi-device trust; persona 5–80 | medium |
| N9 | Delta/incremental sync + chunked upload — không re-upload full DB mỗi thay đổi; resumable qua SW eviction | P | MV3 SW eviction (`background/index.ts:372` pattern session storage vì SW chết); dict size assumption | medium |
| N10 | Chạy được cả Chrome và Firefox qua cùng một Drive backend | S | user: "phải chạy được cả hai vì dùng drive"; `firefox-port` shipped | high |
| N11 | User chọn được 1 Google Drive cho mọi profile hoặc Drive riêng cho từng profile — dữ liệu của mỗi profile chỉ vào account nó bind | F/+privacy | user 2026-09-27: "1 google drive cho nhiều profile hoặc 1 google drive cho 1 profile"; data per-profile partition được: `types.ts:268-285` (LanguageProfile), SRS index `by_languageProfileId` (`srsDatabase.ts:26`) | high |
| N12 | Config global (không thuộc profile nào) có đúng 1 nơi sync — system account do user chọn, mặc định = account connect đầu tiên, đổi được | F/R | user chọn "1 account hệ thống"; global fields: `types.ts:335-349` + STORAGE_KEYS `config.ts:344-392` | high |
| N13 | Đổi account của 1 profile sau khi đã sync → data profile được migrate sang Drive mới, Drive cũ giữ nguyên (user tự xoá) | F/R | user chọn "Đổi được, migrate data" | high |
| N14 | Profile được xác định bằng target language — mỗi target đúng 1 profile; native chỉ là thuộc tính để dịch. Nhờ vậy dict/wordStatus (`orca-dict-{hash}-{target}`) + SRS collection + profile config thuộc trọn 1 profile → đơn vị sync = profile, không còn resource dùng chung giữa các account | F/S | user 2026-09-27: "hệ thống chỉ quan tâm target… native chỉ là để dịch… chuyển nó thành profile"; hiện `profileResolution.ts:68-73` chỉ chặn trùng target+native → phải đổi thành chặn trùng target; `baseRepository.ts:36-38` DB đã key theo target | high |
| N15 | Profile trùng target có sẵn (khác native) được gộp an toàn: gộp profile config (profile active/mới nhất thắng), gộp SRS collections theo `languageProfileId`, không mất card/reviewEvent nào | R | `collectionRepository.ts:31-37` (SRS query theo `languageProfileId`); `firstRunService.ts:25-50` | medium |
| N16 | Xoá ở một máy (profile, dict, card, word) lan sang các máy khác — data đã xoá không "sống lại" khi máy khác sync | R | multi-device active; `[assumption]` tombstone policy — SPECIFY chốt thời hạn giữ tombstone | medium |
| N17 | Máy đã có data local khi connect lần đầu → merge vào remote theo policy N6, không ghi đè bên nào | R | `[assumption]` — lựa chọn bảo thủ chống data loss | medium |
| N18 | Một profile có thể chọn "không sync" (chỉ local) | F/+privacy | `[assumption]` — suy ra từ N11 (user tự quyết data nằm đâu) | medium |
| N20 | Dữ liệu Reader (sách đã thêm + vị trí đọc + thời gian đọc) theo user sang máy khác | F | `src/features/reader/services/readerRepository.ts:10-37` (DB `cell-reader`: books, progress); owner 2026-09-27 chọn "Sync luôn" | high |
| N21 | Ngắt kết nối 1 tài khoản là quyết định SSOT: ngắt ở 1 máy thì mọi máy cùng ngừng sync tài khoản đó | F/R | owner 2026-09-27: "ngắt ở một máy là các máy khác cũng như vậy phải là ssot" | high |
| N22 | Chuyển profile sang "Không sync" hoặc sang tài khoản khác xong → hỏi user có xoá bản cũ trên cloud không (mặc định giữ) | U/+privacy | owner 2026-09-27 chọn "Hỏi có xóa không" | high |
| N23 | Khi có xung đột, lưu nhật ký tối thiểu (entity, 2 phiên bản, bên thắng) để chẩn đoán | S | intent risk "winner ghi audit trail"; spec review should-fix #22 | medium |
| N19 | Nơi lưu trữ là provider cắm được (adapter): sync engine không phụ thuộc Google Drive; thêm OneDrive/Dropbox sau này = thêm 1 adapter, không sửa engine/merge/UI flow. Item này chỉ ship adapter Google Drive | S | user 2026-09-27: "thiết kế theo dạng adapter… người dùng có thể chọn những dịch vụ khác… kiến trúc clean"; "hiện tại chỉ cần google drive"; target providers tương lai: OneDrive + Dropbox | high |

## Scope

- **In:** kiến trúc provider-adapter (port chung, engine độc lập provider) + adapter Google Drive; đổi model profile thành 1 profile/target + migration gộp profile trùng target; OAuth connect/disconnect nhiều Google account (`launchWebAuthFlow`, Chrome + Firefox); binding profile → account (dùng chung hoặc riêng); chọn/đổi system account cho global config; rebind profile kèm migrate data; Drive `appDataFolder` backend; sync `settings` + secondary storage keys + `cell-srs-*` DB + `orca-dict-*` DBs (full content, bao gồm blobs) + `cell-reader` DB (sách + tiến độ); merge/conflict policy per data class; sync status UI + "sync now"; restore-on-fresh-install flow; resumable chunked upload/download.
- **Out:** downloaded video/subtitle files; `mediaLibrary` + watch history `orca-local-player` (file refs trỏ disk local — vô nghĩa cross-device; immersion stats derive từ đây nên cũng giữ theo máy); `cell-local-audio-index` (index của file audio local); UI layout prefs (split %, badge position, filter mode, search history); FileSystem handles (`localFileHandleStorage.ts` — handles không portable); session/tab state + `subtitleKeyLedger` (`config.ts:377` — per-session by design); `lookupLog` (dev-only); `ankiSchemaCache` (rebuild được); Anki data (AnkiWeb là việc của Anki); adapter OneDrive + Dropbox (item riêng sau — port phải đủ cho cả hai); publish OAuth app "In production" + brand verification (domain, homepage, privacy policy) — làm sau khi test xong, theo quyết định owner 2026-09-27.
- **Non-goals:** realtime collaborative sync (sub-minute convergence không phải promise); multi-user sharing; versioning history UI; E2E encryption layer (Drive của user là trust boundary — encryption-at-rest là enhancement sau); tách 1 profile ra nhiều account (1 profile = đúng 1 account); tự xoá data khỏi Drive cũ mà không hỏi user (N22: luôn hỏi, mặc định giữ).

## Workflow

User mở Settings → Sync → "Connect Google Drive" → OAuth consent (scope `drive.appdata`) → account đầu tiên thành system account + mặc định bind cho mọi profile. Muốn tách: user connect thêm account và gán từng profile vào account đó; global config vẫn ở system account (đổi được). Profile = target language (mỗi target 1 profile), nên mỗi dict/wordStatus/SRS collection thuộc đúng 1 profile. Rebind 1 profile đã có data → engine copy phần per-profile (profile config, SRS collection, dict + wordStatus của target đó) sang Drive mới, xong mới switch binding, Drive cũ để nguyên. Engine tạo app folder trên mỗi account nếu chưa có → first snapshot: serialize settings + từng IndexedDB store, chunk lớn thành parts, upload kèm manifest (versions, per-entity timestamps, deviceId). Steady state: mỗi mutation qua repository/store hook enqueue delta → debounce → upload delta package; SW bị evict giữa chừng → resume từ checkpoint trong `chrome.storage.session`. Máy B: on startup + periodic pull → đọc remote manifest → so deviceId/revision → download delta → apply qua merge policy → bump local revision. Conflict: cùng entity sửa 2 máy → merge rule per class (N6), winner ghi audit trail. Offline: delta queue persist local, flush khi online (`self.ononline` + periodic retry). Disconnect (SSOT, N21): ngắt ở 1 máy → mọi máy ngừng sync tài khoản đó, local data mọi máy nguyên vẹn, remote data giữ lại. Chuyển profile sang "Không sync"/tài khoản khác → hỏi có xoá bản cũ trên cloud (N22). Chi tiết kỹ thuật (layout remote, journal, merge) là của spec.

## Journey

### AS-IS

1. User học trên desktop A — SRS reviewEvents tích lũy, word statuses được đánh dấu, profiles + dictionaries + config được setup dần trong IndexedDB/chrome.storage.local.
2. User mở laptop B (hoặc reinstall/profile mới) — extension hoàn toàn trống: không profile, không dict, không study list; IndexedDB rỗng.
3. User re-create profiles + re-import dictionaries bằng tay nếu còn giữ file gốc; config hệ thống set lại từ trí nhớ.
4. SRS review history + word status mất vĩnh viễn — không có đường nào rebuild; tiến trình học đứt quãng.

### TO-BE

1. User connect Drive 1 lần ở máy A → toàn bộ dữ liệu hiện có upload thành snapshot; từ đó mọi thay đổi tự sync nền, status luôn nhìn thấy.
2. User cài extension trên máy B → connect cùng Google account → engine pull snapshot + deltas → profiles, settings, study lists, word statuses, dictionaries hiện ra đầy đủ, không cần file gốc.
3. User học xen kẽ A↔B: reviewEvents merge theo id, word status máy-sau-thắng-per-term, config máy-sau-thắng-per-slice — không mất lặng lẽ.
4. User muốn tách dữ liệu: connect account thứ 2, gán profile "Tiếng Việt → 日本語" sang account đó → data profile migrate sang Drive mới; profile khác + global config vẫn ở system account.
5. Edge: offline → delta queue chờ, flush khi có mạng; token của 1 account bị revoke → chỉ các profile bind account đó dừng sync, status báo rõ, re-auth resume ngay chỗ dừng; Drive full → error surfaced, không corrupt local; máy mới chỉ connect 1 trong nhiều account → chỉ restore profile bind account đó (+ global nếu là system account).

## Stories

- S1: As a learner, I want my study lists + review progress to follow me to any device so that đổi máy không mất tiến trình — done when fresh install + connect khôi phục đầy đủ decks/cards/reviewEvents/assets.
- S2: As a learner, I want installed dictionaries available on a new machine without source files so that tra cứu hoạt động ngay — done when lookup trên máy mới trả kết quả giống máy cũ mà không re-import.
- S3: As a learner, I want language profiles + system config identical across devices so that không phải setup lại — done when đổi setting/profile trên máy A xuất hiện trên máy B sau sync.
- S4: As a learner, I want sync chạy nền tự động với trạng thái nhìn thấy được so that tôi tin là data an toàn — done when mọi mutation tự propagate + status/errors hiển thị rõ.
- S5: As a privacy-conscious user, I want my data chỉ nằm trong Drive của tôi và ngắt được bất cứ lúc nào so that tôi kiểm soát dữ liệu — done when payload chỉ vào `appDataFolder` + disconnect dừng sạch.
- S6: As a learner with separate Google accounts, I want to sync mọi profile vào 1 Drive hoặc mỗi profile vào Drive riêng so that tôi tự quyết data nào nằm ở account nào — done when binding chọn được per profile, data profile chỉ nằm trong account nó bind, và global config nằm ở đúng system account.
- S7: As a learner, I want to move a profile sang account khác mà không mất data so that đổi Drive không phải bắt đầu lại — done when rebind xong thì Drive mới có đủ data profile, Drive cũ không bị đụng.

## Risks

| Risk | Type | Impact | Team's ability to respond |
|---|---|---|---|
| First upload + dict size 10s–100s MB vs SW eviction / rate limit | external | Sync lần đầu chậm, dễ đứt giữa chừng | Chunked resumable upload, checkpoint trong session storage, `chrome.alarms` wake — kỹ thuật đã có pattern sẵn |
| Merge conflict policy sai → mất review history hoặc settings nhảy lung tung | internal | Data loss — thứ feature này sinh ra để ngăn | Merge rules per data class ở spec; reviewEvents append-only by-id là easy case; conflict audit trail để debug |
| Multi-account buộc dùng `launchWebAuthFlow` + tự quản token/refresh per account; redirect URI khác nhau giữa Chrome/Firefox | external | Token hết hạn/revoke xử lý sai → sync im lặng dừng | 1 auth path cho cả 2 browser (ít branching hơn getAuthToken+fallback); isolate sau `getAccessToken(accountId)`; status per account |
| Không có server → `launchWebAuthFlow` với Google chỉ lấy được access token ~1h, không có refresh token; hết phiên Google thì phải re-auth tương tác | external | Sync nền dừng khi token hết hạn mà silent re-auth (`interactive:false`) thất bại | Silent refresh trước khi hết hạn; thất bại → status "cần đăng nhập lại" per account, delta queue giữ nguyên; SPECIFY verify hành vi thật trên Chrome + Firefox |
| Migration gộp profile trùng target (N15) sai → mất SRS/config | internal | Data loss ngay lần update, trước cả khi sync chạy | Migration gộp theo id, không xoá record; unit test với fixture 2 profile cùng target; chạy trước khi sync engine bật |
| Migrate khi rebind đứt giữa chừng (SW evict, quota) | internal | Profile ở trạng thái nửa-nửa giữa 2 Drive | Copy trước, switch binding chỉ khi copy xong + verify manifest; Drive cũ không bị đụng nên luôn rollback được |
| `identity` permission + Drive scope → store review/privacy scrutiny | legal | Review chậm/cần justification | `drive.appdata` là scope nhỏ nhất; privacy disclosure viết sẵn; no-server là selling point |
| Google OAuth app "In production" chưa brand-verified → mọi user thấy màn "Google hasn't verified this app" + cap 100 user (support.google.com/cloud/answer/13464323) | legal/external | Khách hoảng/bỏ ngang ở bước connect; không scale quá 100 user | Chỉ dùng non-sensitive scopes (`drive.appdata`, `openid`, `email`) → chỉ cần brand verification: homepage trên domain Anh sở hữu (verify qua Search Console), privacy policy cùng domain + link từ homepage và consent screen, nút sign-in theo Google branding guidelines, in-product privacy notice (support.google.com/cloud/answer/13464321). **Owner quyết 2026-09-27: giai đoạn này chạy Testing mode (chỉ test users); publish In production + brand verification làm sau, tách khỏi item này** |
| `subtitleApiKeys` (credentials user) sync lên cloud | hidden/security | Keys lộ nếu Drive account bị xâm | Accepted risk — user chọn sync bình thường; Drive `appDataFolder` là trust boundary (N7) |
| Drive quota user đầy giữa chừng upload | external | Partial state remote | Manifest atomicity: chỉ switch pointer sau khi parts đủ; error surfaced ở status UI |
| Blob/ArrayBuffer trong IndexedDB (phraseIndex, assets) cần portable serialization | internal | Export/import phức tạp, dễ corrupt | Serialization layer + round-trip test là AC bắt buộc |
| User nghĩ sync = realtime; delay debounce gây confuse khi switch máy nhanh | human | Cảm giác "mất data" | Status UI nói rõ last-synced + "sync now"; expectations set trong copy |

## Decision

go — pain thật và không thể vá bằng thủ công (SRS progress mất là mất vĩnh viễn); Drive `appDataFolder` khả thi cho cả 2 browser mà không cần server; risk chính (merge correctness, upload resilience) nằm trong tầm kiểm soát của spec/deliver.

## Draft Acceptance Criteria

- [ ] Fresh install + connect Google → restore đầy đủ settings/profiles/dictionaries/SRS data; lookup + study hoạt động không cần file gốc
- [ ] Mutation trên máy A (đổi setting, review card, mark word, import dict) → máy B thấy sau sync cycle, không cần action tay
- [ ] Concurrent edits 2 máy: reviewEvents/notes merge by-id không mất record nào; wordStatus/config LWW theo documented policy; không silent drop
- [ ] Dict content round-trip lossless — serialized upload/download cho kết quả lookup identical
- [ ] Token revoked/disconnect → local data nguyên vẹn, sync dừng sạch, re-auth resume đúng checkpoint
- [ ] Offline edits queue + flush khi reconnect; SW eviction giữa upload lớn → resume không corrupt
- [ ] Chạy được trên Chrome và Firefox qua cùng `launchWebAuthFlow` path
- [ ] Mọi profile bind 1 account → toàn bộ data vào 1 Drive; các profile bind account khác nhau → data per-profile chỉ nằm trong account tương ứng, global config chỉ ở system account
- [ ] Đổi system account → global config chuyển sang account mới, không mất setting nào
- [ ] Rebind profile đã có data → Drive mới có đủ data profile trước khi binding switch; Drive cũ không bị sửa/xoá; đứt giữa chừng thì binding giữ nguyên account cũ
- [ ] Revoke 1 account → chỉ profile bind account đó dừng sync; profile khác chạy tiếp
- [ ] Ngắt kết nối 1 tài khoản ở máy A → máy B cũng ngừng sync tài khoản đó sau lần sync kế tiếp, data local mọi máy nguyên vẹn
- [ ] Chuyển profile sang "Không sync"/tài khoản khác → được hỏi xoá bản cũ trên cloud; chọn giữ thì không file nào bị xoá
- [ ] Sách + vị trí đọc Reader thêm ở máy A xuất hiện ở máy B; thời gian đọc cộng dồn từ mọi máy
- [ ] Không tạo được 2 profile cùng target; profile trùng target có sẵn được gộp, không mất card/reviewEvent/config nào
- [ ] Xoá profile/dict/card/word ở máy A → máy B xoá theo sau sync, không sống lại
- [ ] Máy có data local connect lần đầu → local + remote được merge, không bên nào bị ghi đè
- [ ] Profile đặt "không sync" → không byte nào của profile đó lên Drive
- [ ] Token hết hạn → silent refresh; thất bại → status yêu cầu đăng nhập lại, không mất delta đang chờ
- [ ] OAuth app ở trạng thái Testing: tài khoản trong danh sách test users connect + sync được end-to-end trên Chrome và Firefox
- [ ] Nút connect theo Google branding guidelines + có privacy notice trong app (chuẩn bị sẵn cho brand verification sau này)
