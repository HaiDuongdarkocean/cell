# Questioning — gap-closing techniques

> Load when the hypothesis has real gaps the analysis can't close. Questions serve the analysis — never a template list.

## The one-question-at-a-time rule

```
Q: <one focused question>
GUESS: <your hypothesis for the answer>
```

The attached guess lets the user react to a wrong answer faster than generating from scratch — and commits the agent to being visibly wrong. Later questions depend on earlier answers, so never batch.

## Rephrase vague answers — don't accept them

```
User answers (vague) → rephrase specific → "Em hiểu [X]. Đúng chưa?"
  ├─ Confirm → fill the gap → next
  └─ Correct → rephrase → confirm → repeat
```

| User says (vague) | Rephrase (specific) |
|---|---|
| "Tải sub dễ hơn" | "Tải file phụ đề về máy với ít bước hơn hiện tại" |
| "Máy tôi yếu" | "RAM ≥1GB, Chrome/Edge/Brave, có thể Android" |
| "Tải thủ công" | "(1) mở site → (2) tìm drama → (3) tìm link → (4) tải .srt → (5) merge" |

## Evidence-grounded, not open-ended

Never ask what the codebase can answer. ≥1 grep must run before any question.

| DON'T | DO |
|---|---|
| "Anh muốn giải quyết vấn đề gì?" | "Em thấy Cell đã có subtitle-search. Idea 'OCR sub' — sub không có file riêng, hay sub có file nhưng không tìm được?" |

## Want vs should-want

Dangerous answers sound thoughtful: best-practice talk ("scalable", "clean architecture"), convention deferral, "I should probably…".

> *"If you didn't have to justify this to anyone, what would you actually want?"*

## Detecting fake confirmation

NOT yes: "whatever you think is best" → re-ask as two concrete options. "Sounds good" → "anything you'd refine?" "Sure, let's go" → often a polite exit. Silence + "okay let's start" → the user gave up, not converged — stop and ask what was missed.

## When to stop asking

**95% confidence stop:** you can predict reactions to the next 3 questions AND every analysis gap is closed. Several rounds in and still can't predict → "Em đã hỏi X câu mà vẫn không predict được phản ứng của anh. Có gì đó foundational đang thiếu — step back?"

## Escalation

If a question keeps resurfacing or answers contradict — that's a signal the hypothesis frame itself is wrong. Re-run BACCM inference on the new evidence; don't stack more questions on a broken frame.
