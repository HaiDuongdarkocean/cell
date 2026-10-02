# Spec: SRS variants — user-managed variants + front-material guard

> Intent: `docs/intent/srs-front-variants.md` (v2, approved) · ui_surface: yes · Mode: interactive

## Objective

Thay `ComponentType` cố định (`sound|meaning|spelling`) bằng **Variant entity do user quản**: mỗi variant định nghĩa front hiển thị field nào (+ input tuỳ chọn), back hiển thị gì, và số vòng explore khi card mới. Variants gom trong **Preset** — collection có default preset, deck override hoặc share. Mỗi variant = 1 memory component riêng trên card (progress + FSRS + schedule riêng). Mọi variant — builtin lẫn custom — chỉ được schedule khi note có đủ nguyên liệu front của nó ("căn cứ vào front"). Ba builtin giữ id cố định `sound`/`meaning`/`spelling` với contract mới (sound=text-only, meaning=image-only, spelling=dictation) → review history + data cũ tương thích không cần migration.

## Actor ↔ System Boundary

| Actor | Triggers | Inputs | Receives/Views |
|---|---|---|---|
| Learner | mở study, flip, grade, toggle scope/audio trên card, edit/delete card | judgment, typed input, toggle pref | front theo variant spec, back verification, progress/due |
| Learner (manager) | mở Variant settings, CRUD variant/preset, gán preset cho deck, reset default | name, front/back field selection, newLoops, preset assignment | variant list, editor + preview, confirm dialogs |

System-internal: candidate scan + servability guard + priority pick + stimulus build + FSRS/progress/maintenance — không chứa hành vi người dùng.

## Data Model (new/changed)

```ts
// entities/srs/types.ts — NEW
export type VariantId = string; // builtin: 'sound' | 'meaning' | 'spelling'

// Pseudo-field 'input' trong fieldIds = dictation (learner nghe + gõ).
// Toggle trên card KHÔNG được cấu hình — derive tự động từ fieldIds + material của note:
//   fieldIds ⊇ {target, sentence} & note có cả hai → scope toggle cycle [both → word → sentence]
//   fieldIds ⊇ {wordAudio, sentAudio} & note có cả hai → audio toggle [word | sentence]
//   'input' → input luôn render; expected field = audio-toggle → wordAudio:'target' | sentAudio:'sentence'
//             (không audio field nào → không còn gì để nghe→gõ → variant unservable, KHÔNG fallback text)
export interface SrsVariant {
  readonly id: VariantId;
  readonly name: string;
  readonly icon?: string;                 // ICON_CATALOG name; builtin map sẵn
  readonly fieldIds: readonly string[];   // nguyên liệu front, ordered; chứa 'input' = dictation
  readonly newLoops: number;              // 1–3, default 1 — số lần explore pass khi card mới
  readonly builtin?: 'sound' | 'meaning' | 'spelling';
  readonly order: number;
}
// Back KHÔNG configurable — back luôn canonical full-fields (verification surface).

export interface SrsVariantPreset {
  readonly id: string;
  readonly collectionId: string;
  readonly name: string;
  readonly variants: readonly SrsVariant[]; // inline — share = nhiều deck cùng presetId
  readonly isDefault: boolean;              // preset factory của collection
  readonly createdAt: number;
}

// Toggle state persist per variant (lưu sang card khác):
export interface SrsVariantToggles {
  readonly scope?: 'both' | 'word' | 'sentence';   // chỉ khi derived scope toggle tồn tại
  readonly audio?: 'word' | 'sentence';            // chỉ khi derived audio toggle tồn tại
}

// CHANGED
SrsCard.components:    Record<VariantId, SrsMemoryComponent>   // z.record, was strict 3-key
SrsCard.studyAgainDue: Record<VariantId, string | null>        // z.record
SrsMemoryComponent.type: VariantId                              // string, was enum
SrsReviewSession: { card, note, notetype, variant, toggles, stimulus, mode, startedAt } // variant + resolved toggles thay componentType+template
SrsStimulus.type: string                                        // widen khỏi enum — custom variant fieldIds không map được enum cũ
SrsReviewRecord: componentType → variantId: VariantId (widen string); + dictationMode?: 'word' | 'sentence'; templateId/stimulusType → optional vestigial (ghi 'variant:<id>' hoặc omit)
SrsDeck.variantPresetId?: string | null    // null → collection.defaultVariantPresetId
SrsCollection.defaultVariantPresetId?: string | null  // OPTIONAL — records cũ thiếu field phải parse được; lazy-seed fill sau
SrsUiPrefs.variantToggles: Record<VariantId, SrsVariantToggles>  // toggle pref persist cross-card/session
```

Schema compat: `ComponentTypeSchema` enum → `z.string()` cho các chỗ keyed component (record keys, `componentType`, `stages`); builtin ids không đổi nên history/merge đọc được. `SrsFrontTemplate`/`notetype.frontTemplates` + `learningPath.stages`/`progressionMode`/`minExplores` giữ schema (compat, vestigial) — review path không consult; không cần migration. Alternatives đã cân: (a) giữ enum + bảng custom song song — reject vì 2 nguồn truth; (b) migrate mọi card/record sang id mới — reject vì builtin-id-preservation đạt cùng kết quả với 0 write.

Default preset (seed + reset-default target):
- `sound` — "Nghe & nghĩa": fieldIds=['target','sentence'] → scope toggle derive; icon `volumeHigh`; newLoops 1
- `meaning` — "Nghĩa (ảnh)": fieldIds=['image']; icon `bookOpen`; newLoops 1
- `spelling` — "Chính tả": fieldIds=['wordAudio','sentAudio','input'] → audio toggle derive + input; icon `pencil`; newLoops 1

## Requirements

### Functional

REQ-1: Variant front contract render
- Actor: learner
- Goal: mỗi card front render đúng spec của variant — không nhiều hơn, không leak đáp án.
- Preconditions: session active với `variant` + resolved toggles.
- Basic flow:
  1. system render `variant.fieldIds` (đã filter theo toggle + material) theo thứ tự, theo kind: `target`→heading; text/context/translation/list→text block; `audio`→replay button (autoplay khi variant có 'input' — dictation); `image`→`<img>`; `input`→`InputField` (placeholder theo expected field, i18n)
  2. derived toggles render góc trái-trên card: scope cycle `[both→word→sentence]` khi fieldIds⊇{target,sentence} & note có cả hai; audio toggle `[word|sentence]` khi fieldIds⊇{wordAudio,sentAudio} & note có cả hai; toggle option thiếu material → không offered
  3. learner flip/Enter/✓ → back
- Alt flow: field absent trên note → skip slot; toggle option không có material → ẩn khỏi toggle.
- Exception: không field nào render được → variant excluded (REQ-6); 'input' mà không audio nào resolvable → variant excluded (dictation bắt buộc phải nghe — không fallback gõ theo text vì đó là copy, không phải recall).
- Rules: front KHÔNG render `note.targetWord`/`note.fields.sentence` mặc định như hiện tại — chỉ render fieldIds trong spec (targetWord leak fix nằm ở đây); không fallback stimulus; toggle KHÔNG user-configured — derive từ fieldIds.
- Postcondition: front chỉ chứa nguyên liệu khai báo (+ toggle derive).
- NFR refs: NFR-1

REQ-2: Builtin sound = text recall
- Actor: learner · Goal: đoán phát âm+nghĩa từ chữ · Preconditions: sound servable (≥1 trong {target,sentence} non-empty — `targetWord` canonical → thực tế luôn)
- Front: `['target','sentence']` — term heading + sentence; không audio element, không autoplay.
- Back: canonical (autoplay audio + full fields) — verification surface.
- NFR refs: NFR-1

REQ-3: Builtin meaning = image recall
- Actor: learner · Goal: nhìn ảnh recall từ · Preconditions: note có image-kind field resolvable
- Front: `['image']` — chỉ `<img>`. Không ảnh → variant excluded (REQ-6), không chặn path (REQ-7).
- Back: canonical.
- NFR refs: NFR-1

REQ-4: Builtin spelling = dictation + persisted toggle
- Actor: learner · Goal: nghe→gõ theo trình độ · Preconditions: ≥1 audio field resolvable
- Front: fieldIds `['wordAudio','sentAudio','input']` → audio toggle derive `[word|sentence]` (autoplay audio đang chọn) + input; audio toggle `word` → autoplay `wordAudio` + expected `target`; `sentence` → autoplay `sentAudio` + expected `sentence`. Placeholder trong input theo expected. Audio aria-label: `wordAudio`/`sentAudio` giữ label riêng; field audio khác → generic `srs.review.playAudio`.
- Audio toggle chỉ offer phía có material; pref `srsUiPrefs.variantToggles['spelling'].audio` persist cross-card/session; pref vi phạm availability → effective = phía còn lại.
- Correctness: `normalizeSpelling(typedInput) === normalizeSpelling(expected)` — expected = `note.targetWord` (word) hoặc `note.fields.sentence` (sentence); ghi `isSpellingCorrect` + `dictationMode`.
- NFR refs: NFR-1, NFR-3, NFR-4

REQ-5: Variant/preset domain + repositories
- Actor: system (gọi nội bộ), learner qua REQ-8/9.
- Goal: persist variants/presets trong `cell-srs-*` IndexedDB theo pattern `baseRepository`.
- Basic flow: `variantPresetRepository` (get/put/list by collection/delete) — preset chứa variants inline; bump `SRS_DB_SCHEMA_VERSION` + thêm `SRS_STORES.variantPresets` (create trong `onupgradeneeded`); `ensureFirstRun` seed thêm default preset vào collection mới; collection cũ thiếu preset → lazy-seed default preset khi load (`getEffectivePreset(deck)` fallback create+persist + gán `collection.defaultVariantPresetId`).
- Exception: deck.reference preset bị xóa → fallback collection default.
- Rules: preset delete đang được deck dùng → reassign decks đó về default (confirm ở UI); builtin ids immutable — xóa builtin khỏi preset = variant ẩn (component data giữ nguyên).
- NFR refs: NFR-2

REQ-6: Servability guard ("căn cứ vào front")
- Actor: learner (gián tiếp)
- Goal: variant chỉ được schedule khi note đủ nguyên liệu front của nó.
- Basic flow:
  1. `isServable(variant, note)` = ≥1 non-'input' fieldId present + non-empty; nếu có 'input' → thêm điều kiện ≥1 audio field resolvable (dictation không fallback text)
  2. derived toggles lọc theo material: mỗi phía của toggle chỉ offered khi field tương ứng present (cả hai có → toggle; một có → fixed)
  3. candidate loop: variant không servable → bỏ khỏi candidates (field-level, O(fields), không I/O)
  4. priority order (hiện hữu) → per candidate: `loadNoteAssets` → resolve media + toggles (pref ∩ available) → fail (asset chết) → skip candidate kế
  5. resolve được → `SrsReviewSession{variant, toggles, stimulus}`
- Exception: hết candidate → `null` (finished); `NO_TEMPLATE` throw bị xóa — unservable là tình huống hợp lệ.
- Rules: guard áp uniform builtin+custom; effective toggles = `prefs.variantToggles[variantId]` ∩ available else defaults (scope='both', audio='word' nếu cả hai audio có).
- NFR refs: NFR-2

REQ-7: Learning path + maintenance theo preset variants
- Actor: learner (gián tiếp)
- Goal: path/maintenance chỉ tính variant servable.
- Basic flow:
  1. `resolveVariantPath(deck→preset)`: ordered variantIds + per-variant newLoops
  2. `isLocked`/`selectNextExploreComponent`/`resolvePool` iterate variantIds của preset (không enum); component unservable được coi như "đã xong" cho mục đích lock — không chặn stage sau; newLoops per-variant thay `minExplores` cho variant đó
  3. `recalcCard(card, config, now, adapter, path)` với `path = { variantIds, servableIds, newLoops }` — tách rõ: `variantIds` (toàn bộ preset) drive reconcile-init, `servableIds` drive maintenanceMode/exploreDue; `maintenanceMode` = mọi component servable ≥ threshold; components thiếu → init empty; thừa → giữ data, không schedule
  4. Sibling writers `createCard`/`resetCard`/`studyAgain`/`resetComponent`/`importWriter` fan-out nhận cùng `path`/preset — không còn literal 3-key
  5. Read-path rule: mọi chỗ đọc `card.components[id]` khi id có thể chưa reconcile (`selectNextReview`, `effectiveDueFor`, `resolvePool`, `isNew`, stats) → missing = empty component qua helper `getComponent(card, id)` — không crash khi variant mới thêm vào preset giữa 2 write
- Exception: preset rỗng/không variant servable → card không pick được; maintenanceMode=false.
- NFR refs: NFR-2

REQ-8: Variant management UI
- Actor: learner (manager)
- Goal: quản variant trong `SrsStudySettings` (tab mới "Variants").
- Basic flow:
  1. system hiện preset selector (per-deck override + collection default) + variant list + search box
  2. learner search → filter client-side theo tên; add/edit/rename/delete qua editor dialog
  3. delete builtin/custom → confirm dialog (nêu rõ: cards giữ progress nhưng variant ngừng schedule)
  4. "Reset default" → confirm → restore 3 builtin vào preset (giữ custom variants)
- Alt flow: deck selector đổi preset áp cho deck hiện tại → cards reconcile ở lần recalc kế.
- Rules: i18n đầy đủ; dùng `Menu`/`Select`/`Dialog`/`InputField` shared; dirty state disable save khi invalid (name rỗng, fieldIds rỗng).
- NFR refs: NFR-3, NFR-4

REQ-9: Variant editor + live preview
- Actor: learner (manager)
- Goal: tạo/sửa variant thấy ngay card sẽ trông thế nào. UI đơn giản: user chỉ tick field — toggle trên card tự derive.
- Basic flow:
  1. editor form (Dialog): live card preview (đỉnh, dùng chung `SrsVariantFront` với review — SSOT) → name input → field picker (chips từ field catalog của system notetype; 'input' = Dictation) → newLoops (1–3) → footer `Delete (ghost→destructive) | Save`
  2. preview render front dùng sample note — ưu tiên note thật đầu tiên của collection, fallback mock note constant; derived toggles hiện và bấm được trong preview
  3. save → validate (fieldIds non-empty, newLoops∈[1,3], name non-empty) → put preset; back không cấu hình (luôn canonical)
- Exception: field picker cho phép field mà chưa note nào có → warning text (variant sẽ ẩn tới khi có material) — không chặn save; 'input' khi không note nào có audio → hint variant sẽ ẩn (dictation cần audio).
- NFR refs: NFR-3

REQ-10: Study session + review-record theo variant
- Actor: learner
- Goal: session/record mang variantId (không phải enum) + toggle state đã resolve; applyReview cập nhật đúng component của variant.
- Basic flow: session.componentType → `variant.id`; `isSpellingCorrect` tính khi variant có 'input' (tên giữ cho schema compat); progress/FSRS ghi vào `card.components[variantId]`.
- Rules: `ReviewRecord.componentType` widen string; `dictationMode` ('word'|'sentence', khi 'input' có mặt) mới optional — records cũ thiếu nó đọc được.
- NFR refs: —

REQ-11: Ripple cleanup — stats, sync, import, deck UI
- `getSrsStats`/`getSrsHomeStats`/`SrsDeckDetail`/progress bars/`isNew`: iterate **preset variants** của card (không phải raw `components` keys) — orphan components của variant đã xóa không tính vào stats/isNew; label = variant.name (builtin id → i18n label hiện hữu fallback).
- Sync: `mergeSrsCard` đã union-key components (confirm-only, test giữ xanh); **presets sync**: register `variantPresets` vào `srsLocalSource` entity map (LWW policy, scope collectionId) — nếu không `deck.variantPresetId` dangles cross-device.
- Anki import (`importWriter`/`stateConvert`/`revlogMap`): tạo components = variants của preset deck đích; revlog map giữ mapping vào builtin ids.
- `isNew` badge/top icons: per variant (icon từ variant.icon, fallback icon chung).
- `updateCurrentNote` mid-session edit: nếu edit làm variant hiện tại mất servability → giữ session với stimulus cũ (stale cho tới khi submit — hiện hữu `stimulusStale` semantics), không drop giữa chừng; derived toggles resolve lại chỉ khi option đang chọn hết material và phía kia còn servable.
- NFR refs: NFR-2

### Non-functional (NFR)

| ID | Requirement | Class | Target |
|---|---|---|---|
| NFR-1 | Front không leak đáp án của variant đang test | U | DOM test assert absence |
| NFR-2 | Guard field-level O(fields); ≤100ms/1000 cards; không migration data; zod record widen backward-compatible | P/S | unit test + perf guard hiện hữu |
| NFR-3 | Mọi control mới (toggle, editor, search, picker) keyboard-operable + aria trong shadow DOM context phù hợp | U/a11y | manual + axe |
| NFR-4 | `variantToggles` + preset assignment persist; prefs cũ merge default an toàn | S | localStorage + IndexedDB |

## Flows / States

Servability + derived toggles (per variant, per note):

```
isServable = ≥1 non-'input' fieldId present&non-empty on note
             (+ 'input' → cần ≥1 audio field resolvable — dictation không fallback text)
scope toggle = fieldIds⊇{target,sentence} & note có cả hai → options [both,word,sentence]
audio toggle = fieldIds⊇{wordAudio,sentAudio} & note có cả hai → options [word,sentence]
effective toggles = prefs.variantToggles[variant.id] ∩ options  else  default (scope='both', audio='word')
unservable → excluded khỏi candidates
```

Candidate → session:

```
decks → preset per deck → variants[] (ordered)
per (card, variant): resolvePool(pool theo explore/due) → isServable?
  drop | candidates[]
ordered pick → loadNoteAssets → buildStimulus(fieldIds sau toggle filter; media must resolve) → ok→SESSION | fail→next
```

Card components reconcile (tại mọi write qua recalcCard):

```
for v in preset.variants: components[v.id] ??= emptyComponent()
components[v] với v ∉ preset: giữ nguyên (orphan data, không schedule)
```

## Function ↔ Feature Map

| Function | Features |
|---|---|
| Gate variant theo front materials | `isServable()` + derived-toggle resolve + candidate filter + ordered-skip |
| Giữ path/maintenance nhất quán khi variant ẩn/thêm/xóa | servable-param trong learningPath/recalcCard + reconcile components |
| Render front theo spec + toggles | `SrsVariantFront` (shared: review + editor preview + shelf tile) render fieldIds + derived scope/audio toggles |
| Dictation / input recall | `'input'` pseudo-field + `InputField` + audio toggle + `variantToggles` pref |
| Quản lý variant | Settings tab: card shelf + search + CRUD + reset default + preset assign per deck |
| Preview variant | Live card preview trong editor dialog (sample note, cùng `SrsVariantFront`) |
| Verify | `SrsReviewCardBack` canonical (giữ — back không configurable) |

## Data

| Entity | Key fields | Lives in | Retention |
|---|---|---|---|
| `SrsVariantPreset` | id, collectionId, variants[], isDefault | IndexedDB `cell-srs-*` table `variantPresets` | persistent |
| `SrsDeck.variantPresetId` | preset ref (null→collection default) | deck record | persistent |
| `SrsCollection.defaultVariantPresetId` | preset ref | collection record | persistent |
| `SrsUiPrefs.variantToggles` | Record<variantId, {scope?, audio?}> | localStorage `cell.srs.uiPrefs` | persistent |
| `SrsCard.components/studyAgainDue` | Record<variantId,…> | card record | persistent — builtin ids ổn định |
| `SrsReviewRecord` | componentType=variantId, +dictationMode | reviewEvents | append-only |

## Traceability

| Need | REQ | AC |
|---|---|---|
| N1 sound text-only | REQ-1, REQ-2 | AC-1 |
| N2 meaning image-only/ẩn | REQ-3, REQ-6, REQ-7 | AC-2, AC-6, AC-7 |
| N3 spelling dictation+persist | REQ-4 | AC-3, AC-4 |
| N4 không leak answer | REQ-1 | AC-8 |
| N5 guard theo front mọi variant | REQ-6 | AC-6 |
| N6 per-toggle material gating | REQ-4, REQ-6 | AC-4 |
| N7 sound servability | REQ-2, REQ-6 | AC-9 |
| N8 CRUD+search | REQ-8 | AC-10 |
| N9 editor field picker | REQ-9 | AC-11 |
| N10 per-variant loops 1-3 | REQ-7, REQ-9 | AC-12 |
| N11 preset collection/deck/share | REQ-5, REQ-8 | AC-13 |
| N12 preview | REQ-9 | AC-11 |
| N13 N components riêng | REQ-5, REQ-7, REQ-10, REQ-11 | AC-5, AC-14 |
| N14 builtin CRUD+reset | REQ-8 | AC-10 |

| Journey TO-BE | REQ |
|---|---|
| 1 front contracts | REQ-1..4 |
| 2 guard mọi variant | REQ-6 |
| 3 settings CRUD+preview+reset | REQ-8, REQ-9 |
| 4 variant mới → component riêng | REQ-5, REQ-7 |
| 5 preset share/đổi | REQ-5, REQ-7, REQ-8 |
| 6 newLoops per-variant | REQ-7, REQ-9 |

## Boundaries

- Always: typecheck+unit+build trước commit; i18n `t()`; shared UI components; zod tại persistence boundary; builtin ids immutable.
- Ask first: đụng `manifest.json`; thay schema ngoài các field đã liệt kê; new dependency.
- Never: migrate/xóa review history; xóa orphan component data; hardcode label/icon ngoài catalog+i18n; fallback stimulus ngoài variant spec.

## Success Criteria

- [ ] AC-1 Sound front chỉ term+sentence; không audio element/autoplay ở front; back autoplay giữ.
- [ ] AC-2 Meaning front chỉ `<img>`; không heading/sentence/input.
- [ ] AC-3 Spelling front = audio (autoplay+replay theo audio toggle) + input placeholder theo expected field; không term/sentence/image.
- [ ] AC-4 Derived toggle gating đúng: scope `[both→word→sentence]` chỉ khi target+sentence đều có; audio `[word|sentence]` chỉ khi cả hai audio có (thiếu một → fixed, không render toggle); pref `variantToggles` persist qua card/session.
- [ ] AC-5 Card với preset N variant → `components` có N entry FSRS riêng; session riêng từng variant; review record ghi variantId+dictationMode.
- [ ] AC-6 Variant thiếu nguyên liệu front không xuất hiện trong session (builtin lẫn custom); không `NO_TEMPLATE`.
- [ ] AC-7 Component unservable không chặn explore-lock stage sau và không chặn `maintenanceMode`.
- [ ] AC-8 Front DOM không chứa đáp án đang test (spelling: không targetWord; meaning: không term/sentence; custom input-variant: không expected field).
- [ ] AC-9 Sound session luôn servable khi có term hoặc sentence.
- [ ] AC-10 Settings Variants tab: list+search+add+rename+edit+delete hoạt động; reset default restore 3 builtin giữ custom; confirm dialog khi delete.
- [ ] AC-11 Editor (Dialog): live preview dùng `SrsVariantFront` chung + name + field chips + newLoops 1–3; back luôn canonical; draft-only cho tới khi Save; validation chặn save invalid.
- [ ] AC-12 Card mới phải pass mỗi variant `newLoops` lần (explore) trước khi FSRS schedule; đổi newLoops áp cho card mới về sau.
- [ ] AC-13 Deck override preset + 2 deck share 1 preset; đổi preset → reconcile components (thiếu init, thừa giữ-ẩn); preset bị xóa → deck về collection default.
- [ ] AC-14 Custom variant vừa tạo xuất hiện trong session đúng front spec; progress riêng trên deck detail.
- [ ] AC-15 Unit tests xanh cho: isServable matrix, derived-toggle degrade theo material, ordered-skip, learningPath/recalcCard với N variant + excluded, preset reconcile, schema compat (card cũ 3-key parse OK).

## Definition of Done

- [ ] All Success Criteria pass
- [ ] `npm run typecheck && npm run lint && npm run test:unit && npm run build` green
- [ ] design-system check cho UI mới (tokens, Menu/Select/Dialog/InputField shared)
- [ ] Verify Chrome thật (testing-extension-browser): 3 builtin fronts + custom variant + toggle + settings CRUD + preview — kèm ảnh before/after
- [ ] `docs/2-architechture-system.md` + `docs/0-wiki.md` cập nhật; ADR: variant model thay ComponentType + frontTemplates deprecation + preset scope

## Open Questions / Accepted Risks

- Asset URL chết (field có, media không resolve): variant field-level servable nhưng skip mỗi pick → card không xong. Accepted — user fix qua edit note.
- `frontTemplates` + `maskTarget` + `minExplores` global thành vestigial: schema giữ, review path không đọc; `graduatePasses` pref giữ làm override global cho newLoops (hiện hữu semantic); ghi ADR.
- Sync merge trên components Record<string>: policies update union-key merge — test merge.property phải còn xanh.
- Icon cho custom variant: picker giới hạn ICON_CATALOG (nhỏ, curated) hoặc default icon — DESIGN quyết.
