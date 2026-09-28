# Write-Skill — verification checklist

## Triggering

- [ ] Activates on a direct request ("write a skill for X") and a natural one ("how do I turn this into a skill?")
- [ ] Stays dormant for out-of-scope requests; does not collide with similar skills

## Functional

- [ ] Ran on a real task and changed the outcome; same task run twice gives consistent output
- [ ] Usable by an agent that did not write it
- [ ] Handles ambiguous scope by asking, not guessing; does not mutate unrelated files
- [ ] If self-evolution enabled: archives before overwrite, rolls back on regression

## Structure

- [ ] `name` matches dir (kebab-case); `description` = one sentence, capability + trigger + boundary, no workflow summary
- [ ] "When to Use" + "When NOT to use" present
- [ ] Every step: purpose, actions, pass/fail guard, loop-back
- [ ] ≥1 concrete template or checklist; ≥1 anti-patterns/rationalizations table
- [ ] No code implementation — process only
- [ ] ≤300 lines (ceiling 500) or split; Router boomerang at the end
