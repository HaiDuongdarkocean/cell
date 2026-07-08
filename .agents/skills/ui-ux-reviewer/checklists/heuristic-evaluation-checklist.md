# Heuristic Evaluation Checklist — Nielsen 10 + AI-Slop Tells + Severity

> Run during Step 10 of the review process. Assess each heuristic against the screenshots and code diff.

## Nielsen 10 usability heuristics

### H1 — Visibility of system status

> The system should always keep users informed about what is going on, through appropriate feedback within reasonable time.

Check:
- [ ] Loading states present (skeleton, not spinner) for async operations.
- [ ] Active tab/section clearly indicated (underline, color, aria-selected).
- [ ] Success feedback after an action (not silent success).
- [ ] Progress indicator for multi-step tasks.
- [ ] Cursor changes on draggable elements (drag-drop zones).

Violation examples:
- User clicks "Import" and nothing happens for 3 seconds with no loading indicator. (Severity 3)
- Active tab looks identical to inactive tabs. (Severity 3)
- Form submits successfully but user sees no confirmation. (Severity 2)

### H2 — Match between system and the real world

> The system should speak the users' language, with words, phrases and concepts familiar to the user, rather than system-oriented terms.

Check:
- [ ] Labels use user vocabulary, not codebase terms ("Tài nguyên" not "DictionaryRepositoryManager").
- [ ] Icons are universally recognized or paired with text labels.
- [ ] Information appears in natural and logical order.

Violation examples:
- Label says "Repository" instead of "Tài nguyên" or "Dictionary". (Severity 2)
- Error message says "ENOENT: no such file" instead of "File not found". (Severity 3)

### H3 — User control and freedom

> Users often choose system functions by mistake and will need a clearly marked "emergency exit" to leave the unwanted state without having to go through an extended dialogue.

Check:
- [ ] Cancel button on dialogs and multi-step flows.
- [ ] Undo for destructive actions (or confirmation dialog before delete).
- [ ] Back navigation from every screen except root.
- [ ] Close (X) on modals and overlays.
- [ ] Escape key closes modals.

Violation examples:
- Delete action has no confirmation and no undo. (Severity 4)
- Modal has no close button and no escape key handler. (Severity 3)
- User enters a sub-page with no way back. (Severity 3)

### H4 — Consistency and standards

> Users should not have to wonder whether different words, situations, or actions mean the same thing.

Check:
- [ ] One accent color used consistently across all sections.
- [ ] One font family (display + body + mono) used consistently.
- [ ] One corner-radius system applied everywhere.
- [ ] Similar actions labeled the same way ("Delete" not "Remove" in one place and "Delete" in another).
- [ ] One stroke width across all icons.
- [ ] One transition duration and easing across all interactive elements.

Violation examples:
- Primary CTA is blue in section 1 and green in section 2. (Severity 3)
- Cards have 12px radius but buttons have 20px radius with no documented rule. (Severity 2)
- "Delete" in one panel, "Remove" in another for the same action. (Severity 2)

### H5 — Error prevention

> Even better than good error messages is a careful design which prevents a problem from occurring in the first place.

Check:
- [ ] Confirmation dialog before destructive actions (delete, reset, overwrite).
- [ ] Form validation before submit (email format, required fields, file type).
- [ ] Disabled state for actions that are not currently available.
- [ ] Constraints on inputs (max length, allowed characters).

Violation examples:
- Delete button is one click with no confirmation. (Severity 4)
- Form submits with empty required fields, then shows error. (Severity 3)
- Import accepts any file type, then fails on unsupported format. (Severity 2)

### H6 — Recognition rather than recall

> Minimize the user's memory load by making objects, actions, and options visible.

Check:
- [ ] Options are visible (not hidden behind undocumented gestures or menus).
- [ ] Current state is visible (which tab is active, which items are selected).
- [ ] Recently used items are accessible.
- [ ] Labels and instructions are visible when needed, not in a separate manual.

Violation examples:
- User must remember which tab they were on because the active state is not clear. (Severity 3)
- Options are hidden in a right-click menu with no visual cue. (Severity 3)
- Empty state shows no guidance on how to populate. (Severity 2)

### H7 — Flexibility and efficiency of use

> Shortcuts, hidden from novice users, may speed up the interaction for the expert user.

Check:
- [ ] Keyboard navigation works (Tab, Arrow keys, Enter, Escape).
- [ ] Keyboard shortcuts for frequent actions (if applicable).
- [ ] Search or command menu for > 12 items.

Violation examples:
- Cannot navigate tabs with arrow keys. (Severity 2)
- 20-item list with no search or filter. (Severity 2)

### H8 — Aesthetic and minimalist design

> Interfaces should not contain information which is irrelevant or rarely needed.

Check:
- [ ] Every element on screen earns its place (no decoration for decoration's sake).
- [ ] No irrelevant information in primary zones.
- [ ] Whitespace is generous, not cramped.
- [ ] No visual noise (excessive borders, shadows, badges, dots).

Violation examples:
- Screen has 5 badges, 3 status dots, and 2 decorative labels that convey no information. (Severity 2)
- Primary zone has a "Did you know?" tip box that the user did not ask for. (Severity 2)
- Padding is 8px when it should be 24px (cramped). (Severity 2)

### H9 — Help users recognize, diagnose, and recover from errors

> Error messages should be expressed in plain language (no codes), precisely indicate the problem, and constructively suggest a solution.

Check:
- [ ] Error messages in plain language, no error codes.
- [ ] Error messages tell the user what to do next.
- [ ] Errors are inline (near the relevant element), not in a global alert.
- [ ] No "Oops!" or exclamation marks in error messages.

Violation examples:
- Error says "ERR_NETWORK_401" with no explanation. (Severity 3)
- Error says "Oops! Something went wrong." with no recovery action. (Severity 3)
- Error appears in a global toast while the relevant field is off-screen. (Severity 2)

### H10 — Help and documentation

> Even though it is better if the system can be used without documentation, it may be necessary to provide help and documentation.

Check:
- [ ] Empty states guide the user toward first action.
- [ ] Tooltips on complex controls (if needed, not on everything).
- [ ] No need for an external manual to use the screen.
- [ ] Help is contextual (available where the user is stuck), not a separate page to find.

Violation examples:
- Empty state says "No data" with no guidance. (Severity 2)
- User must read a wiki page to understand what a control does. (Severity 3)

## AI-slop tell sweep

Scan all screenshots and code diff for these tells. Any tell is an automatic severity 2+ violation.

- [ ] Em-dash (`—`) visible anywhere. (Severity 3, non-negotiable ban)
- [ ] Inter as font-family default. (Severity 2)
- [ ] AI-purple gradient. (Severity 2)
- [ ] 3 equal cards in a row. (Severity 2)
- [ ] Fake screenshot (div-based product UI). (Severity 3)
- [ ] Scroll cue ("Scroll", "↓ scroll"). (Severity 2)
- [ ] Locale strip ("Lisbon 14:23 · 18°C"). (Severity 2)
- [ ] Version footer ("v1.4.2"). (Severity 2)
- [ ] Eyebrow count > ceil(sectionCount / 3). (Severity 2)
- [ ] Centered hero when variance > 4. (Severity 2, landing pages only)
- [ ] Decorative colored dots on every list/nav item. (Severity 1)
- [ ] Photo-credit captions as decoration. (Severity 1)
- [ ] Pills/labels overlaid on images. (Severity 2)
- [ ] "Quietly in use at" social-proof header. (Severity 1)
- [ ] Generic names ("John Doe", "Acme Corp"). (Severity 2)
- [ ] Fake round numbers (`99.99%`, `50%`). (Severity 2)
- [ ] AI copywriting cliches ("Elevate", "Seamless", "Unleash"). (Severity 2)
- [ ] Lorem Ipsum. (Severity 3)
- [ ] Title Case on every header. (Severity 1)

## Severity rating scale (Nielsen 0-4)

| Rating | Meaning | Action | Example |
|---|---|---|---|
| 0 | Not a problem | No action | Color contrast is 7:1, well above 4.5:1 |
| 1 | Cosmetic problem | Fix if time allows | Inconsistent stroke width between two icons |
| 2 | Minor usability problem | Fix before next milestone | Label says "Remove" in one place, "Delete" in another |
| 3 | Major usability problem | Fix before ship | No loading indicator during 5-second import |
| 4 | Catastrophic usability problem | Stop, fix immediately | Delete with no confirmation and no undo |

## Cognitive walkthrough questions (Step 11)

For each task, at each step, answer:

1. **Will the user know what to do at this step?**
   - Is the next action obvious from the current screen?
   - Is there a clear visual cue (button, link, instruction)?
   - If not, what would the user likely do instead?

2. **Will the user see the correct control?**
   - Is the control visible without scrolling (if above-fold expected)?
   - Is the control in an expected location (primary zone, not buried)?
   - If not, where would the user look first?

3. **Will the user know that the control is the right one?**
   - Does the control's appearance match its function? (Affordance)
   - Is the label clear and in the user's vocabulary?
   - If not, what would the user think the control does?

4. **After the action, will the user understand the feedback?**
   - Does the system respond within reasonable time?
   - Is the response recognizable as progress (not silent success)?
   - If not, what would the user think happened?

Record any "no" or "uncertain" answer as a violation with: task, step, question, what the user would likely do instead, severity.
