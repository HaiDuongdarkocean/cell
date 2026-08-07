---
name: vision-reader
description: Delegates image reading to a vision-capable subagent when the main agent cannot see images. Use when verifying browser screenshots, mockups, or error screenshots requires visual ground truth the coding model lacks. Not for text-only DOM inspection, performance traces, or non-visual decisions.
---

# Vision Reader

## Overview

Bridges a blind coding model to a vision model. The main agent captures an image (browser screenshot or arbitrary file), spawns a `vision-reader` subagent that can see it, and consumes a structured layout report to ground its next decision in pixels instead of guesses.

**Why this exists:** the model writing code often cannot read images. Browser testing, UI verification, and mockup handoff all need visual ground truth. Delegating the *look* to a cheap vision subagent keeps the main agent's context clean and the visual judgment on a model built for it.

## When to Use

- Verifying a UI fix in the browser and the main agent needs to confirm the visual result, not just the DOM.
- A user pastes a mockup, error screenshot, or design reference and asks the agent to match or diagnose it.
- Comparing what a page *actually* renders vs what the layout *should* be (overflow, overlap, missing region).
- Any task where the decision hinges on "what does the screen look like right now?"

**When NOT to use:**

- Text-only DOM inspection — use `query_elements` / `take_snapshot` directly.
- Performance traces, network payloads, console logs — those are data, not images.
- The main agent's own model already reads images (would be redundant).
- Non-visual decisions (logic, types, config).

## Prerequisites

| Requirement | Check |
|---|---|
| `vision-reader` subagent profile exists | `.devin/agents/vision-reader.md` present |
| Subagent model has vision | `model: gpt-5.6-luna-medium` pinned in the profile |
| Image on disk as PNG/JPG | `read` tool renders it to the subagent |
| Browser screenshots need an MCP instance | stealth-chrome-devtools `spawn_browser` → save `instance_id` |

If the profile is missing, stop and tell the user — the skill cannot function without it.

## Workflow

### Step 1 — Decide the image source

**Purpose:** Pick where the image comes from before touching the subagent.

| Source | How to get it | When |
|---|---|---|
| Browser screenshot | MCP `take_screenshot(instance_id, file_path=<abs path>)` | Verifying a live page after a code change |
| Arbitrary file on disk | User-provided path, mockup, error screenshot | Matching a design, diagnosing a pasted screenshot |

**Guard:** The image must be a real file on disk with an absolute path. The subagent's only tool is `read`; it cannot take screenshots itself.

**Pitfall:** `read` refuses paths matched by `.gitignore` / `.devinignore`. The project's `_tmp_test_screenshots/` is gitignored — screenshots saved there are unreadable by the subagent. Save to a non-ignored path (e.g. `%TEMP%` on Windows, `/tmp` on Unix) or request read scope on the ignored dir.

**Loop back:** If the image does not yet exist, capture it first (Step 2). If it already exists, skip to Step 3.

### Step 2 — Capture (browser path only)

**Purpose:** Produce a PNG the subagent can read.

**Actions:**

1. Ensure a browser instance is live (`spawn_browser` → save `instance_id`, or reuse one from `testing-extension-browser`).
2. Navigate to the target URL; wait for the element under test to render.
3. Call `take_screenshot` with an explicit `file_path`:
   - Use a temp dir already gitignored (e.g. `_tmp_test_screenshots/<task>.png`).
   - `full_page: false` unless the issue spans below the fold.
   - `format: "png"` (jpeg loses text sharpness the vision model needs).
4. Record the absolute path returned.

**Guard:** Confirm the call returned a path, not just base64. A missing `file_path` arg means the subagent has nothing to read.

**Loop back:** If the screenshot is blank or the page hasn't loaded, fix the page state and re-capture — do not send a bad image to the subagent.

### Step 3 — Frame the task for the subagent

**Purpose:** Give the vision model exactly what it needs: the image, what's expected, and where to focus.

**Actions:** Spawn a `vision-reader` subagent (foreground for a single quick check, background if you'll keep working while it looks). The task prompt MUST contain:

- `image_path` — the absolute path from Step 2/1.
- `expected` — a one-or-two-line description of the intended layout (regions, key elements, behavior). Skip only for a neutral description request.
- `focus` — (optional) the specific region or element that matters for this decision.

**Template:**

```
Read the image at <image_path> and report its layout.

EXPECTED:
<one-two lines: regions that should be present, key element, intended behavior>

FOCUS:
<region/element to prioritize, or "whole viewport">
```

**Guard:** A vague `expected` ("looks right") yields a vague report. Name the regions and the one thing that must be true.

**Loop back:** If you cannot state `expected`, you do not yet know what you're verifying — go back to the task, not the subagent.

### Step 4 — Consume the report

**Purpose:** Turn the visual report into a decision.

**Actions:**

1. Read the `VISION REPORT` the subagent returns.
2. Map each `DEVIATIONS` entry to a code cause:
   - `blocker` (region absent / wrong component) → check mount logic, conditional render, wrong branch.
   - `major` (overflow / overlap / cutoff) → check CSS layout, container constraints, z-index.
   - `minor` (spacing / color / alignment) → check tokens, design-system usage.
3. Cross-check `TEXT VISIBLE` against expected strings — a missing or garbled string often points at the data path, not CSS.
4. Decide: fix in code, re-capture after a state change, or escalate to the user.

**Guard:** The subagent reports pixels; it does not name CSS properties or files. You own the root-cause mapping. Do not paste the raw report to the user as an "answer" — translate it into the fix you'll make.

**Loop back:** If the report says `ERROR: <reason>` or the image was unreadable, re-capture and re-spawn once. A second failure is an environment problem — escalate.

### Step 5 — Clean up

**Purpose:** Don't leak temp images or browser instances.

**Actions:**

- Delete the temp screenshot file you created (only files you created this session).
- `close_instance` any browser you spawned for this check (not ones owned by `testing-extension-browser`).

**Guard:** Never delete user-provided files or files you did not create.

## Anti-patterns

| Anti-pattern | Why it fails | Do instead |
|---|---|---|
| Spawn subagent without `file_path`, pass base64 in the prompt | The subagent's only tool is `read`; it cannot decode base64 from text | Always save to disk first, pass the path |
| Send a `take_screenshot` base64 result to the subagent | Same — `read` needs a file path | Use `take_screenshot(file_path=...)` |
| Ask the subagent to suggest CSS or code | It sees pixels, not your codebase | You map deviations → code causes |
| Vague `expected` ("should look good") | Report has nothing to compare against | Name regions + the one invariant |
| Skip cleanup, leak temp PNGs | Disk fills over a long session | Delete screenshots you created |
| Use this for DOM structure | Wastes a vision call on text data | Use `query_elements` / `take_snapshot` |

## Verification

Before treating the subagent's report as ground truth:

- [ ] The image path you passed exists and is a valid PNG/JPG.
- [ ] The report has the `VISION REPORT` header and at least one `REGIONS` entry (or an explicit `ERROR`).
- [ ] `DEVIATIONS` entries each have a severity — if not, the subagent drifted from schema; re-spawn with a tighter prompt.
- [ ] You mapped every `blocker`/`major` deviation to a concrete code location before acting.
- [ ] Temp screenshot you created is deleted; browser instance you spawned is closed.

## Router boomerang

Done with the visual check? Re-invoke `/using-agent-skills` to route the next phase — usually `debugging-and-error-recovery` (if deviations found), `frontend-ui-engineering` (if a UI fix is needed), or `git-workflow-and-versioning` (if the fix is verified and ready to commit).
