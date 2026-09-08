---
name: continuous-ux-audit-cycle
description: Continuous UX Audit Cycle — 7-stage loop to audit a system's whole UI, plan redesign, delegate, verify, and re-scan until no gaps remain. Use when auditing end-to-end UI/UX, driving iterative redesign, or setting up a recurring design-quality loop. Not for single-screen tweaks or one-off bug fixes.
---

# Continuous UX Audit Cycle

> **Audit everything, fix root causes, verify, then hunt gaps again. The loop ends only when a Refine pass finds nothing.**

## Entry rule — no evidence, no loop

**The cycle does not start on a feeling. If the request lacks scope, business problem, or a standard, ask — do not guess.**

```text
Form:  "Audit UX của <scope> vì <business problem có manh mối>. Chuẩn: <baseline>. Giới hạn: <điều cấm phá>."
Bad:   "Redesign lại, nó quá xấu."            → hỏi lại: scope nào? xấu theo chuẩn nào? gây hại gì?
Good:  "Audit UX 11 surfaces vì user không biết dùng màu/component nào cho ngữ cảnh nào. Chuẩn: DESIGN.md + L-BORDER. Giới hạn: không phá chức năng."
```

Missing input → route to `interview-me`/`elicitation` before stage 1.
**Always `reprompt` before stage 1 — even with complete input.** Handoff always loses context and breeds misunderstanding, so restate scope/problem/standard/constraints back to the user and wait for edit or approval before doing anything.

| # | Stage | Actions | Guard → next |
|---|---|---|---|
| 1 | **Discover** | Enter app, collect evidence on every screen (screenshots, DOM measures, console) | Output doc passes exit gate → 2 — spec: `discover-output.md` |
| 2 | **Journey Audit** | Run real user journeys: entry → steps → exit; test empty/full/overflow + destructive | Defect + painpoint list → 3 |
| 3 | **Diagnose** | Map to business/user goals; find missing/excess UI, wrong-context color, layout breaks; **every element must map to a shared component — unmapped → log + reason → reuse / new variant / specialized-with-justification** (DESIGN.md rule 9) | Root causes named → 4 |
| 4 | **Plan** | Write plan with AC/DoD per task; split work for delegation | Every task has AC → 5 |
| 5 | **Execute** | Delegate tasks; blockers found mid-work become new tasks, fixed inline | Tasks done → 6 |
| 6 | **Verify** | Review quality, critique, accept/reject per AC/DoD | All pass → 7; fail → back to 4 |
| 7 | **Refine** | Re-scan the fixed build; **must surface ≥3 gaps** or declare done | Gaps found → back to 1; none → DONE |

Loop state lives in `loop/<name>/state/NN-stage.md`; evidence in `loop/<name>/image/`.

## Test harness

Use Playwright for live evidence.

**Default: `testing-with-playwright`** — the reusable `cellEnvironment` fixture loads Cell + uBOLite, opens StreamFlix, and exposes `streamFlixPage` plus feature actors (`universalPanel`, etc.). This gives reproducible screenshots, DOM measures, console logs, and journey runs for every audit cycle.

```bash
bash scripts/e2e.sh --stage2 <audit-spec>
```

**Fallback 1: `mcp-playwright`** (`browser_navigate`, `browser_evaluate`, `browser_find`, `browser_take_screenshot`, `browser_console_messages`) when a lightweight manual probe is enough and the local Playwright environment is not built.

**Fallback 2: local launch script:**

```text
node .devin/skills/continuous-ux-audit-cycle/scripts/playwright-launch.mjs
```

**Fallback 3: `testing-extension-browser`** if neither of the above can load the extension, recorded as a limitation.

### Test URLs

Quick pass (default): `http://localhost:5173/src/entrypoints/mock-streaming-page/index.html?theme=dark&player=same` — same-origin player, one frame, overlay mounts directly into the top frame.

Iframe pass (only for iframe/cross-origin behavior): `http://localhost:5173/src/entrypoints/mock-streaming-page/index.html?theme=dark&player=iframe` + `npm run mock` (iframe player on :4324, hardsub OCR on :4325).

- `mcp-playwright` cannot evaluate inside cross-origin iframes. To inspect the overlay shadow DOM, navigate to the child iframe URL directly: `http://127.0.0.1:4324/index.html?mode=hash&...`

For overlay scopes (subtitle/OCR/cluster buttons) always audit on the mock site — showcase placeholders cannot show real translucency over video.

Do NOT use the removed `npm run mock:stream`.

## Router boomerang

Task changes or unsure which skill fits? Invoke `/using-agent-skills` to re-route.
