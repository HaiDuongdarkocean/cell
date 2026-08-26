# Plugin: Root Cause Analysis

> Load when user states pain or solution vaguely. Don't accept symptoms as root causes.

## When to Load

- User says "pain" / "khó chịu" / "ghét" / "frustrating" → 5 Whys
- User says "I want [solution]" not "I have [problem]" → 5 Whys
- User says "feature X không hoạt động" → Fishbone
- Pain point field in frame still vague after clarification loop → 5 Whys

## 5 Whys

**Ask "tại sao" until you hit root need, not solution.**

```
User: "tôi muốn OCR"
AI: "tại sao anh muốn OCR?"
User: "vì tôi muốn sub cho hard-sub"
AI: "tại sao anh cần sub cho hard-sub?"
User: "vì tôi học ngoại ngữ qua xem phim"
AI: "tại sao sub giúp anh học?"
User: "vì tôi cần đọc trong khi nghe"
AI: "tại sao đọc-nghe cùng lúc quan trọng?"
User: "vì tôi không nghe được nhanh enough"
→ ROOT CAUSE: cần đọc sub khi nghe chưa kịp
→ Solution space: OCR (nhưng cũng có thể: slow audio, replay, dual sub)
```

**Guard:** Root cause is a need, not a solution. If you can name 3+ solutions that satisfy it, it's a root cause. If only 1 solution fits, it's a symptom.

**Loop back:** If 5 Whys doesn't reach root cause after 5 iterations, switch to Fishbone.

## Fishbone

**Map causes by category when "feature không hoạt động".**

| Category | Question |
|---|---|
| People | User doesn't know correct input? |
| Process | Workflow format wrong? |
| Technology | API limit? Service down? |
| Environment | Network slow? Extension conflict? |

Pick the most likely category → verify with user → drill down.

**Guard:** At least 2 categories have potential causes. If only 1 category, you haven't mapped enough.

**Loop back:** If no category has a likely cause, the problem statement is wrong. Re-elicit.

## Output

Root cause → fill Pain point field (specific, not symptom).

If root cause reveals different solution space → update Scope field.

| Before 5 Whys | After 5 Whys |
|---|---|
| Pain: "tôi muốn OCR" | Pain: "cần đọc sub khi nghe chưa kịp" — root need, 3+ solutions fit |
| Scope: "build OCR" | Scope: "MVP: OCR 1 frame. Out: slow audio, dual sub (consider later)" |

## Anti-patterns

| Anti-pattern | Why it fails |
|---|---|
| Accept "make it faster" as pain | Symptom — root cause might be "user doesn't know workflow" |
| Stop at Why #2 | Surface answer — root cause is deeper |
| Accept user's solution as root need | "I want OCR" is solution, not need |
| Only 1 solution fits root cause | That's a symptom, not root cause |
| Ask "why" aggressively | Feels like interrogation — frame as curiosity |

## Verification

- [ ] Root cause is a need (3+ solutions could satisfy it)
- [ ] Pain point field filled with root cause, not symptom
- [ ] If solution space changed, Scope field updated
- [ ] User confirmed root cause restate
