# MCP ATs Checklist — exact commands per AT

> Layer 1 of ui-checker. Each AT has the MCP tool call + evaluate_script function. Run in order. Stop layer on first fail.

## Setup (before AT1)

```
mcp.install_extension({ path: "<abs path to dist/>" })
mcp.new_page({ url: "chrome-extension://<id>/options.html" })
mcp.resize_page({ width: 1440, height: 900 })  // desktop baseline
```

If install fails → stop, report extension path. If navigate fails → check `manifest.json`, report.

## AT1a — sees_in_3s (machine-verifiable)

Assert title + nav + primary CTA visible in first viewport (1440x900).

```
snapshot = mcp.take_snapshot()
```

Assert in snapshot (bounding box within viewport):
- Title element (text matches contract `layout.header.title`) — top of page, visible.
- Nav element (`role=tablist` or `nav`) — visible, below title.
- Primary CTA (element with `data-priority=primary` or matching contract `functions[0]`) — visible in first viewport.

```javascript
// evaluate_script — assert visibility
() => {
  const vp = { w: 1440, h: 900 };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    return r.top >= 0 && r.top < vp.h && r.left >= 0 && r.right <= vp.w;
  };
  const title = document.querySelector('h1, [data-testid=title]');
  const nav = document.querySelector('[role=tablist], nav');
  const primary = document.querySelector('[data-priority=primary]');
  return {
    titleVisible: title && visible(title),
    navVisible: nav && visible(nav),
    primaryVisible: primary && visible(primary),
  };
}
```

**Pass**: all 3 `true`. **Fail**: any `false` — record which element + its bounding box.

## AT1b — knows_what_to_do (machine-verifiable)

Assert exactly 1 primary action visible, no 2+ equal-weight buttons competing.

```javascript
() => {
  const primary = document.querySelectorAll('[data-priority=primary]');
  const filled = document.querySelectorAll('button:not([data-priority=secondary]):not([data-priority=tertiary])');
  return {
    primaryCount: primary.length,
    filledButtonCount: filled.length,
  };
}
```

**Pass**: `primaryCount === 1`. **Fail**: `primaryCount !== 1` — record count + button labels.

## AT2 — flow step count (machine-verifiable)

For each task in contract `flows:`, count steps by interacting with DOM.

```
for each flow:
  steps = 0
  snapshot = mcp.take_snapshot()
  while task not complete:
    find next action element in snapshot
    mcp.click({ uid: <action element uid> })
    snapshot = mcp.take_snapshot()
    steps++
    if steps > 10: break  // safety
  assert steps <= 3
```

**Pass**: all tasks ≤3 steps AND match contract `flows[].count`. **Fail**: any >3 or mismatch — record task, actual steps, contract expected.

## AT3 — visual tell sweep (machine-verifiable, grep + DOM)

### Code grep (run in shell, not MCP)

```bash
# em-dash
rg "—" src/<feature>/  # expect 0 matches
# Inter font
rg "font-family.*Inter" src/<feature>/  # expect 0
# AI purple gradient
rg "from-purple|to-purple|purple-" src/<feature>/  # expect 0
# pure black
rg "#000000|#000 " src/<feature>/  # expect 0
# 100vh (should be 100dvh)
rg "100vh" src/<feature>/  # expect 0
```

### DOM check (evaluate_script)

```javascript
() => {
  const text = document.body.innerText;
  const tells = {
    emDash: text.includes('—'),
    scrollCue: /scroll/i.test(text) && /↓|explore/i.test(text),
    versionFooter: /v\d+\.\d+\.\d+/i.test(text),
  };
  // 3 equal cards
  const cards = [...document.querySelectorAll('[data-testid*=card], .card')];
  const widths = cards.map(c => c.getBoundingClientRect().width);
  const equal3 = widths.length >= 3 && widths.slice(0,3).every(w => Math.abs(w - widths[0]) < 2);
  return { ...tells, threeEqualCards: equal3 };
}
```

**Pass**: all `false`/`0`. **Fail**: any `true`/nonzero — record tell + location.

## AT4 — a11y runtime (machine-verifiable)

### Lighthouse audit

```
report = mcp.lighthouse_audit({ mode: 'snapshot', device: 'desktop' })
```

Assert `report.categories.accessibility.score === 1` (0 violations).

### ARIA assert (evaluate_script)

```javascript
() => {
  const tablist = document.querySelector('[role=tablist]');
  if (!tablist) return { hasTablist: false };
  const tabs = [...tablist.querySelectorAll('[role=tab]')];
  const panels = [...document.querySelectorAll('[role=tabpanel]')];
  const linkageOk = tabs.every(t => {
    const controls = t.getAttribute('aria-controls');
    return controls && document.getElementById(controls);
  }) && panels.every(p => {
    const labelledby = p.getAttribute('aria-labelledby');
    return labelledby && document.getElementById(labelledby);
  });
  const selectedOnly = tabs.filter(t => t.getAttribute('aria-selected') === 'true').length === 1;
  return { hasTablist: true, linkageOk, selectedOnly };
}
```

**Pass**: lighthouse score 1 AND `linkageOk && selectedOnly`. **Fail**: any — record violation type + element.

## AT5 — console clean (machine-verifiable)

```
msgs = mcp.list_console_messages()
errors = msgs.filter(m => m.level === 'error')
```

**Pass**: `errors.length === 0`. **Fail**: any error — record message + likely cause.

## AT6 — responsive collapse (machine-verifiable, 100%)

```
mcp.emulate({ viewport: '375x812x2,mobile,touch' })
```

```javascript
() => {
  const hscroll = document.documentElement.scrollWidth > window.innerWidth;
  const targets = [...document.querySelectorAll('button, a, [role=tab], input')];
  const small = targets.filter(el => {
    const r = el.getBoundingClientRect();
    return r.width < 44 || r.height < 44;
  }).length;
  // single-column: no 2 elements side-by-side in primary zone
  const primary = document.querySelector('[role=tabpanel] [data-zone=primary], [data-testid=content]');
  let sideBySide = false;
  if (primary) {
    const children = [...primary.children];
    sideBySide = children.some((a, i) =>
      children.slice(i+1).some(b => {
        const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
        return ra.left < rb.left && ra.right > rb.left && ra.top < rb.bottom && ra.bottom > rb.top;
      })
    );
  }
  return { hscroll, smallTargets: small, sideBySide };
}
```

**Pass**: `hscroll === false && small === 0 && sideBySide === false`. **Fail**: any — record which check + value.

Reset viewport after: `mcp.resize_page({ width: 1440, height: 900 })`.

## AT7 — contract compliance (machine-verifiable, grep + DOM)

### Token compliance (grep)

```bash
# no freeform hex in components (tokens via CSS var)
rg "#[0-9a-fA-F]{3,8}" src/<feature>/*.module.css  # expect 0 (all via var())
# no Inter
rg "Inter" src/<feature>/  # expect 0
# no linear/ease-in-out
rg "linear|ease-in-out" src/<feature>/  # expect 0
```

### Placement compliance (evaluate_script)

```javascript
() => {
  const contractFunctions = <paste functions array from contract>;
  const results = contractFunctions.map(f => {
    const el = document.querySelector(`[data-fid=${f.id}]`) || document.querySelector(`[data-testid=${f.name.replace(/\s/g,'-')}]`);
    if (!el) return { id: f.id, found: false };
    const zone = el.getAttribute('data-zone');
    const priority = el.getAttribute('data-priority');
    return {
      id: f.id,
      found: true,
      zoneMatch: zone === f.zone,
      priorityMatch: priority === f.priority,
    };
  });
  return results;
}
```

**Pass**: all `found: true && zoneMatch && priorityMatch` AND grep 0 matches. **Fail**: any — record contract field, expected, actual.

## Layer 1 stop rule

- All 8 ATs pass → proceed to Layer 2 (cognitive subagent).
- Any AT fail → stop, record fails, do NOT spawn Layer 2. Write addendum, return to implement loop.

## Evidence to save per round

- `evidence/<screen>/desktop.png` — `take_screenshot` at 1440x900
- `evidence/<screen>/mobile.png` — `take_screenshot` at 375x812
- `evidence/<screen>/console.txt` — `list_console_messages` output
- `evidence/<screen>/a11y.json` — `lighthouse_audit` output
- `evidence/<screen>/snapshot.json` — `take_snapshot` output
- `evidence/<screen>/ats-result.json` — { at1a, at1b, at2, at3, at4, at5, at6, at7 } results
