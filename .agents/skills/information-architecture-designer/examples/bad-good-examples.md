# Bad / Good Examples — Minimalism Layout

> Concrete cases for Step 10 of SKILL.md. Each pair shows the wrong move, the right move, and the principle. Use this format when writing contrasts in a layout proposal.

---

## Example 1 — Flat list vs chunked groups

**Context**: Settings page with 12 controls: profile name, email, password, 2FA, theme, language, notifications, integrations, billing plan, invoices, team members, roles.

**Bad**: One long scrollable list of 12 controls under a single "Settings" heading.

```
Settings
├── Name
├── Email
├── Password
├── Two-factor auth
├── Theme
├── Language
├── Notifications
├── Integrations
├── Billing plan
├── Invoices
├── Team members
└── Roles
```

Why bad: 12 items at one level exceeds Miller's 7±2 and Cowan's 4±1. Hick's Law — 12 visible choices slow decisions. No chunking, no scanning shortcut. User must read every label to find the one they want.

**Good**: 3 groups of 4, sidebar nav, scope-first IA model.

```
Sidebar
├── Account      (me)
│   ├── Profile
│   ├── Security
│   ├── Notifications
│   └── Integrations
├── Workspace   (my team)
│   ├── Team
│   ├── Roles
│   ├── Billing
│   └── Invoices
└── System       (the system)
    ├── Theme
    └── Language
```

Why good: Scope-first model matches how users think ("me / my team / the system"). Each group = 4 items = one chunk (Cowan). Sidebar nav = convention for 5-12 groups (Jakob's Law). User jumps to the right group in one glance, then scans 4 items.

**Principle**: Miller's Law (chunking), Hick's Law (reduce visible choices), scope-first IA.

---

## Example 2 — Border-every-card vs whitespace grouping

**Context**: A resources panel with two sections (dictionaries, frequency lists), each with a dropzone and 2-3 list items.

**Bad**: Every item wrapped in a card with border + shadow, equal spacing between all cards.

```
┌─────────────────┐
│ Dropzone        │  border + shadow
└─────────────────┘
┌─────────────────┐
│ Dictionary A    │  border + shadow
└─────────────────┘
┌─────────────────┐
│ Dictionary B    │  border + shadow
└─────────────────┘
┌─────────────────┐
│ Frequency 50k   │  border + shadow
└─────────────────┘
```

Why bad: Common Region overused — every item in its own container destroys grouping. The eye sees 4 equal boxes, not "2 dictionaries + 1 frequency list". Proximity is uniform, so grouping signal is zero. Shadow on every card = visual noise, not hierarchy.

**Good**: Whitespace separates the two sections; within a section, items are tight rows with one divider between sub-groups, no per-item border.

```
Từ điển
┌─────────────── dropzone ───────────────┐
│  Kéo thả hoặc click                     │
└─────────────────────────────────────────┘
  Dictionary A — 12,847 mục        [delete]
  Dictionary B — 8,102 mục         [delete]
─────────────────────────────────────────  ← one divider
Danh sách tần suất
┌─────────────── dropzone ───────────────┐
│  Kéo thả hoặc click                     │
└─────────────────────────────────────────┘
  Frequency 50k — 50,000 mục       [delete]
```

Why good: Large gap + section title separates the two groups (proximity). Tight rows within a group signal "these belong together". One divider, not twelve. Hierarchy comes from the section title weight + the dropzone's dashed border (functional, not decorative). The eye reads: title → dropzone → list, top-down, no chrome competing.

**Principle**: Gestalt proximity over common region; minimalism (eliminate decorative chrome); hierarchy by weight + whitespace.

---

## Example 3 — "Advanced" dump vs re-picked IA

**Context**: A theme panel with 9 controls: mode (light/dark/system), 5 color pickers, preview, export, import, reset.

**Bad**: Two groups — "Appearance" (mode + colors + preview) and "Advanced" (export + import + reset).

```
Appearance
├── Mode
├── Background color
├── Surface color
├── Text color
├── Border color
├── Primary color
└── Preview

Advanced
├── Export
├── Import
└── Reset
```

Why bad: "Advanced" is a dump — export/import are not "advanced", they are backup; reset is not "advanced", it is a safety action. The label gives the user no predictive power: they cannot guess that "Export my theme" lives under "Advanced". The IA model is wrong, so a dump group was needed to make items fit.

**Good**: Re-pick IA model to task-flow (configure → preview → backup → reset). Four groups, each one chunk.

```
Chế độ         (configure)
├── Mode
Màu sắc        (configure)
├── 5 color pickers
Xem trước      (preview)
├── Live preview
Sao lưu        (backup)
├── Export
├── Import
Đặt lại        (safety, last + separated)
├── Reset
```

Why good: Every group name predicts its contents. "Sao lưu" tells the user export/import live there. Reset is its own group at the bottom because it is destructive — separated and last (convention + safety). No dump group. Each group ≤ 3 items.

**Principle**: No "Other"/"Advanced" dump (IA rule); task-flow IA model; destructive-last convention.

---

## Example 4 — Frequent buried vs frequent upfront

**Context**: An options page where the user opens it 80% of the time to import a dictionary, 15% to switch theme mode, 5% to reset.

**Bad**: Tabs ordered as Theme → Resources → Settings (because the developer built theme first).

```
[ Theme ] [ Resources ] [ Settings ]
```

Why bad: The most frequent task (import dictionary) is the second tab. Change-frequency axis ignored. The user clicks twice (Theme tab is default) then realizes they are on the wrong tab, then clicks Resources.

**Good**: Tabs ordered by frequency: Resources → Theme → Settings. Resources is the default open tab.

```
[ Resources ] [ Theme ] [ Settings ]
```

Why good: Frequent-first (change-frequency axis). User opens the page and is already on the screen they need 80% of the time. One click saved per session.

**Principle**: Change-frequency IA axis; recognition over recall (the right screen is already visible).

---

## Example 5 — Competing primary actions vs one primary per zone

**Context**: A media section header with "Select All", "Download All", and "Refresh" all rendered as filled buttons of equal weight.

**Bad**: Three filled buttons in a row.

```
[ Select All ]  [ Download All ]  [ Refresh ]
```

Why bad: Three equal filled buttons = three competing primary actions. The user must read all three labels to decide which is the action they want. Hick's Law violation — the choice set is small but the visual signal is "all three are equally important", which is false.

**Good**: One primary (Download All — the most likely intent), the rest are text links or icon buttons.

```
Select all          [icon refresh]    [ Download All ]
```

Why good: One primary action per zone. "Download All" is filled/weighted; "Select all" is a text link (secondary); "Refresh" is an icon button (tertiary). The eye goes to the primary first. Hierarchy by weight, not by counting buttons.

**Principle**: One primary action per zone; hierarchy by weight + size, not by button count.

---

## How to write your own contrast

Use this template in a layout proposal:

```
**Context**: <one line — what screen, what functions>

**Bad**: <the wrong arrangement>
Why bad: <one line — which principle it violates>

**Good**: <the right arrangement>
Why good: <one line — which principle it follows>

**Principle**: <name the law / principle>
```

Keep each contrast to 6-10 lines. The point is the reasoning, not the prose.
