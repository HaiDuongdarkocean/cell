# Analyze Review — pos-dictionary-variants

Artifact: `docs/intent/pos-dictionary-variants.md`
Mode: interactive · Reviewer: Anh (user approval)

## Decisions recorded

- Per-POS word status (term+pos key) — user confirmed.
- Deliverable: convert → import vào Cell + POS switcher trong popup (full feature).
- Audio `.mdd` deferred — phase sau.
- COCA giữ breakdown 5 genre.
- POS menu UI: bar đầu popup, `adjective | verb | noun` text links, theme-consistent (mockup `docs/mockups/pos-dictionary-variants-pos-menu.png` — lấy layout, không lấy nền sáng).
- Accent toggle `AmE`/`BrE` trước IPA; nguồn BrE = Macmillan 2nd Ed (per-homograph UK/US IPA + audio).

## Data verification performed

- COCA 60000: 53,967 keys; per-POS blocks `span.pos`+`span.rank`+`div.total`+5 genre `div.freq` — verified trên `present`/`take`.
- MacmillanEnEn: 173,925 keys; `.homograph` per-POS, `.dict-top to-pos` menu, `.prons`+`.stars-grp` per homograph — verified AmE-only (`us_pron`).
- Macmillan 2nd Ed: 67,138 keys; per-homograph `UK [ipa] zzz_uk_*.wav` + `US [ipa] zzz_us_*.wav` + pos + stars — verified trên `water`/`present`.

VERDICT: APPROVE
