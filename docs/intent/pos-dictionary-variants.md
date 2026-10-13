# Intent: POS-variant dictionary model — per-POS frequency, pronunciation, status, senses

> Slug: `pos-dictionary-variants` · Mode: interactive · Source: user statement
> ui_surface: yes
> confidence: medium

## Business Case

| Concept | Statement | Evidence | Confidence |
|---|---|---|---|
| Need | Khi tra từ đa nghĩa/đa loại từ, learner cần đọc đúng "từ đang dùng trong ngữ cảnh" — POS là đơn vị của nghĩa. Hiện tại popup trộn mọi POS: IPA/audio/frequency/status có thể thuộc POS khác với nghĩa đang đọc → học sai phát âm, đánh giá sai độ phổ biến, đánh dấu sai trạng thái. | User statement; `lookupOrchestrator.ts:726-762` (partsOfSpeech chỉ là dedup list; status/frequencies/reading đều per-term) | high |
| Change | Flat per-term data → per-(term, POS) lexical units end-to-end: converter tách per-homograph, store có pos trong key, popup có POS selector swap toàn bộ POS-scoped content. | User statement; COCA/Macmillan markup đã per-POS (verified samples) | high |
| Solution | Một hướng: word → POS variants, mỗi variant mang IPA/audio/frequency/status/senses/images riêng; extraction MDX → canonical resources qua pipeline `tihoka-convert-dictionary` hiện có; UI = POS menu trên popup, default POS đầu, switch = swap. | `docs/specs/tihoka-dict-v1.md` (canonical schema đã có `senses[].pos`) | high |
| Value | Tra đúng nghĩa + đúng phát âm + đúng tần suất cho usage thật → flashcard chính xác hơn, không mark "known" cả từ khi mới biết 1 nghĩa. | User statement | high |
| Stakeholder | Anh — language learner + owner; persona rộng 5–80 tuổi khi ship. | AGENTS.md | high |
| Context | Chrome MV3 ext, IndexedDB per-lang stores, MDX files local của user, `js-mdict` + `jiti` đã là devDep; MDX không bao giờ parse trong app (invariant tihoka-dict-v1). | `package.json:81-82,98`; `docs/specs/tihoka-dict-v1.md:126-152` | high |

## Stakeholders

| Group | Who | Their need re: this change | Capability/constraint |
|---|---|---|---|
| Team | Agent dev | Converter + schema + popup UI nằm trong domain dictionary đã có | js-mdict/jiti/fflate sẵn; adapter macmillan đã tồn tại |
| Customer | Anh (language learner) | Tra từ theo POS + accent; data từ 3 file MDX cá nhân | Files verified readable (`tmp/mdx-sample`) |
| Supplier/Dependency | COCA 60000 MDX (53,967 keys, per-POS rank+total+5 genre), MacmillanEnEn MDX (173,925 keys, `.homograph` per-POS AmE IPA + `.dict-top` POS menu), Macmillan 2nd Ed MDX (67,138 keys, per-homograph UK+US IPA + `zzz_uk/us` audio), MacmillanEnEn.mdd 456MB (audio `sound://` — phase sau) | Data đúng cấu trúc cần thiết | Offline converter; không cần network |
| Organization | Tihoka repo | Schema mới phải giữ invariants: no vendor names, never split unknown structure | `docs/specs/tihoka-dict-v1.md:17-33` |
| Regulator | Dictionary copyright | Data user-import local only — KHÔNG ship nội dung từ điển trong bundle/release | `[assumption]` personal-use license | medium |

## Needs

| ID | Need (statement) | FURPS+ | Evidence/`[assumption]` | Confidence |
|---|---|---|---|---|
| N1 | Trích xuất COCA 60000 → frequency resource có pos trong key: mỗi (term, pos) → rank + total + breakdown 5 genre (spoken/fiction/magazine/newspaper/academic) | F | Verified markup: `span.pos`+`span.rank`+`div.total`+5 `div.freq` per POS block | high |
| N2 | Trích xuất MacmillanEnEn → dictionary resource giữ per-homograph data: mỗi POS block có pronunciations (kèm accent tag AmE/BrE + audio ref), frequencyStars, senses, inflections riêng | F | Verified: `.homograph` × `.part-of-speech-ctx` + `.prons` (multi-accent) + `.stars-grp`; adapter `macmillan.mjs` hiện chỉ lấy pron/stars đầu tiên của record → cần nâng cấp | high |
| N3 | Popup có POS selector khi entry có >1 POS: default = POS đầu theo thứ tự provider; switch swap POS-scoped fields (reading/IPA, audio, frequency chip, definitions, image query, status). UI direction đã chốt: bar ngang pin trên cùng popup, các POS là text link ngăn bởi dấu `|` (`adjective | verb | noun`) — giống `.dict-top to-pos` của Macmillan gốc; **theme-consistent** — surface/màu theo tokens hệ thống, KHÔNG nền sáng riêng như mockup | F, U | User statement + mockup `docs/mockups/pos-dictionary-variants-pos-menu.png` (chỉ lấy layout, không lấy nền sáng) | high |
| N3b | IPA phân biệt accent: nhãn `AmE`/`BrE` đứng trước IPA (`AmE /ˈprezənt/`), tap vào nhãn toggle sang accent còn lại (`BrE /ˈprez(ə)nt/`); accent list scoped trong POS variant đang chọn. **Nguồn BrE đã chốt:** `Macmillan English Dictionary and Thesaurus 2nd Ed.mdx` — mỗi homograph có `UK [ipa] sound://zzz_uk_*.wav` + `US [ipa] sound://zzz_us_*.wav` + pos + stars (verified `water`/`present`; markup font-tag color-coded nhất quán → adapter mới) | F, U | User decision; verified markup | high |
| N4 | Word status tracked per (term, pos) — "present·verb learning" độc lập "present·noun unknown" | F | User decision (per-POS status); hiện `langWordStatus` keyPath='term' (`wordStatusStore.ts:6`) | high |
| N5 | Frequency merge giữ được multi-list: mỗi list hiện rank của POS đang chọn | F | `popupTypes.ts:96-98` frequencies per list | medium |
| N6 | Không ship vendor data trong extension; MDX → json-entries file user tự import | +legal | Spec invariant: app never parses vendor formats | high |
| N7 | POS label normalization cross-source: COCA `j`/`v`/`n`/`r` phải join cùng branch với Macmillan `adjective`/`verb`/`noun`/`adverb` — nếu không frequency và senses rơi vào 2 nhánh khác nhau | F | COCA codes là ký tự đơn; dict pos là full word — cần bảng chuẩn hóa | high |

## Scope

- **In:** adapter COCA mới trong `scripts/dict-adapters/`; adapter Macmillan-2nd-Ed mới (font-tag markup, per-homograph UK/US IPA + audio ref); nâng cấp `macmillan.mjs` per-homograph (pron/stars/audio-ref theo POS block); accent-tagged pronunciation model (`AmE`/`BrE` per variant); `FrequencyEntry` +pos +genre breakdown; canonical schema +pos-scoped fields; popup POS switcher + swap semantics + accent toggle trước IPA; per-(term,pos) word status với migration/fallback cho term-level rows hiện có; subtitle/vocab consumers cập nhật key.
- **Out:** extract `.mdd` audio (456MB — phase sau, audio vẫn Forvo/community/TTS hiện có); hỗ trợ MDX native trong app; các dictionary khác ngoài 3 file scope này (Cambridge/CALD4/LDOCE… adapter khi cần); per-POS cho SRS card model.
- **Non-goals:** không build "sense alignment" xuyên provider (invariant 2 giữ nguyên — POS group là merge boundary, senses vẫn concat theo provider priority); không đổi Anki note model.

## Workflow

Anh mở terminal → chạy converter trên 3 file MDX (COCA, MacmillanEnEn, Macmillan 2nd Ed) → ra các file canonical (dictionary json-entries có pos-scoped prons/senses + frequency file có pos) → import qua Settings → Resources như resource thường → lookup trả về entry có POS variants → popup render POS đầu tiên, menu chọn POS swap payload, nhãn accent trước IPA toggle AmE↔BrE → status/ảnh/audio/frequency/nghĩa đều theo variant đang chọn → send-to-card mang variant đó. System↔system: converter↔js-mdict, import↔IndexedDB, popup↔lookup worker↔status store.

## Journey

### AS-IS

1. Anh xem video/đọc web, hover/bôi từ "present" → popup mở.
2. Popup merge mọi dictionary: IPA lấy entry đầu tiên match (có thể /ˈprezənt/ của noun), senses liệt kê phẳng kèm `[pos]` per sense, frequency = 1 số per list (không biết rank của POS nào).
3. Anh đọc nghĩa verb nhưng nghe audio noun; mark "present" = learning dù chỉ biết nghĩa verb.
4. Send to card → prefill mang hỗn hợp nhiều POS — card phát âm sai, nghĩa lẫn.

### TO-BE

1. Anh convert COCA + Macmillan bằng `tihoka-convert-dictionary.mjs` → import qua Resources → 2 resources enabled cho English profile.
2. Hover "present" → popup mở ở POS variant đầu tiên (thứ tự provider, vd adjective): IPA variant đó, audio variant đó, COCA rank 1334 kèm genre breakdown, senses adjective, status "present·adjective".
3. Anh mở menu POS → chọn "verb" → popup swap: IPA /prɪˈzent/, rank 818 (bias academic), senses verb, status "present·verb" (unknown), image search query theo verb.
4. Anh cycle status → "present·verb" = learning; "present·adjective/noun" đứng yên; subtitle highlighting/vocab browser dùng rule aggregate đã định (spec quyết).
5. Send to card → prefill = variant verb: đúng IPA, đúng senses đã tick, đúng audio source.

## Stories

- S1: As a learner, I want each POS of a word treated as its own entry so that pronunciation, frequency and meanings match the usage I'm reading — done when a multi-POS lookup shows a POS selector and switching swaps every POS-scoped field.
- S2: As a learner, I want per-POS frequency so that I know which usage is actually common — done when the COCA import stores (term, pos) → rank + total + 5-genre breakdown and the popup shows the selected variant's rank.
- S3: As a learner, I want learning status per (word, POS) so that knowing one usage doesn't mark the whole word known — done when status key = term+pos, old term-level rows vẫn đọc được (fallback), và subtitle highlighting có rule aggregate nhất quán.
- S4: As Anh, I want my local MDX dictionaries converted into Tihoka resources — done when both files convert end-to-end qua `tihoka-convert-dictionary` và import được qua Resources panel.
- S5: As a learner with a single-POS word, I want lookup unchanged — done when entries without POS variants render exactly như hiện tại (không menu, không regression).

## Risks

| Risk | Type | Impact | Team's ability to respond |
|---|---|---|---|
| Per-POS status blast radius: `wordStatusStore` (keyPath term), sync outbox key `word:<term>`, `wordTrashStore`, `ankiStatusSync`, subtitle tokenize highlight, vocabulary browser — re-key đụng merge policies + migration | internal | high | Model overlay `term+pos` với fallback term-level — quyết ở SPECIFY; cần migration plan + sync key format mới |
| POS label mismatch cross-source (COCA `j` vs Macmillan `adjective`) → variants không join, frequency rơi nhánh sai | internal | high | Normalization table canonical pos names; verify bằng sample join test trong converter |
| Macmillan markup variance trong 173k keys — adapter cover một phần | external/data | medium | `--stats` + spot-check `--only` trên mẫu đa dạng; unknown markup skip theo invariant, không guess-split |
| Macmillan 2nd Ed font-tag markup (67k keys) — color-coded parse, edge cases (senses rớt format, homograph không pos) có thể miss accent hoặc gán nhầm branch | external/data | medium | Parse per-homograph bằng marker `<sup>N</sup>` + UK/US labels; accent-only fallback: senses 2nd Ed vẫn import như dictionary thường, prons merge theo pos key |
| `.mdd` audio deferred → per-POS audio chưa có, UX chưa trọn | scope | low | Phase sau; audio fallback Forvo/community/TTS vẫn hoạt động |
| Copyright: data MDX là của user, không được đóng gói/ship | legal | medium | Boundary giữ nguyên: converter offline, output file local user import |
| Per-POS status + aggregate rule cho highlighting có thể gây confusing (verb learning nhưng từ vẫn highlight known?) | UX/hidden | medium | SPECIFY định nghĩa rule rõ (vd worst-of / best-of / per-surface-pos guess) + test |

## Decision

go — data nguồn verified đúng cấu trúc per-POS, converter + adapter nền đã có, giá trị học tập rõ; rủi ro lớn nhất (per-POS status re-key) nằm trong domain đã kiểm soát, quyết được ở SPECIFY.

## Draft Acceptance Criteria

- [ ] Convert COCA MDX → frequency resource: mỗi (term, pos) có rank + total + 5-genre breakdown; import qua Resources thành công.
- [ ] Convert Macmillan MDX → dictionary resource: mỗi homograph giữ riêng pronunciation, frequencyStars, senses, inflections; import thành công.
- [ ] Lookup từ đa POS → popup hiện POS selector; default = POS đầu theo provider order; switch swap reading/audio slot/frequency chip/definitions/image query/status.
- [ ] Status write/read keyed (term, pos); rows term-level cũ vẫn đọc được; subtitle highlight theo aggregate rule đã spec.
- [ ] Single-POS entry render y hệt hiện tại — zero regression.
- [ ] Không byte vendor data nào trong shipped bundle; converter chạy offline bằng file local.
