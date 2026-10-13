# Spec: POS-variant dictionary model — per-POS frequency, pronunciation, status, senses

> Intent: `docs/intent/pos-dictionary-variants.md` · ui_surface: yes · Mode: interactive

## Objective

Một từ đa loại (`present`) được model là nhiều **POS variant** độc lập — mỗi variant mang riêng pos, IPA+accent, audio ref, frequency (rank + genre breakdown), frequencyStars, inflections, senses và word status. Converter trích xuất 3 file MDX của user (COCA, MacmillanEnEn, Macmillan 2nd Ed) thành canonical resources import được qua pipeline hiện có; lookup merge các rows theo normalized pos thành variants; popup cho chọn variant (default = đầu tiên) và swap toàn bộ POS-scoped content; status lưu per (term, pos) với aggregate rule cho term-level consumers.

## Actor ↔ System Boundary

| Actor | Triggers | Inputs | Receives/Views |
|---|---|---|---|
| Anh (user) | Convert scripts, import file qua Resources, hover/click từ, chọn POS variant, chọn accent, cycle status, send to card | file paths, resource files, POS/accent selection, status intent | popup variant content, POS bar, accent chip, frequency chips, status pill, card prefill |
| Converter (offline script) | user-invoked `node scripts/tihoka-convert-*.mjs` | MDX files | canonical json files |
| External audio services (Forvo/community/TTS) | popup media requests | term (+accent preference) | audio items (accent-labeled khi có) |

System-internal: parse/merge/group/store/render — không chứa human behavior.

## Canonical POS normalization (N7 — SSOT)

Single module `src/shared/lib/posNormalize.ts` — used by app at lookup AND by converter via jiti (precedent: converter imports `normalize/canonical.ts` the same way). One direction only: `normalizePos(raw: string): string` → lowercase + alias map. Canonical set (open — unmapped raw values pass through lowercased):

```
j, adj, adjective              → adjective
n, noun                        → noun
v, verb, v.t, v.i              → verb
r, adv, adverb                 → adverb
p, pron, pronoun               → pronoun
i, prep, preposition           → preposition
c, conj, conjunction           → conjunction
d, det, determiner, article    → determiner
u, interj, interjection        → interjection
m, num, numeral                → numeral
t, particle                    → particle
modal, auxiliary               → auxiliary
phrasal verb                   → phrasal verb
phrase, expression             → phrase
thesaurus                      → thesaurus
slang                          → slang
'' (empty)                     → '' (unpos'd bucket — never renders as a POS option)
```

COCA single-letter codes map through the same table. Compound labels giữ nguyên (`phrasal verb`, `modal verb`).

## Requirements

### Functional

**REQ-1: Convert COCA 60000 → per-POS frequency json**
- Actor: Anh (runs `node scripts/tihoka-convert-frequency.mjs <coca.mdx> -o out.json`)
- Goal: file json-frequency có 1 object per (term, pos)
- Preconditions: file MDX tồn tại, `js-mdict` devDep
- Basic flow:
  1. actor invokes script with input path
  2. system streams MDX records via js-mdict → per record, `coca` adapter parses each `span.pos`+`span.rank`+`div.total`+genre `div.freq` block
  3. system normalizes pos qua `posNormalize`, emits `{term, pos, rank, total, genres:{spoken,fiction,magazine,newspaper,academic}}` per block
  4. system ghi JSON array ra `-o` path + in stats (entries/pos variants/skipped)
- Alt flow: `--limit N`, `--only a,b`, `--stats` (reuse converter conventions)
- Exception: record không có `div.coca` hoặc không block nào có rank → skip, count vào stats; malformed rank → drop block
- Rules: frequency field = COCA rank (lower = more frequent, khớp `rankToBand` semantics); genre keys canonical `spoken|fiction|magazine|newspaper|academic`; không emit entries cho pos codes lạ → vẫn emit (normalizePos pass-through)
- Postcondition: `<out>.json` chứa array `{term,pos,rank,total,genres}`
- NFR refs: NFR-6 (offline, no vendor data shipped)

**REQ-2: Convert MacmillanEnEn → per-homograph dictionary json-entries**
- Actor: Anh (runs `tihoka-convert-dictionary.mjs`)
- Goal: mỗi homograph = 1 entry riêng mang đủ POS-scoped fields
- Preconditions: file MDX + adapter `macmillan.mjs`
- Basic flow:
  1. iterMdx dispatch record → macmillan adapter
  2. adapter split `.homograph` blocks; per block extract `part-of-speech-ctx`→pos, `.prons` children → `prons:[{accent:'AmE', ipa, audioRef}]` (file này chỉ `us_pron`), `.stars-grp` count→frequencyStars, `.wordforms`→inflections (scoped block đó), senses/sub-senses/related như hiện tại
  3. adapter yield 1 entry per homograph (không merge vào 1 record); entry-level fields shared (etymology/wordFamily…) attach vào entry đầu
  4. converter normalize + write json-entries
- Alt flow: homograph không `part-of-speech-ctx` → pos='' bucket (vẫn emit)
- Exception: `.prons` absent → prons=[] (IPA fallback các dict khác); markup lạ → skip theo invariant, không guess-split
- Rules: senses trong homograph giữ `sense.pos` = block pos (compat với flat rendering); `pronunciation` field = first prons ipa (legacy readers); audio refs giữ `sound://` verbatim (mdd phase sau mới resolve)
- Postcondition: json-entries có N rows/term (1 row/homograph), mỗi row có pos+prons+frequencyStars+inflections scoped
- NFR refs: NFR-6, NFR-3

**REQ-3: Convert Macmillan 2nd Ed → per-homograph dual-accent json-entries**
- Actor: Anh (runs `tihoka-convert-dictionary.mjs`)
- Goal: BrE+AmE IPA per POS
- Preconditions: file MDX (font-tag markup)
- Basic flow:
  1. adapter mới `macmillan2ed.mjs` — matches(): `UK`/`US` font-label + `sound://zzz_(uk|us)_` pattern HOẶC `<sup>N</sup>` homograph marker + UK/US label (record thiếu audio ref vẫn match qua label+IPA pattern — không skip)
  2. split homograph bằng `<sup>N</sup>` headword marker; per block parse `UK` + `sound://zzz_uk_*.wav` + `[ipa]` → `{accent:'BrE', ipa, audioRef}`; `US` + `zzz_us_*` → `{accent:'AmE', ...}`; `noun|verb|…` pos text; `★+`→frequencyStars; numbered senses + `[labels]` + italic examples → senses
  3. yield 1 entry/homograph
- Alt flow: block thiếu UK/US pair → prons chỉ accent có sẵn; block senses không parse được → vẫn emit entry (prons-only enrichment row — merge vẫn dùng được)
- Exception: format lạ → skip record; IPA không nằm trong `[…]` → drop pron đó, giữ cái còn lại
- Rules: audioRef `sound://` verbatim; senses cùng shape SenseBlock (pos=block pos, lines gloss/example)
- Postcondition: json-entries với dual-accent prons per (term,pos)
- NFR refs: NFR-6, NFR-3

**REQ-4: Import `json-frequency` format → FrequencyEntry có pos+genres**
- Actor: Anh (kéo file vào Resources, chọn type FREQUENCY)
- Goal: per-POS frequency rows trong `langFrequencyEntry`
- Preconditions: file output REQ-1
- Basic flow:
  1. detectFormat: `'json-frequency'` thêm vào union `ImportFormat`; JSON sniff block: array of objects có `term` + (`rank`|`frequency`) và KHÔNG có `definition` → `json-frequency` (check sau `looksLikeJsonEntries`, trước extension fallback — freq objects thiếu `"definition"` nên không xung đột)
  2. JsonFrequencyStrategy extends BaseFrequencyStrategy: row → `{resourceId, term, reading:term, frequency:rank, pos:normalizePos(pos), total, genres}`
  3. bulkInsert như strategy hiện tại
- Alt flow: object thiếu `pos` → pos=undefined (term-level row — vẫn là frequency hợp lệ); thiếu genres → bỏ qua
- Exception: array strings (json-array cũ) → vẫn route strategy cũ (không regression); invalid JSON → ParseError
- Rules: `frequency` = rank nguyên ≥0; genres chỉ 5 keys canonical; dedupe (term,pos) cùng resource: first-wins
- Postcondition: `findFrequencyByTerm` trả cả pos-rows + term-rows của term đó
- NFR refs: NFR-3

**REQ-5: Lookup assembly — PosVariant merge**
- Actor: extension (hover/click lookup)
- Goal: LookupResult có `variants: PosVariant[]` — mỗi variant là merged view của 1 normalized pos
- Preconditions: resources imported; term có dict/freq rows
- Basic flow:
  1. system query dict rows + freq rows + status như hiện tại
  2. group: mỗi dict row → variantKey = normalizePos(row.pos || first sense.pos || ''); senses trong row group theo normalizePos(sense.pos ?? row.pos ?? '') — sense không pos rơi vào variant '' (other)
  3. per variant, merge theo provider priority: senses concat (invariant 2 — không align), prons concat dedupe per accent (first-wins), frequencyStars first-wins (singleton merge rule, invariant tihoka-dict-v1), inflections concat, audio refs concat
  4. freq rows: pos-row join variant cùng normalizePos(pos); pos-less rows → term-level fallback áp vào MỌI variant; variant.frequencies = posRows + fallback, sort theo resourcePriority rồi rank
  5. status per variant = `term␟pos` row ?? `term` row ?? 'unknown'
  6. variant '' (other) cuối list; variants order = thứ tự xuất hiện đầu tiên trong merged senses (provider priority order)
- Alt flow: term không có dict row nhưng có freq pos-rows → variants từ pos của freq rows (chỉ frequency, không senses); single variant → bar không render (REQ-6)
- Exception: zero variants → variants=[] → popup render đúng như hiện tại (REQ-11)
- Rules: variant '' (pos-less senses) = variant bình thường hiện label `other` trong POS bar, luôn xếp cuối — không được giấu (invariant 6); chỉ khi variants = duy nhất '' thì bar ẩn. `partsOfSpeech` field giữ nguyên semantics hiện tại (raw dedup, không normalize — compat); normalized pos chỉ sống trong `variants[].pos`
- Postcondition: `LookupResult.variants` + flat `definitions`/`partsOfSpeech`/`reading`/`frequencies`/`status` giữ nguyên (compat)
- NFR refs: NFR-1 (≤1s), NFR-3

**REQ-6: Popup POS selector + variant swap**
- Actor: Anh
- Goal: chọn variant → toàn bộ POS-scoped content thay đổi
- Preconditions: LookupResult.variants.length ≥ 2
- Basic flow:
  1. system render POS bar đầu popup (trên headword row): `adjective | verb | noun` — theme tokens, text-link style, selected state rõ
  2. default selected = variants[0]
  3. actor clicks variant → system re-render: IPA+accent, audio default, frequency chips (variant.frequencies), status pill (variant.status), senses (variant.definitions), inflections (variant), image panel REFETCH với query mới `${term} ${pos}` (cache key đổi theo query — image cache hiện có xử lý), media tabs giữ nguyên mount
  4. shared blocks (related/etymology/wordFamily/wordNet/derivedTerms + audio list + translate/links) không đổi — render dưới variant content như cũ
- Alt flow: 1 variant → bar ẩn, render như cũ; selection persist trong popup session (PopupSelectionSnapshot pattern)
- Exception: variant vừa chọn bị mất data (resource disabled mid-session) → fallback variants[0]
- Rules: swap không re-fetch lookup — variants đã đủ data; keyboard operable (arrow/tab + enter); i18n labels qua messages (pos names có key riêng, fallback raw label)
- Postcondition: UI state = selected variant; downstream (status cycle, card prefill) dùng variant đó
- NFR refs: NFR-1, NFR-4, NFR-5

**REQ-7: Accent toggle trước IPA**
- Actor: Anh
- Goal: đổi accent hiển thị của variant đang chọn
- Preconditions: variant.prons.length ≥ 1
- Basic flow:
  1. system render `AmE`/`BrE` label trước IPA (default = prons[0].accent)
  2. actor taps label → cycle qua accents có sẵn → IPA + audio default swap tương ứng
  3. label hiện accent đang active; accent không có data → không xuất hiện trong cycle
- Alt flow: prons chỉ 1 accent → label hiện nhưng không toggle (non-interactive state); 0 prons → fallback `reading` cũ, không label
- Exception: none
- Rules: persist global last-used accent trong settings (áp cho lookup sau, per-lang); audio panel items có accent tag (US/UK pronunciation) thì default-select item khớp accent đang chọn khi có
- Postcondition: variant view hiện IPA của accent được chọn
- NFR refs: NFR-4, NFR-5

**REQ-8: Word status per (term, pos)**
- Actor: Anh (cycle status trên variant), sync engine, Anki sync
- Goal: status độc lập giữa các variant
- Preconditions: popup render variant
- Basic flow:
  1. store `langWordStatus` giữ keyPath `term`; pos-row: `row.term` chứa LITERAL composite `term␟pos` (␟ = U+241F) + field `pos` = normalized pos (convenience — consumers tách trên ␟); term-part = cùng surfaceTerm form mà `setWordStatus` nhận hôm nay (không thêm normalization — read/write/sync phải khớp)
  2. read(term, pos) = row `term␟pos` ?? row `term` ?? 'unknown'
  3. actor cycle trên variant → write key `term␟pos` (cycle hiện tại: unknown→tracking→learning→known→ignore)
  4. sync capture key `word:term␟pos` cho pos rows — merge policies không đổi (key opaque)
- Alt flow: cycle ở variant '' → write term-level row (behavior cũ)
- Exception: quota error → WordStatusQuotaError flow hiện có; 'unknown' write = delete pos-row (giữ normalization point)
- Rules: Anki/sync writes hiện tại vẫn vào `term` key (term-level default cho variants chưa có pos row — pos rows luôn thắng term row khi đọc variant đó)
- Postcondition: status pill đổi độc lập giữa variants; `wordTrashStore` áp cho full key
- NFR refs: NFR-2 (zero migration), NFR-3

**REQ-9: Aggregate status + frequency cho term-level consumers**
- Actor: system (subtitle tokenizer, vocab browser, media score)
- Goal: term-level view nhất quán khi data đã per-POS
- Preconditions: pos rows tồn tại cho term
- Basic flow:
  1. status aggregate = least-learned trên RESOLVED status của mọi variant đã biết (resolved = pos-row ?? term-row ?? 'unknown'; ignore rows excluded): order unknown < tracking < learning < known. Variant set = pos có trong status pos-rows ∪ pos của dict entries (callers có dict data — lookup/vocab browser — truyền vào; hot-path chỉ có status rows → variant set = pos trong status rows, xem Alt flow)
  2. frequency band: min rank across all freq rows của term (pos + term-level) — band tính theo best-case (không over-flag)
  3. consumers gọi aggregate helper — không tự đọc raw rows
- Alt flow: helper API `getPosStatusRows(lang, term)` = prefix scan `IDBKeyRange.bound(term+'␟', term+'␟\uffff')` trong 1 tx; `getPosStatuses(lang, terms[])` batch per-term trong 1 tx; display consumers split key trên `␟` (vocab browser, ankiStatusSync). Caller không truyền variant set (subtitle hot path) → aggregate chỉ trên materialized rows + term fallback — approximation được ghi nhận: variant chưa-track coi như không tồn tại trong context đó
- Exception: tất cả variants 'ignore' → aggregate 'ignore' (explicit opt-out); zero rows → 'unknown'
- Rules: aggregate chỉ READ — UI vocab browser có thể hiện breakdown per pos (feature sau), không bắt buộc phase này
- Postcondition: context có dict data → highlight/vocab phản ánh "còn usage chưa biết"; hot-path xấp xỉ = least-learned của tracked rows
- NFR refs: NFR-3

**REQ-10: Card prefill = selected variant**
- Actor: Anh (send to card / quick add)
- Goal: card mang đúng variant đang xem
- Preconditions: variant selected, senses ticked
- Basic flow:
  1. prefill.pos = variant.pos; prefill.pronunciation = active accent IPA; senses = variant.definitions đã tick; status = variant.status
  2. audio item = default của accent đang chọn nếu có
- Alt flow: variant '' → prefill như hiện tại
- Exception: none
- Rules: không đổi Anki note model — variant fields map vào prefill fields hiện có
- Postcondition: card có đúng IPA/nghĩa của usage đã chọn
- NFR refs: —

**REQ-11: Regression — lookup không đổi với entry không có POS data**
- Actor: Anh
- Goal: single-POS/no-POS lookups render y hệt hôm nay
- Basic flow: variants ≤1 → không bar, không accent label khi 0-1 prons, status/frequency/reading flow cũ
- Rules: mọi consumer đọc `definitions`/`reading`/`frequencies`/`status` cũ vẫn nhận giá trị như trước (variants là field THÊM, không thay)
- Postcondition: zero regression — test suite hiện có xanh
- NFR refs: NFR-3

### Non-functional (NFR)

| ID | Requirement | Class | Target |
|---|---|---|---|
| NFR-1 | Lookup latency không tăng đáng kể — variant assembly O(rows) in-memory | P | ≤1s budget hiện có trên 4GB RAM |
| NFR-2 | Zero migration: stores/rows cũ đọc được không thay đổi | R | old term-keyed status rows, old freq rows, old dict rows valid |
| NFR-3 | Invariants tihoka-dict-v1 giữ nguyên: no vendor names trong schema/UI, never align senses, unknown markup không split | R | enforced trong review |
| NFR-4 | i18n + a11y: mọi label mới qua messages; POS bar + accent toggle keyboard+screen-reader operable | U | WCAG cơ bản |
| NFR-5 | UI theo design system: tokens, Menu/MenuItem nếu là danh sách chọn, ICON_CATALOG | U | design-system-guardian gate |
| NFR-6 | Converter offline, chạy bằng file local; không byte vendor data trong shipped bundle (`dist/`) | +legal | grep dist không thấy dict content |
| NFR-7 | Pos-aware writes không phá sync: key `word:term␟pos` flow qua outbox/merge như key thường | R | sync e2e hiện có xanh |

## Flows / States

### Variant assembly (lookup)

```
term rows (dict) ──group by normalizePos(row.pos||sense.pos||'')──▶ variantMap
freq rows ──pos?──▶ join variant │ ──pos-less──▶ term-level fallback → all variants
status rows ──'term␟pos' hit?──▶ variant.status │ miss ──▶ 'term' row ?? unknown
variant order = first-appearance in merged senses ('other' luôn cuối)
```

### Status resolution

```
read(term,pos):  store.get('term␟pos') → hit → status
                 miss → store.get('term') → hit → status
                 miss → 'unknown'
write(term,pos,status): put key 'term␟pos' (status='unknown' → delete key)
posRows(term):   index by_term range [term+'␟', term+'␟\uffff'] → rows
aggregate(term, variantPosSet?):
                 variants = (variantPosSet ?? pos trong posRows) ∪ {'' nếu term-row có}
                 resolved = variant → posRows[pos] ?? termRow ?? 'unknown'
                 nonIgnored.empty → 'ignore' nếu có bất kỳ row nào else 'unknown'
                 → least-learned(resolved): unknown < tracking < learning < known
```

### Popup swap

```
select variant V ──▶ IPA row = V.prons[accentIdx] (accent chip cycles prons)
                     frequency chips = V.frequencies (band per rank)
                     status pill = V.status (cycle → write term␟pos)
                     senses = V.definitions (tick state per variant snapshot)
                     image query = `${term} ${V.pos}`
                     inflections = V.inflections
shared: related, etymology, wordFamily, wordNet, derivedTerms, audio list,
        translate, links — render unchanged
```

## Alternatives considered

| Decision | Chosen | Rejected | Why |
|---|---|---|---|
| Status key scheme | Composite `term␟pos` trong `langWordStatus` (keyPath 'term' giữ nguyên) | Store mới keyPath `[term,pos]`; pos field + non-unique index | Zero migration — term rows cũ đọc y nguyên; sync merge coi key là opaque; `[term,pos]` keyPath buộc rebuild store + migrate rows; index-only không enforce được uniqueness per (term,pos) |
| Variant materialization | Group at lookup từ stored rows | `variants` field materialize lúc import | Provider merge (priority, component toggles) quyết định senses/prons join vào variant nào — chỉ biết được at lookup; materialize sớm = double storage + stale data khi user đổi priority/toggles |
| Macmillan homograph rows | 1 DictionaryEntry row per homograph (pos+prons+stars+senses scoped) | 1 row/record + `variants[]` sub-structure | Store/index/query không đổi; component toggles + per-resource merge chạy đúng trên rows; sub-structure buộc schema mới + merge logic mới |
| POS-less senses | variant `other` hiện trong bar (label i18n) | attach vào variant đầu / giấu | Invariant 6: user selects — content không bị giấu |

## Function ↔ Feature Map

| Function | Features |
|---|---|
| Resolve lexical unit theo (term,pos) | POS normalization table; PosVariant assembly trong lookupOrchestrator; per-pos frequency join; per-pos status read w/ term fallback |
| Trích xuất external data thành canonical | `dict-adapters/coca.mjs`; `dict-adapters/macmillan2ed.mjs`; `macmillan.mjs` per-homograph upgrade; `tihoka-convert-frequency.mjs` |
| Ingest per-POS frequency | `json-frequency` ImportFormat + JsonFrequencyStrategy; FrequencyEntry +pos+total+genres |
| Present + navigate variants | POS bar (text links `a | v | n`, theme tokens); accent chip toggle; variant-scoped swap render; selection snapshot |
| Track knowledge per usage | pos-keyed wordStatus rows; aggregate status helper (least-learned); status pill cycle per variant; sync key `word:term␟pos` |
| Preserve term-level views | aggregate frequency (min rank band); aggregate status; flat `definitions` compat |

## Data

| Entity | Key fields | Lives in | Retention |
|---|---|---|---|
| `DictionaryEntry` (+`prons`) | term, pos, `prons:[{accent,ipa,audioRef}]`, frequencyStars, senses, inflections | `langDictionaryEntry` (IndexedDB, per-lang db) | until resource deleted |
| `FrequencyEntry` (+`pos`,`total`,`genres`) | term, pos?, frequency(=rank), total?, genres{spoken,fiction,magazine,newspaper,academic} | `langFrequencyEntry` | until resource deleted |
| `WordStatusEntry` (+`pos` implicit via key) | key `term` or `term␟pos`, status, updatedAt, source, sourceAt | `langWordStatus` (keyPath 'term') | user lifecycle + trash window |
| `PosVariant` (derived, không store) | pos, prons, frequencies, status, definitions, inflections, frequencyStars | in-memory LookupResult | per lookup |
| POS normalization table | raw → canonical map | `src/shared/lib/posNormalize.ts` | code |

## Traceability

| Need | REQ | AC |
|---|---|---|
| N1 COCA per-POS freq | REQ-1, REQ-4 | SC-1, SC-2 |
| N2 Macmillan per-homograph | REQ-2 | SC-3 |
| N3 POS selector + swap | REQ-5, REQ-6 | SC-4, SC-5 |
| N3b accent toggle | REQ-3, REQ-7 (+REQ-2 prons) | SC-6 |
| N4 per-POS status | REQ-8, REQ-9 | SC-7, SC-8 |
| N5 multi-list freq per variant | REQ-5 | SC-9 |
| N6 no vendor data shipped | REQ-1..3 boundary | SC-10 |
| N7 pos normalization join | `posNormalize` + REQ-5 | SC-2, SC-11 |
| journey S5 regression | REQ-11 | SC-12 |
| card prefill variant | REQ-10 | SC-13 |

| Journey step | REQ |
|---|---|
| TO-BE 1 convert+import | REQ-1, REQ-2, REQ-3, REQ-4 |
| TO-BE 2 popup variant đầu | REQ-5, REQ-6, REQ-7 |
| TO-BE 3 chọn variant swap | REQ-6, REQ-7 |
| TO-BE 4 cycle status độc lập | REQ-8, REQ-9 |
| TO-BE 5 card mang variant | REQ-10 |

## Boundaries

- Always: converter = ONLY place vendor markup được parse (script, js-mdict); `posNormalize` là SSOT duy nhất cho pos mapping; shared blocks (etymology/related/…) không scope theo variant; `pronunciation`/`reading`/`frequencies`/`status`/`definitions` cũ không bị break; gates trước commit.
- Ask first: thêm dependency; sửa `manifest.json`; đổi Anki note model; ship vendor data; mdd audio extraction (phase 2 — item riêng).
- Never: parse MDX trong app; vendor names trong schema/UI; guess-split markup lạ; store audio bytes trong IndexedDB phase này (chỉ refs); đổi `Tihoka-key.pem`/manifest key.

## Success Criteria

- [ ] SC-1: `tihoka-convert-frequency.mjs` trên COCA MDX → json có 1 object per (term,pos); `present` có 4 rows (adjective 1334, noun 2259, verb 818, adverb 8560) mỗi row kèm total + 5 genres.
- [ ] SC-2: File SC-1 import qua Resources (type FREQUENCY) thành công; `findFrequencyByTerm('en','present')` trả ≥4 pos-rows có pos+genres; pos đã normalize.
- [ ] SC-3: Convert MacmillanEnEn → json-entries: `present` = 3 entries (adjective/verb/noun), mỗi entry pos+prons(AmE)+frequencyStars+senses+inflections scoped; `water` giữ wordforms.
- [ ] SC-4: Lookup `present` với 3 resources → variants đúng order (adjective, verb, noun); mỗi variant senses chỉ của pos đó, concat đủ providers.
- [ ] SC-5: Popup `present` hiện bar `adjective | verb | noun`; chọn verb → IPA /prɪˈzent/, freq chips verb (818), status verb, senses verb — swap không re-fetch.
- [ ] SC-6: Variant có cả 2 accents → `AmE /…/` tap → `BrE /…/`; IPA đổi đúng; chỉ 1 accent → label non-interactive.
- [ ] SC-7: Cycle status trên present·verb → store key `present␟verb` = learning; present·noun pill vẫn unknown; reopen popup giữ đúng.
- [ ] SC-8: Term chỉ có term-row cũ (không pos rows) → status/aggregate đọc như cũ (zero migration); có pos rows → aggregate = least-learned non-ignored.
- [ ] SC-9: Multi frequency lists → variant.frequencies có chip per list cho pos đang chọn, sort resourcePriority→rank.
- [ ] SC-10: `dist/` build không chứa dictionary content; converters chạy offline.
- [ ] SC-11: Frequency pos `j` join được variant `adjective` (normalizePos); pos lạ pass-through vẫn group riêng.
- [ ] SC-12: Lookup từ 1-POS/no-POS → UI y hệt hiện tại; `npm run test:unit` hiện có xanh không sửa expected.
- [ ] SC-13: Send-to-card từ variant verb → prefill pos=verb, IPA accent đang chọn, senses verb đã tick.
- [ ] SC-14: Entry có cả named variants lẫn pos-less senses → POS bar hiện `other` ở cuối; chọn `other` render đúng senses pos-less (không giấu content).
- [ ] SC-15: `present` có dict rows cho adjective/noun/verb + status row `present␟verb`=learning (không term row, không pos rows khác) → aggregate với variant set từ dict data = 'unknown' (adj/noun chưa biết); aggregate không variant set (hot-path) = 'learning' — cả hai ghi nhận trong test.

## Definition of Done

- [ ] All Success Criteria pass
- [ ] `npm run typecheck && npm run lint && npm run test:unit && npm run build` green
- [ ] UI changes pass design-system check (tokens, Menu nếu choice-list, i18n, a11y)
- [ ] Real-Chrome verify trên popup thật (packed .crx) — screenshot POS bar + swap + accent toggle
- [ ] Canon docs updated: `docs/2-architechture-system.md` (stores/schema), `docs/0-wiki.md`, ADR cho per-POS status key + posNormalize
- [ ] Converted files cho Anh đặt ở path thống nhất + hướng dẫn import

## Open Questions / Accepted Risks

- Default accent khi variant có cả hai: prons[0] theo provider order (MacmillanEnEn=AmE thường đứng trước 2nd Ed) — DESIGN confirm; global accent preference lưu settings (`lastUsedAccent` per lang).
- `other` variant (pos-less senses) render label `other` — copy i18n cần key.
- Anki/sync status writes vẫn term-level (không biết pos) — accepted: pos rows là user-authored overrides; Anki card ↔ pos mapping phase sau.
- Per-POS audio: audioRef `sound://` chưa resolve (mdd phase 2) — accent toggle chỉ swap IPA text + best-effort default audio item khi provider label accent (US/UK pronunciation).
- Genre breakdown UI: store đủ; surface ở frequency chip tooltip/detail — DESIGN quyết.
- COCA pos codes ngoài bảng map (vd `x`, `e`, `g`) vẫn emit — group thành variant label-thô; không block.
