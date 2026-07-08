# Input Examples — Good vs Bad

> Loaded on demand when checking input quality.
> Referenced from SKILL.md Input section.

## What a good input looks like (Mode A)

```
Function list (from auditing OptionsApp.tsx + ResourcesPanel.tsx + ThemePanel.tsx):
1. Import dictionary (.json, .zip)
2. Import frequency list (.txt, .json, .zip, .db.gz)
3. List imported dictionaries
4. List imported frequency lists
5. Delete a resource
6. Switch theme mode (light/dark/system)
7. Customize 5 color tokens
8. Preview theme live
9. Validate contrast (auto)
10. Export theme config
11. Import theme config
12. Reset theme to defaults

Constraints (from manifest.json + ADR-022 + AGENTS.md):
- Chrome extension options page (full tab, unlimited width)
- Dark/light runtime customizable (ADR-022)
- Existing color system stays unchanged (user confirmed)

User context (asked because codebase cannot answer):
- "Anh mở options page chủ yếu để làm gì?" → "Import dictionary" (frequent)
- Switch theme = occasional, reset = rare
```

## What a good input looks like (Mode B)

```
Existing page structure (audit OptionsApp.tsx + ResourcesPanel.tsx):
┌──────────┬───────────────────────────┐
│▸Tài nguyên│  [Dropzone dictionary]    │
│ Giao diện │  Dict A — 12k     [x]     │
│ Cài đặt   │  Dict B — 8k      [x]     │
│          │  [Dropzone frequency]     │
│          │  Freq 50k         [x]     │
└──────────┴───────────────────────────┘
Current groups: Tài nguyên (import/list/delete), Giao diện, Cài đặt
Current zone: import = primary, list = primary, delete = secondary (inline)

New function spec (from 01_idea-refine output):
- "Sync dictionary to cloud" — upload local dictionary to cloud storage
- Manual trigger (button), progress bar, success/fail toast
- Conflict: prompt "overwrite cloud" or "keep both"
- Not destructive (upload only)

Frequency (from 01_interview-me intent): 1-2 lần/tuần → occasional
Destructive: no
```

## What a bad input looks like

```
Redesign options page for the better.
Has: dictionary, theme, settings.
User: me.
```

Why bad: "for the better" is visual, not IA. Function list incomplete (missing export/import/reset). "Me" gives no frequency. No constraints. The agent would have to guess at every step.
