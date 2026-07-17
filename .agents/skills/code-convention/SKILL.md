---
name: code-convention
description: Apply + edit machine-readable code conventions (Google HTML/CSS + TypeScript style guides, 291 rules as atomic JSON). Use APPLY mode before writing any HTML/CSS/TS/TSX code to look up matching rules. Use EDIT mode to add, update, or delete rules when sources change or new conventions are adopted. Triggers on "check conventions before coding", "what conventions apply to X", "update conventions", "add a rule", "delete rule Y".
---

# Code Convention

Two modes: **APPLY** (lookup before coding) and **EDIT** (CRUD the rule store). Detect mode from the user's phrasing — see *When to Use*.

## When to Use

**APPLY mode** (read-only lookup, before writing code):
- "Check conventions before I write X"
- "What rules apply to writing a hook / a CSS class / an enum?"
- "I'm about to implement X — show me the conventions"
- Any task involving HTML, CSS, TS, or TSX where style compliance matters

**EDIT mode** (mutates the rule store):
- "Update conventions from the latest Google guide"
- "Add a rule: never use X in CSS"
- "Delete rule Y — it's outdated"
- "Re-crawl the TypeScript style guide"

## File Layout

```
code-convention/
├── SKILL.md                      # this file — procedure only
├── category-map.md               # task construct → categories (index of the index)
├── conventions/                  # the rule store (data lives here)
│   ├── htmlcss-style-guide.json  # 52 rules, Google JSON Style Guide structure
│   └── typescript-style-guide.json  # 239 rules, Google JSON Style Guide structure
└── scripts/
    └── validate.cjs              # one runnable check — run after every EDIT
```

## APPLY Mode

1. **Identify constructs** the task touches (e.g. "writing a hook" → function + naming + types; "styling a nav" → css + html).
2. **Read `category-map.md`** in this skill directory — map constructs → category names.
3. **Grep the right JSON** in `conventions/` by category: `grep '"category": "imports"' conventions/typescript-style-guide.json`. HTML/CSS constructs → `htmlcss-style-guide.json`; everything else → `typescript-style-guide.json`.
4. **Read matching rule objects** — each has `severity` (RFC 2119), `trigger`, `rule`, optional `example.bad`/`example.good`, and `sourceAnchor` (link to the original Google guide section).
5. **Apply the rules** while writing code. MUST/MUST_NOT are non-negotiable; SHOULD/SHOULD_NOT need a reason to ignore; MAY is optional.

Do NOT dump all 291 rules into context. Load only the subset matching the task's constructs.

## EDIT Mode

Every edit mutates one of the two atomic JSONs in `conventions/`. Schema per rule: `id` (`<category>-<NNN>`), `category`, `severity` (MUST/MUST_NOT/SHOULD/SHOULD_NOT/MAY), `trigger` (<60 chars), `rule` (one sentence, <120 chars), optional `example` (`{bad?, good?}` — multi-line as array of strings), `sourceAnchor`.

- **ADD**: append a rule object with a unique `id` (next number in its category). Update `data.totalItems` and `data.categories` if a new category appears.
- **UPDATE**: find by `id`, replace fields. Keep `id` stable unless renaming a category.
- **DELETE**: remove the object. Update `data.totalItems`. If the category becomes empty, remove it from `data.categories`.
- **RE-CRAWL**: fetch the Google guide, re-extract rules into the `.json` (see *Re-crawl procedure* below).

After ANY edit, run the one runnable check:

```bash
node scripts/validate.cjs
```

It fails fast on: invalid JSON, missing required fields, bad severity enum, duplicate `id`, `totalItems`/`categories` drift. Do not skip this — an invalid rule store breaks APPLY mode silently.

### Re-crawl procedure

1. `webfetch` the Google guide URL (in `data.sourceGuide` of the JSON).
2. Re-extract rules into the `.json` — preserve existing `id`s where the rule text is unchanged; assign new `id`s for genuinely new rules; drop `id`s for rules that disappeared.
3. Run `node scripts/validate.cjs`.

## Verification

- [ ] APPLY: only the subset of rules matching the task's constructs was loaded, not all 291
- [ ] APPLY: every MUST/MUST_NOT rule in the subset was honored in the code written
- [ ] EDIT: `node scripts/validate.cjs` passes after the change
- [ ] EDIT: `data.totalItems` and `data.categories` match the actual `items` array
- [ ] EDIT: no duplicate `id` across the file

---

## Router boomerang

Task đổi hoặc không rõ skill nào phù hợp? Invoke `/using-agent-skills` để re-route. Router protocol trong AGENTS.md (always-on).
