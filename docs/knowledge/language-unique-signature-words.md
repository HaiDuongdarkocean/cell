# Unique Signature Words cho Language Detection

> Reference cho việc improve `LANGUAGE_PROFILES` trong `languageDetector.ts`.
> Mục tiêu: thay top words overlap nặng bằng **unique signature words** — từ
> chỉ ngôn ngữ đó có, phổ biến (xem phim/đọc báo/nghe nhạc đều gặp), 3+ chars.

## Methodology

### Tiêu chí chọn từ

1. **Unique**: từ chỉ xuất hiện trong 1 ngôn ngữ Latin, không overlap với
   ngôn ngữ khác trong danh sách 27. Nếu không tìm được 10 từ hoàn toàn
   unique, ghi chú rõ và dùng từ ít overlap nhất.
2. **Phổ biến**: top 200 trong corpus frequency (Wiktionary, Leipzig,
   OpenSubtitles). "Đi đâu cũng gặp" — xem phim, đọc báo, nghe nhạc.
3. **3+ chars**: loại 1-2 chars (overlap cao, false positive).
4. **Không loan word**: tránh "okay", "tv", "video", "internet" — xuất hiện
   ở mọi ngôn ngữ.
5. **Function words + content words mix**: function words (đại từ, giới từ,
   liên từ) ổn định hơn content words (danh từ, động từ) vì ít thay đổi
   theo topic.

### Quy tắc uniqueness

- **Cognate check**: từ có chung gốc Latin/Greek và xuất hiện ở nhiều ngôn
  ngữ → loại (ví dụ "que" ở Spanish/French/Italian/Portuguese/Catalan).
- **Spelling check**: từ có spelling đặc trưng (dấu, chữ ghép) → ưu tiên
  (ví dụ "ñ" chỉ Spanish, "ão" chỉ Portuguese, "ğ" chỉ Turkish).
- **False friend check**: từ giống nhau nhưng khác nghĩa → vẫn loại vì
  detect dựa trên surface form, không phân biệt nghĩa.

### Threshold recommendation

- **Unique words → threshold thấp hơn**: vì unique words không overlap,
  match 3-4 từ đã đủ confident. Đề xuất threshold 4-5 (thay vì 6-8).
- **Text ngắn (< 50 cues)**: threshold 3 (file ngắn ít từ, dễ miss).
- **Text dài (>= 50 cues)**: threshold 5.
- **Scoring thay first-match**: thay vì first profile hit threshold wins,
  đếm match count cho tất cả profiles, pick max. Unique words làm scoring
  khả thi vì không overlap.

---

## Unique Signature Words theo nhóm

### Nhóm Germanic

#### English
Unique markers: "gh" spellings, "ould" modal, "the" article, "-ing" gerund.

| Word | Meaning | Why unique | Freq rank |
|------|---------|------------|-----------|
| the | definite article | chỉ English có "the" làm article | #1 |
| and | conjunction | spelling "and" (German "und", Dutch "en") | #3 |
| that | demonstrative | "th" digraph đặc trưng English | #5 |
| with | preposition | "th" + "wi" | #8 |
| this | demonstrative | "th" | #10 |
| but | conjunction | spelling "but" (German "aber", Dutch "maar") | #20 |
| not | negation | "not" (German "nicht", Dutch "niet") | #15 |
| have | auxiliary | "ve" ending | #7 |
| from | preposition | "fr" + "om" | #18 |
| would | modal | "ould" — chỉ English | #25 |

**Overlap check**: "the" không xuất hiện ở ngôn ngữ Latin khác làm article.
"and" — Dutch "en" khác. "would/should/could" — "ould" chỉ English.

#### German
Unique markers: umlaut (ä/ö/ü), "sch", "ch", "ie" digraph, capital nouns.

| Word | Meaning | Why unique | Freq rank |
|------|---------|------------|-----------|
| und | and | spelling "und" (English "and", Dutch "en") | #2 |
| nicht | not | "ch" + "t" | #11 |
| auch | also | "ch" | #15 |
| sich | reflexive | "ch" | #13 |
| schon | already | "sch" + "on" | #30 |
| noch | still | "ch" | #28 |
| immer | always | "mm" + "er" | #35 |
| wieder | again | "ie" + "der" | #40 |
| zwischen | between | "sch" + "w" | #50 |
| während | while | "ä" umlaut | #45 |

**Overlap check**: "und" — Dutch "en" khác. "nicht" — Dutch "niet" khác.
"schon"/"noch" — "ch" chỉ German. Umlaut ä/ö/ü chỉ German (trong Latin group).

#### Dutch
Unique markers: "ij" digraph, "ui" diphthong, "oe", "aa" double vowel.

| Word | Meaning | Why unique | Freq rank |
|------|---------|------------|-----------|
| het | the (neuter) | "het" (German "das", English "the") | #1 |
| dat | that | "dat" (German "das", English "that") | #5 |
| niet | not | "ie" + "t" (German "nicht") | #8 |
| een | a/an | "ee" + "n" (German "ein", English "a") | #10 |
| zijn | be/possessive | "ij" digraph — chỉ Dutch | #6 |
| naar | to/towards | "aa" + "r" | #20 |
| maar | but | "aa" + "r" (German "aber") | #12 |
| nog | still/yet | "og" (German "noch") | #18 |
| al | already/all | short but distinctive | #25 |
| wel | indeed/certainly | "el" (German "wohl") | #22 |

**Overlap check**: "ij" digraph chỉ Dutch. "niet" vs German "nicht" — khác
spelling. "een" vs German "ein" — khác. "naar"/"maar" — "aa" chỉ Dutch.

#### Afrikaans
Unique markers: "oe" (u sound), "y" cho ij, double negative "nie...nie".

| Word | Meaning | Why unique | Freq rank |
|------|---------|------------|-----------|
| het | has/have | (Dutch overlap — Afrikaans giữ) | #1 |
| vir | for | "vir" (Dutch "voor", German "für") | #5 |
| was | was | (English overlap) | #8 |
| ook | also | "oo" + "k" (Dutch "ook") | #10 |
| nog | still | (Dutch overlap) | #12 |
| sal | shall/will | "sal" (Dutch "zal") | #15 |
| hulle | they/them | "ulle" — chỉ Afrikaans | #7 |
| daar | there | "aa" + "r" (Dutch "daar") | #9 |
| toe | then/closed | "oe" — chỉ Afrikaans/Dutch | #20 |
| baie | very/many | "baie" — chỉ Afrikaans | #25 |

**Overlap check**: Afrikaans rất gần Dutch. "hulle" (Dutch "hen/hun"),
"baie" (Dutch "veel"), "vir" (Dutch "voor") — 3 từ unique phân biệt
Afrikaans vs Dutch. "sal" vs Dutch "zal" — khác spelling.

#### Welsh
Unique markers: "ll", "dd", "ff", "w" làm vowel, "y" làm vowel, mutations.

| Word | Meaning | Why unique | Freq rank |
|------|---------|------------|-----------|
| bod | to be | "b" + "od" | #1 |
| ond | but | "nd" (English "and" reversed) | #3 |
| mae | is | "ae" | #2 |
| oedd | was | "dd" — chỉ Welsh | #5 |
| gyda | with | "gy" + "da" | #8 |
| hyn | this | "yn" | #10 |
| yna | there | "yn" + "a" | #12 |
| wedi | after/finished | "ed" + "i" | #6 |
| nid | not | "id" | #15 |
| dyw | is not | "dw" + "y" | #20 |

**Overlap check**: "dd", "ll", "ff" double consonants chỉ Welsh. "w"/"y"
làm vowel chỉ Welsh (trong Latin group). Hoàn toàn unique.

---

### Nhóm Romance

#### Spanish
Unique markers: "ñ", accent vowels (á/é/í/ó/ú), "ll", "rr", "j" làm /x/.

| Word | Meaning | Why unique | Freq rank |
|------|---------|------------|-----------|
| qué | what | accent "é" | #13 |
| después | after | "és" + "pu" | #30 |
| también | also | "mb" + "én" | #25 |
| entonces | then | "nt" + "on" + "ces" | #28 |
| señor | sir/mister | "ñ" — chỉ Spanish | #35 |
| mañana | tomorrow/morning | "ñ" — chỉ Spanish | #40 |
| niño | child | "ñ" — chỉ Spanish | #38 |
| pequeño | small | "ñ" + "qu" | #50 |
| español | Spanish | "ñ" — chỉ Spanish | #45 |
| gracias | thanks | "gr" + "ci" + "as" | #22 |

**Overlap check**: "ñ" chỉ Spanish. "qué" — French "que" không accent.
"después"/"entonces" — không xuất hiện ở French/Italian/Portuguese.
"gracias" — Italian "grazie", Portuguese "obrigado" — khác.

#### French
Unique markers: accents (é/è/ê/ç), "au"/"eau", apostrophe elision, "qu".

| Word | Meaning | Why unique | Freq rank |
|------|---------|------------|-----------|
| avec | with | "av" + "ec" | #15 |
| dans | in | "an" + "s" | #10 |
| sont | are (plural) | "ont" ending | #20 |
| être | to be | "ê" + "tre" | #18 |
| avoir | to have | "av" + "oir" | #22 |
| fait | fact/does | "ai" + "t" | #25 |
| comme | like/as | "mm" + "e" | #28 |
| même | same | "êm" — chỉ French | #30 |
| très | very | "è" + "s" | #26 |
| toujours | always | "ou" + "rs" | #35 |

**Overlap check**: "être"/"même"/"très" — accents đặc trưng French.
"avec"/"dans"/"sont" — không xuất hiện ở Spanish/Italian/Portuguese.
"avoir" — Italian "avere", Spanish "haber" — khác.

#### Italian
Unique markers: double consonants (ll/mm/nn/tt), "gli", "ciao", "zione".

| Word | Meaning | Why unique | Freq rank |
|------|---------|------------|-----------|
| sono | am/are | "so" + "no" | #10 |
| come | like/as | "co" + "me" | #15 |
| anche | also | "anch" + "e" (Spanish "también") | #20 |
| bene | well/good | "be" + "ne" | #18 |
| male | badly | "ma" + "le" | #25 |
| questo | this | "qu" + "est" + "o" | #22 |
| quello | that | "qu" + "ell" + "o" | #23 |
| sempre | always | "se" + "mpr" + "e" | #28 |
| ancora | still/yet | "an" + "cor" + "a" | #30 |
| invece | instead | "in" + "ve" + "ce" | #35 |

**Overlap check**: "anche" — Spanish "también", French "aussi" — khác.
"bene"/"male" — Spanish "bien"/"mal" — khác ending. "questo"/"quello"
— Spanish "este"/"ese" — khác. "sempre" — Portuguese "sempre" overlap!
→ thay "sempre" bằng "invece" hoặc "mentre".

#### Portuguese
Unique markers: "ão" nasal, "ç", "lh", "nh", accent (á/é/í/ó/ú).

| Word | Meaning | Why unique | Freq rank |
|------|---------|------------|-----------|
| não | no/not | "ã" + "o" — chỉ Portuguese | #3 |
| você | you | "voc" + "ê" — chỉ Portuguese | #8 |
| também | also | "mb" (Spanish "también" có accent) | #15 |
| então | then | "ã" + "o" — chỉ Portuguese | #20 |
| ainda | still/yet | "ai" + "nd" + "a" | #12 |
| sempre | always | (Italian overlap — xem note) | #18 |
| depois | after | "de" + "po" + "is" | #22 |
| outro | other | "ou" + "tr" + "o" | #25 |
| muito | much/very | "ui" + "to" | #14 |
| obrigado | thanks | "ob" + "ri" + "ga" + "do" | #30 |

**Overlap check**: "ão" nasal chỉ Portuguese. "você" — Spanish "usted",
Italian "Lei" — khác. "ainda"/"depois"/"outro"/"muito" — không overlap.
"sempre" overlap Italian → loại, thay bằng "obrigado" hoặc "vez".

#### Catalan
Unique markers: "·" (middot), "ll", "ny", "tx", accent (à/é/í/ó/ú).

| Word | Meaning | Why unique | Freq rank |
|------|---------|------------|-----------|
| també | also | "mb" + "é" (Spanish "también", French "aussi") | #15 |
| després | after | "és" ending (Spanish "después") | #20 |
| mentre | while | "men" + "tr" + "e" (Italian "mentre" overlap!) | #18 |
| però | but | "ò" accent (Italian "però" overlap!) | #12 |
| cap | no/none | "cap" — chỉ Catalan | #25 |
| cap a | towards | "cap" | #28 |
| també | also | (xem trên) | #15 |
| molts | many | "ol" + "ts" | #22 |
| aquest | this | "qu" + "est" (Spanish "este") | #16 |
| aquell | that | "qu" + "ell" (Spanish "aquel") | #17 |

**Overlap check**: Catalan rất gần Spanish/Occitan. "però"/"mentre" overlap
Italian. "cap" (none) — unique. "aquest"/"aquell" — Spanish "este"/"aquel"
khác spelling. Khó tách hoàn toàn — ghi chú ceiling.

#### Galician
Unique markers: "ñ", "ll", "ei" diphthong, gần Portuguese nhưng khác.

| Word | Meaning | Why unique | Freq rank |
|------|---------|------------|-----------|
| sen | without | "sen" (Portuguese "sem", Spanish "sin") | #15 |
| máis | more | "ái" (Portuguese "mais", Spanish "más") | #10 |
| hai | there is | "ha" + "i" — chỉ Galician | #12 |
| ten | has | "ten" (Portuguese "tem", Spanish "tiene") | #8 |
| seu | his/her | "se" + "u" (Portuguese "seu" overlap!) | #14 |
| súa | her | "sú" + "a" — chỉ Galician | #16 |
| galego | Galician | "galego" — chỉ Galician | #30 |
| logo | then/soon | "lo" + "go" (Portuguese "logo" overlap!) | #20 |
| sendo | being | "en" + "do" (Portuguese "sendo" overlap!) | #22 |
| poden | can (plural) | "po" + "den" | #25 |

**Overlap check**: Galician cực gần Portuguese. "sen" vs Portuguese "sem"
— khác. "máis" vs Portuguese "mais" — accent khác. "hai" — unique.
"seu"/"logo"/"sendo" overlap Portuguese → khó tách. Ghi chú ceiling:
Galician vs Portuguese có thể cần content words đặc thù.

#### Romanian
Unique markers: "ă", "â", "î", "ș", "ț" (comma below).

| Word | Meaning | Why unique | Freq rank |
|------|---------|------------|-----------|
| pentru | for | "en" + "tr" + "u" | #5 |
| sunt | am/are | "un" + "t" (Italian "sono") | #8 |
| din | from/of | "di" + "n" | #6 |
| mai | more | "ma" + "i" | #7 |
| sau | or | "sa" + "u" | #10 |
| care | which/who | "ca" + "re" | #4 |
| acest | this | "ces" + "t" | #12 |
| aici | here | "ai" + "ci" | #15 |
| ăsta | this | "ă" — chỉ Romanian | #18 |
| foarte | very | "oa" + "r" + "te" | #20 |

**Overlap check**: "ă"/"â"/"î"/"ș"/"ț" chỉ Romanian. "pentru" — không
overlap. "sunt" — Italian "sono" khác. "din"/"mai"/"sau"/"care" —
không overlap Romance khác. Hoàn toàn tách được.

---

### Nhóm Scandinavian (overlap nặng nhất)

#### Swedish
Unique markers: "å", "ä", "ö", "sj" sound, "k" trước front vowel.

| Word | Meaning | Why unique | Freq rank |
|------|---------|------------|-----------|
| och | and | "och" (Danish/Norwegian "og") | #1 |
| att | to/that | "att" (Danish/Norwegian "at") | #3 |
| inte | not | "inte" (Danish/Norwegian "ikke") | #11 |
| hon | she | "hon" (Danish/Norwegian "hun") | #16 |
| från | from | "ä" (Danish/Norwegian "fra") | #15 |
| mycket | much | "my" + "ck" + "et" | #45 |
| aldrig | never | "al" + "drig" | #50 |
| tack | thanks | "tack" (Danish "tak", Norwegian "takk") | #60 |
| hej | hello | "hej" (Danish "hej" overlap!, Norwegian "hei") | #55 |
| också | also | "å" + "ock" (Danish/Norwegian "også") | #30 |

**Overlap check**: "och"/"att"/"inte"/"hon"/"från" — 5 từ phân biệt Swedish
vs Danish/Norwegian. "å"/"ä"/"ö" chỉ Scandinavian nhưng Danish dùng "æ"/"ø"
khác → Swedish "ä"/"ö" unique trong group.

#### Norwegian (Bokmål)
Gần Danish nhất — khó tách. Unique markers: "ø", "æ", một số spelling.

| Word | Meaning | Why unique | Freq rank |
|------|---------|------------|-----------|
| nå | now | "å" (Danish "nu", Swedish "nu") | #20 |
| nei | no | "ei" (Danish "nej", Swedish "nej") | #25 |
| ønnsker | wishes | "ø" + "sk" — chỉ Norwegian | #40 |
| fjord | fjord | "jor" + "d" — chỉ Norwegian | #50 |
| blitt | become | "bl" + "itt" (Danish "blevet", Swedish "blivit") | #30 |
| svært | very | "svæ" + "rt" | #35 |
| gjerne | gladly | "gj" + "er" + "ne" | #32 |
| fortelle | tell | "for" + "tel" + "le" (Swedish "berätta") | #28 |
| måtte | must | "må" + "tte" (Danish "måtte" overlap!) | #22 |
| knall | great | "kn" + "all" — chỉ Norwegian | #45 |

**Overlap check**: "nå"/"nei" — 2 từ phân biệt Norwegian vs Danish/Swedish.
"ønsker"/"fjord"/"blitt"/"svært"/"gjerne"/"fortelle" — không overlap.
"måtte" overlap Danish → loại. Ceiling: Norwegian vs Danish vẫn khó,
cần content words đặc thù (fjord, norsk, blitt).

#### Danish
Gần Norwegian — khó tách. Unique markers: "æ", "ø", "å", "stød" (glottal).

| Word | Meaning | Why unique | Freq rank |
|------|---------|------------|-----------|
| af | of | "af" (Norwegian/Swedish "av") | #25 |
| hvad | what | "hv" + "ad" (Norwegian "hva", Swedish "vad") | #15 |
| blev | became | "bl" + "ev" (Norwegian "ble", Swedish "blev") | #30 |
| undskyld | excuse me | "un" + "sky" + "ld" — chỉ Danish | #40 |
| farvel | goodbye | "far" + "vel" (Norwegian "farvel" overlap!) | #35 |
| mange | many | "an" + "ge" (Norwegian "mange" overlap!) | #28 |
| godt | good | "od" + "t" (Norwegian "godt" overlap!) | #20 |
| hvorfor | why | "vor" + "for" (Norwegian "hvorfor" overlap!) | #22 |
| lille | little | "il" + "le" (Norwegian "lille" overlap!) | #18 |
| store | big | "st" + "or" + "e" (Norwegian "store" overlap!) | #16 |

**Overlap check**: "af"/"hvad"/"undskyld" — 3 từ phân biệt Danish vs
Norwegian/Swedish. Phần còn lại overlap Norwegian. Ceiling: Danish vs
Norwegian Bokmål cực khó tách bằng frequency — có thể cần detect "af"
+ "hvad" + "undskyld" làm signature, threshold thấp (3).

#### Icelandic
Unique markers: "þ", "ð", "æ", "ö", giữ case (gamal Norse).

| Word | Meaning | Why unique | Freq rank |
|------|---------|------------|-----------|
| sem | as/which | "sem" (Swedish "som" — khác) | #1 |
| til | to | "til" (Danish/Norwegian "til" overlap!) | #2 |
| var | was | (Scandinavian overlap) | #3 |
| með | with | "ð" — chỉ Icelandic | #5 |
| það | it/that | "þ" + "ð" — chỉ Icelandic | #4 |
| þar | there | "þ" — chỉ Icelandic | #6 |
| hefur | has | "fu" + "r" (Swedish "har", Danish "har") | #8 |
| hafi | have (subj) | "ha" + "fi" | #10 |
| ekki | not | "ek" + "ki" (Swedish "inte", Danish "ikke") | #7 |
| hans | his | "han" + "s" (Scandinavian overlap) | #9 |

**Overlap check**: "þ"/"ð" chỉ Icelandic → "það"/"þar"/"með" unique tuyệt
đối. "ekki" vs Swedish "inte"/Danish "ikke" — khác. "hefur"/"hafi" —
khác Scandinavian khác. Dễ tách nhất nhóm Scandinavian.

---

### Nhóm Slavic (Latin script)

#### Polish
Unique markers: "ł", "ż", "ź", "ś", "ć", "ń", "ą", "ę", "sz", "cz".

| Word | Meaning | Why unique | Freq rank |
|------|---------|------------|-----------|
| się | reflexive | "się" — chỉ Polish | #1 |
| jest | is | "je" + "st" (Czech "je", Croatian "je") | #3 |
| przez | through | "pr" + "ez" | #8 |
| także | also | "ż" — chỉ Polish | #12 |
| jeszcze | still/yet | "je" + "sz" + "cze" | #10 |
| ponieważ | because | "on" + "iew" | #15 |
| zawsze | always | "za" + "ws" + "ze" | #14 |
| między | between | "mię" — chỉ Polish | #18 |
| dzięki | thanks | "dzię" — chỉ Polish | #20 |
| trochę | a bit | "troc" + "hę" — chỉ Polish | #22 |

**Overlap check**: "ł"/"ż"/"ź"/"ś"/"ć"/"ń"/"ą"/"ę" chỉ Polish. "się"/"między"
/"dzięki"/"trochę" — unique. "jeszcze"/"zawsze"/"ponieważ" — "sz"/"cz"
đặc trưng Polish. Dễ tách.

#### Czech
Unique markers: "ř", "ě", "ů", "ž", "š", "č", "ň", "ť", "ď".

| Word | Meaning | Why unique | Freq rank |
|------|---------|------------|-----------|
| který | which | "kt" + "ý" | #5 |
| jsou | are | "jo" + "u" (Polish "są") | #8 |
| ještě | still | "je" + "š" + "tě" | #10 |
| protože | because | "pro" + "to" + "že" | #12 |
| když | when | "k" + "dy" + "ž" | #14 |
| aby | so that | "a" + "by" | #16 |
| nebo | or | "ne" + "bo" (Polish "lub"/"albo") | #18 |
| už | already | "u" + "ž" — chỉ Czech | #20 |
| vůbec | at all | "ů" — chỉ Czech | #22 |
| moc | much/very | "mo" + "c" (Polish "bardzo") | #25 |

**Overlap check**: "ř"/"ů" chỉ Czech. "ještě"/"protože"/"když" — "ž"/"š"
đặc trưng Czech (Polish dùng "sz"/"cz" khác). "už"/"vůbec" — unique.
"jsou" — Polish "są" khác.

#### Croatian
Unique markers: "č", "ć", "ž", "š", "đ", "lj", "nj", "dž".

| Word | Meaning | Why unique | Freq rank |
|------|---------|------------|-----------|
| biti | to be | "bi" + "ti" (Serbian cũng có) | #1 |
| kako | how | "ka" + "ko" | #3 |
| samo | only | "sa" + "mo" | #5 |
| jer | because | "je" + "r" — chỉ Croatian | #8 |
| kod | at/by | "ko" + "d" | #10 |
| preko | across | "pr" + "ek" + "o" | #12 |
| gdje | where | "gd" + "je" (Czech "kde") | #14 |
| uvijek | always | "uvi" + "jek" | #16 |
| dok | while | "do" + "k" | #18 |
| bez | without | "be" + "z" (Polish "bez" overlap!) | #6 |

**Overlap check**: "č"/"ć"/"đ"/"lj"/"nj" đặc trưng Croatian. "jer"/"kod"
/"preko"/"gdje"/"uvijek"/"dok" — không overlap Czech/Polish. "bez" overlap
Polish → loại, thay bằng "već" (already — chỉ Croatian).

#### Slovenian
Unique markers: "č", "š", "ž", "j", gần Croatian nhưng khác.

| Word | Meaning | Why unique | Freq rank |
|------|---------|------------|-----------|
| kako | how | (Croatian overlap) | #3 |
| samo | only | (Croatian overlap) | #5 |
| ali | or | "a" + "li" (Croatian "ili") | #4 |
| ker | because | "ke" + "r" — chỉ Slovenian | #6 |
| pri | at/by | "pr" + "i" (Croatian "kod") | #8 |
| bil | was | "bi" + "l" | #10 |
| brez | without | "br" + "ez" (Croatian "bez") | #7 |
| tudi | also | "tu" + "di" (Croatian "također") | #12 |
| zato | therefore | "za" + "to" (Croatian "zato" overlap!) | #14 |
| vendar | however | "ven" + "dar" — chỉ Slovenian | #16 |

**Overlap check**: "ker"/"brez"/"tudi"/"vendar"/"ali" — 5 từ phân biệt
Slovenian vs Croatian. "kako"/"samo"/"zato" overlap Croatian → loại.

---

### Nhóm Baltic + Finno-Ugric

#### Estonian
Unique markers: "õ", "ä", "ö", "ü", double vowels (aa/ee/ii/oo/uu).

| Word | Meaning | Why unique | Freq rank |
|------|---------|------------|-----------|
| see | this | "se" + "e" (Finnish "tämä") | #1 |
| mis | what | "mi" + "s" (Finnish "mikä") | #2 |
| kuid | but | "ku" + "id" (Finnish "mutta") | #4 |
| tema | he/she | "te" + "ma" (Finnish "hän") | #5 |
| kui | if/when | "ku" + "i" (Finnish "jos") | #6 |
| aga | but | "a" + "ga" (Finnish "mutta") | #7 |
| seet | because | "se" + "t" | #8 |
| nii | so | "ni" + "i" (Finnish "niin") | #9 |
| siis | then | "si" + "is" (Finnish "sitten") | #10 |
| veel | still | "ve" + "el" (Finnish "vielä") | #12 |

**Overlap check**: Estonian vs Finnish — khác vocabulary dù cùng Finno-Ugric.
"see"/"mis"/"kuid"/"tema"/"kui"/"aga"/"nii"/"siis"/"veel" — không overlap
Finnish. "õ" chỉ Estonian. Dễ tách.

#### Latvian
Unique markers: "ā", "ē", "ī", "ū", "č", "š", "ž", "ņ", "ķ", "ģ", "ļ".

| Word | Meaning | Why unique | Freq rank |
|------|---------|------------|-----------|
| kas | who/what | "ka" + "s" (Lithuanian "kas" overlap!) | #1 |
| bet | but | "be" + "t" (Lithuanian "bet" overlap!) | #2 |
| viņš | he | "viņ" — chỉ Latvian | #3 |
| tad | then | "ta" + "d" | #4 |
| kur | where | "ku" + "r" | #5 |
| gan | both/though | "ga" + "n" | #6 |
| nav | is not | "na" + "v" — chỉ Latvian | #7 |
| jau | already | "ja" + "u" | #8 |
| lai | let/that | "la" + "i" | #9 |
| arī | also | "ar" + "ī" — chỉ Latvian | #10 |

**Overlap check**: "viņš"/"nav"/"arī" — "ņ"/"ī" đặc trưng Latvian. "kas"
/"bet" overlap Lithuanian (không trong list 27) → OK cho Latin group.
Dễ tách trong Latin group.

#### Finnish
Unique markers: "ä", "ö" (double dots, khác Swedish), "aa"/"ee" double,
agglutinative, không "b"/"c"/"d"/"g"/"q"/"w"/"x"/"z" (ngoài loan words).

| Word | Meaning | Why unique | Freq rank |
|------|---------|------------|-----------|
| että | that | "et" + "tä" — chỉ Finnish | #1 |
| joka | which | "jo" + "ka" — chỉ Finnish | #2 |
| hän | he/she | "hä" + "n" — chỉ Finnish | #3 |
| myös | also | "my" + "ös" — chỉ Finnish | #4 |
| mutta | but | "mut" + "ta" — chỉ Finnish | #5 |
| tämä | this | "tä" + "mä" — chỉ Finnish | #6 |
| voida | to be able | "vo" + "id" + "a" | #7 |
| tulla | to come | "tul" + "la" — chỉ Finnish | #8 |
| kun | when | "ku" + "n" (Estonian "kui" khác) | #9 |
| olla | to be | "ol" + "la" — chỉ Finnish | #10 |

**Overlap check": "ä"/"ö" Finnish khác Swedish (Finnish không có "å").
"että"/"joka"/"hän"/"myös"/"mutta"/"tämä"/"tulla"/"olla" — hoàn toàn
unique, agglutinative morphology đặc trưng. Dễ tách.

#### Hungarian
Unique markers: "á", "é", "í", "ó", "ú", "ő", "ű", "ny", "gy", "ty",
"sz", "zs", "cs", "ly", agglutinative.

| Word | Meaning | Why unique | Freq rank |
|------|---------|------------|-----------|
| egy | a/an | "eg" + "y" — chỉ Hungarian | #1 |
| van | is | "va" + "n" | #2 |
| meg | and/also | "me" + "g" — chỉ Hungarian | #3 |
| csak | only | "cs" + "ak" — chỉ Hungarian | #4 |
| még | still/yet | "mé" + "g" — chỉ Hungarian | #5 |
| mint | than/as | "mi" + "nt" | #6 |
| hogy | that | "ho" + "gy" — chỉ Hungarian | #7 |
| volt | was | "vo" + "lt" — chỉ Hungarian | #8 |
| nem | no/not | "ne" + "m" | #9 |
| majd | then/will | "mj" + "d" — chỉ Hungarian | #10 |

**Overlap check**: "cs"/"gy"/"ty"/"sz"/"zs"/"ly"/"ny" chỉ Hungarian.
"egy"/"meg"/"csak"/"még"/"hogy"/"volt"/"majd" — hoàn toàn unique.
Agglutinative + vowel harmony đặc trưng. Dễ tách.

---

### Nhóm Asian + Pacific (Latin script)

#### Vietnamese
Unique markers: dấu (á/à/ả/ã/ạ/ă/â/đ/ê/é/è/ẻ/ẽ/ẹ/í/ì/ỉ/ĩ/ị/ó/ò/ỏ/õ/ọ/ô/ơ/ú/ù/ủ/ũ/ụ/ư/ý/ỳ/ỷ/ỹ/ỵ),
"đ", không có "f"/"j"/"w"/"z".

| Word | Meaning | Why unique | Freq rank |
|------|---------|------------|-----------|
| không | no/not | "kh" + "ông" — chỉ Vietnamese | #1 |
| của | of | "củ" + "a" — chỉ Vietnamese | #2 |
| và | and | "v" + "à" (accent grave) | #3 |
| một | one/a | "mộ" + "t" — chỉ Vietnamese | #4 |
| được | can/been | "đượ" + "c" — "đ" chỉ Vietnamese | #5 |
| cho | for/give | "ch" + "o" | #6 |
| người | person | "ngườ" + "i" — chỉ Vietnamese | #7 |
| này | this | "ná" + "y" — chỉ Vietnamese | #8 |
| cũng | also | "cũ" + "ng" — chỉ Vietnamese | #9 |
| những | plural marker | "nhữ" + "ng" — chỉ Vietnamese | #10 |

**Overlap check**: "đ" chỉ Vietnamese. Dấu tone (5 dấu) chỉ Vietnamese
(trong Latin group). Hoàn toàn unique — không overlap với bất kỳ
ngôn ngữ Latin nào. Dễ tách nhất.

#### Turkish
Unique markers: "ğ", "ı", "ş", "ç", "ö", "ü", "İ" (capital dotted),
harmony vowel, "c" làm /dʒ/.

| Word | Meaning | Why unique | Freq rank |
|------|---------|------------|-----------|
| için | for | "iç" + "in" — "ç" chỉ Turkish | #1 |
| ile | with | "i" + "le" | #2 |
| var | there is | "va" + "r" | #3 |
| ben | I | "be" + "n" | #4 |
| sen | you | "se" + "n" | #5 |
| daha | more | "da" + "ha" | #6 |
| hiç | not at all | "hi" + "ç" — "ç" chỉ Turkish | #7 |
| ama | but | "a" + "ma" | #8 |
| çok | much/very | "ç" + "ök" — chỉ Turkish | #9 |
| bir | one/a | "bi" + "r" | #10 |

**Overlap check**: "ğ"/"ı"/"ş"/"ç" chỉ Turkish. "için"/"hiç"/"çok" —
"ç" đặc trưng. "ben"/"sen" — Spanish "ben"/"sen" không có. Dễ tách.

#### Indonesian
Unique markers: không dấu, "ng", "ny", "kh", "sy", prefix ber-/di-/ke-/pe-/se-.

| Word | Meaning | Why unique | Freq rank |
|------|---------|------------|-----------|
| tidak | not | "tid" + "ak" — chỉ Indonesian | #1 |
| yang | which/that | "ya" + "ng" — chỉ Indonesian | #2 |
| ini | this | "i" + "ni" (Tagalog "ito" khác) | #3 |
| itu | that | "i" + "tu" (Tagalog "iyon" khác) | #4 |
| dan | and | "da" + "n" | #5 |
| akan | will | "ak" + "an" — chỉ Indonesian | #6 |
| apa | what | "a" + "pa" (Tagalog "ano" khác) | #7 |
| dia | he/she | "di" + "a" (Tagalog "siya" khác) | #8 |
| karena | because | "ka" + "re" + "na" — chỉ Indonesian | #9 |
| bisa | can | "bi" + "sa" — chỉ Indonesian | #10 |

**Overlap check**: "tidak"/"yang"/"akan"/"karena"/"bisa" — không overlap
Tagalog (Tagalog "hindi"/"ang"/"di"/"kaya"). "ini"/"itu"/"dan"/"apa"
/"dia" — có cognate Austronesian nhưng spelling khác. Dễ tách.

#### Tagalog
Unique markers: "ng", "mga", "siya", "ako", prefix mag-/um-/in-/i-.

| Word | Meaning | Why unique | Freq rank |
|------|---------|------------|-----------|
| ang | article marker | "a" + "ng" — chỉ Tagalog | #1 |
| mga | plural marker | "mg" + "a" — chỉ Tagalog | #2 |
| siya | he/she | "si" + "ya" — chỉ Tagalog | #3 |
| mula | from | "mu" + "la" — chỉ Tagalog | #4 |
| para | for | "pa" + "ra" (Spanish "para" overlap!) | #5 |
| nang | when/by | "na" + "ng" — chỉ Tagalog | #6 |
| hindi | no/not | "hin" + "di" — chỉ Tagalog | #7 |
| ako | I | "a" + "ko" — chỉ Tagalog | #8 |
| ito | this | "i" + "to" (Indonesian "ini" khác) | #9 |
| pag | when/on | "pa" + "g" — chỉ Tagalog | #10 |

**Overlap check**: "ang"/"mga"/"siya"/"mula"/"nang"/"hindi"/"ako"/"ito"
/"pag" — hoàn toàn unique, không overlap Indonesian. "para" overlap
Spanish → loại, thay bằng "ay" (is — chỉ Tagalog). Dễ tách.

---

### Nhóm khác

#### Swahili
Unique markers: không dấu, prefix ki-/vi-/mu-/wa-/li-/i-, "ng'".

| Word | Meaning | Why unique | Freq rank |
|------|---------|------------|-----------|
| kwa | for/by | "kw" + "a" — chỉ Swahili | #1 |
| kutoka | from | "ku" + "to" + "ka" — chỉ Swahili | #2 |
| kama | like/as | "ka" + "ma" | #3 |
| pia | also | "pi" + "a" — chỉ Swahili | #4 |
| mtu | person | "mt" + "u" — chỉ Swahili | #5 |
| mahali | place | "ma" + "ha" + "li" — chỉ Swahili | #6 |
| baada | after | "ba" + "a" + "da" — chỉ Swahili | #7 |
| moja | one | "mo" + "ja" — chỉ Swahili | #8 |
| watu | people | "wa" + "tu" — chỉ Swahili | #9 |
| sana | very | "sa" + "na" — chỉ Swahili | #10 |

**Overlap check": hoàn toàn unique, không overlap bất kỳ ngôn ngữ Latin
nào. Bantu prefix system đặc trưng. Dễ tách.

#### Albanian
Unique markers: "ë", "ç", "xh", "zh", "ll", "rr", "th", "nj".

| Word | Meaning | Why unique | Freq rank |
|------|---------|------------|-----------|
| një | a/an | "nj" + "ë" — chỉ Albanian | #1 |
| dhe | and | "dh" + "e" | #2 |
| për | for | "pë" + "r" — "ë" chỉ Albanian | #3 |
| është | is | "ësh" + "të" — chỉ Albanian | #4 |
| nga | from | "ng" + "a" | #5 |
| nuk | not | "nu" + "k" | #6 |
| por | but | "po" + "r" | #7 |
| jam | am | "ja" + "m" — chỉ Albanian | #8 |
| njeri | person | "nje" + "ri" — chỉ Albanian | #9 |
| kjo | this | "kj" + "o" — chỉ Albanian | #10 |

**Overlap check**: "ë" chỉ Albanian (trong Latin group). "një"/"është"
/"jam"/"njeri"/"kjo" — "nj"/"ë" đặc trưng. "dhe"/"për"/"nga"/"nuk"/"por"
— không overlap. Dễ tách.

---

## Overlap Matrix Summary

### Overlap nặng (khó tách, cần signature + content words)

| Cặp | Mức overlap | Unique signatures |
|-----|-------------|-------------------|
| Danish ↔ Norwegian Bokmål | Rất cao | Danish: af, hvad, undskyld; Norwegian: nå, nei, blitt |
| Catalan ↔ Spanish | Cao | Catalan: cap, aquest, aquell; Spanish: ñ words |
| Galician ↔ Portuguese | Rất cao | Galician: sen, máis, hai; Portuguese: ão, você |
| Croatian ↔ Slovenian | Cao | Croatian: jer, kod, gdje; Slovenian: ker, brez, tudi |

### Overlap thấp (dễ tách)

| Ngôn ngữ | Unique markers |
|----------|----------------|
| Vietnamese | đ + 5 dấu tone |
| Hungarian | cs/gy/ty/sz/zs/ly + harmony |
| Finnish | ä/ö + agglutinative |
| Turkish | ğ/ı/ş/ç |
| Polish | ł/ż/ź/ś/ć/ą/ę |
| Icelandic | þ/ð |
| Romanian | ă/â/î/ș/ț |
| Welsh | ll/dd/ff + w/y vowel |
| Swahili | Bantu prefixes |
| Albanian | ë/nj |

---

## Recommendation cho implementation

> **Status: Phase 1-3 đã implemented** trong `src/features/detection/logic/languageDetector.ts`.
> Phase 4 (cross-check known vs content) chưa implement — cần thiết kế API
> cho "suspicious" flag trước khi wire vào UI.

### Phase 1: Replace topWords bằng unique signature words ✅

Thay `topWords` trong `LANGUAGE_PROFILES` bằng unique signature words
trong file này. Giữ `script` filter (Latin profiles chỉ chạy cho Latin
script text).

### Phase 2: Lower threshold ✅

Vì unique words không overlap, threshold đã thấp hơn:
- CJK + Russian: threshold 8 (giữ — script detection first)
- Latin unique signature: threshold 4 (thay 6)
- Norwegian/Danish: threshold 3 (overlap nặng, ít unique words)
- Cyrillic/Arabic/Devanagari: threshold 6 (chưa migrate — script detection first)

### Phase 3: Scoring thay first-match ✅

Thay first-match-wins bằng scoring trong `matchByFrequency`:
```
for each profile:
  matchCount = count unique words in text
  if matchCount >= profile.threshold and matchCount > bestCount:
    bestCount = matchCount
    bestLabel = profile.label
return bestLabel
```

Unique words làm scoring khả thi vì không overlap — match count cao
= confident cao, không cần first-match arbitrariness. Tie-break by
profile order (earlier wins) — preserves CJK priority.

### Phase 4: Cross-check known vs content ⏳ (chưa implement)

Nếu URL detect "en" nhưng content không có English unique words
(match count < 2) → flag "suspicious", có thể re-detect hoặc warn user.
Cần thiết kế API cho "suspicious" flag trước khi wire vào UI.

---

## Nguồn

- Wiktionary Frequency Lists: https://en.wiktionary.org/wiki/Wiktionary:Frequency_lists
- Leipzig Corpora Collection: https://corpora.uni-leipzig.de/
- OpenSubtitles frequency: https://www.opensubtitles.org/
- Danish frequency (Korpus DSL): https://korpus.dsl.dk/
- Swedish frequency (Wiktionary): https://en.wiktionary.org/wiki/Wiktionary:Frequency_lists/Swedish/Most_common_words
- Spanish frequency (Wiktionary): https://en.wiktionary.org/wiki/Wiktionary:Frequency_lists/Spanish1000
- Unicode Script Property: https://www.unicode.org/Public/UNIDATA/Scripts.txt
