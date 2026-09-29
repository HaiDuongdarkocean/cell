# Analyze approval — sync-on-use

Mode: interactive · Intent: `docs/intent/sync-on-use.md` · Date: 2026-09-29

## Approval record (user decisions in session)

| # | Hypothesis presented | User decision |
|---|---|---|
| 1 | Root causes: no push trigger for IDB writes (B1), timer-only full-cycle pull (B2), applied broadcast never reaches content scripts (B3) | Accepted; asked for ≤3s realtime with lower load |
| 2 | Continuous visible-surface polling (Hot/Warm/Cold) | Rejected in favor of "pay as you go": probe only when the user uses a word-status/tokenize feature |
| 3 | Cue appearance as trigger | Rejected: "cue xuất hiện không liên quan tới việc status thay đổi" — passive rendering never triggers |
| 4 | Probe cadence while active | Option 1: every qualifying action probes (throttled); after >5 min idle the first action wakes and probes once |
| 5 | Qualifying actions list (word-status messages + first tokenize per page) | Accepted ("ok được rồi đó") |
| 6 | Wire format zip/json/binary | Keep JSON+gzip; prioritize request reduction first |
| 7 | Token expiry 1h | Accepted silent renewal; UI never blocks on sync |
| 8 | Firefox parity | Required; no keep-alive tricks |

Final instruction: "ok được rồi đó hãy lập plan và làm đi."

## Open item resolved conservatively

SRS/Reader as explicit triggers — not answered by user; intent keeps them out of scope (they sync via push-on-write + 15-min safety net; Reader tokenize goes through the first-per-page rule if it uses `WORD_STATUSES_GET`).

VERDICT: APPROVE

## Applied fixes (loop 1 — after spec review REJECT)

- TO-BE step 5 and story S3 reworded: an idle browser makes no *probe* requests; the scheduled 15-minute safety-net full cycle (accepted by the user in the proposal table "Lượt sync đầy đủ 15–30 phút — Giữ, làm lưới an toàn") remains the only idle traffic.
- Draft AC request count qualified to a warm provider instance (spec blocker: provider instances were re-created per pass).
- No change to needs, scope or decision; user approvals above still hold.

VERDICT: APPROVE
