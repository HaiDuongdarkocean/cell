# Elicitation Playbook

Use this when the user's feedback is vague: "xấu", "không hợp", "trông tệ", "không giống ý anh".

## Core Rule

**Don't guess. Extract.** Ask one question at a time, attach a hypothesis, rephrase until concrete.

## Step 1: Detect Vague Feedback

Vague feedback has one or more of these signatures:

- Adjective without object: "xấu", "lộn xộn", "chán".
- Comparison without attribute: "không giống YouTube", "không giống Linear".
- Wish without context: "làm cho đẹp hơn", "cho nó premium".
- Emotion without cause: "không thích", "cảm giác không đúng".

If any match, run this playbook. Otherwise, skip to `SKILL.md` Step 2.

## Step 2: Ask One Question at a Time

Format:

```text
Q: <one focused question>
GUESS: <your best read>
```

**Why one at a time:** The user's third answer depends on the first two.

**Why attach a guess:** Users react faster to a wrong guess than to an open prompt.

### First question (always)

> "Anh đang nhìn ở màn hình nào: mobile, tablet, hay desktop?"

Guess the viewport based on the project context. If unknown, default to 320px because the skill is mobile-first.

### Second question

> "Điều đầu tiên anh muốn người dùng làm ở trang này là gì?"

Attach a guess from the page's primary function.

### Third question

> "Với anh, 'không hợp' là quá đông, quá trống, quá bóng bẩy, hay quá cứng nhắc?"

This maps directly to the 3 dials: visual density, visual density, motion intensity, design variance.

## Step 3: Rephrase → Confirm

For every vague answer, rephrase into a concrete statement and ask for confirmation.

| Vague | Rephrased |
|---|---|
| "Không hợp mắt" | "Nhiều thứ chen chúc nhau, mắt không biết nhìn đâu trước" |
| "Chưa professional" | "Nhìn giống template, thiếu chi tiết hoàn thiện" |
| "Không giống ý anh" | "Anh muốn cảm giác trầm/ít màu hơn, đúng không?" |

Stop when the user says "đúng" or gives a specific correction.

## Step 4: Fill the 8-Field Frame

When confidence reaches ~80%, present the frame:

```text
- Problem:       <concrete pain statement>
- User:          <persona, device, context>
- Workflow:      <3+ steps with pain marker>
- Pain point:    <specific, quantified if possible>
- Evidence:      <review, bug, observation, data>
- Desired:       <measurable outcome>
- Constraint:    <binding limits + domain conflicts>
- Scope:         <MVP + out-of-scope>
```

## Step 5: Stop at Explicit Yes

These are **not** yes:

- "Whatever you think is best." → re-ask with two options.
- "Sounds good." → ask "Anything you'd refine?"
- "Sure, let's go." → ask for one specific confirmation.
- Silence.

Done only when the user gives an explicit "yes", "đúng", or "duyệt".

## Probes by Vague Word

| User says | Probe |
|---|---|
| "xấu" | "Cụ thể là màu sắc, bố cục, hay font chữ?" |
| "lộn xộn" | "Thông tin quá nhiều hay không được nhóm đúng?" |
| "không hợp" | "Không hợp với thương hiệu, với đối tượng, hay với màn hình?" |
| "chưa premium" | "Premium với anh là tinh tế hơn, ít hơn, hay đắt hơn?" |
| "giống YouTube/Linear/Apple" | "Phần nào cụ thể: màu, chuyển động, layout, hay icon?" |
