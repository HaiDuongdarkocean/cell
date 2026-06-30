#!/usr/bin/env node
// reinject-rules.js — Devin CLI hook (compatible Claude Code format)
// Inject AGENTS.md core rules reminder into agent context via additionalContext
// Chống recency bias: rules luôn "gần" task hiện tại
// Cross-platform (Windows/Mac/Linux), no deps, reads stdin, writes JSON to stdout

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  let eventName = 'unknown';
  try {
    const data = JSON.parse(input);
    eventName = data.hook_event_name || 'unknown';
  } catch { /* stdin rỗng hoặc không JSON — vẫn emit reminder */ }

  // Flashcard: 8 rule cốt lõi, ngắn, checkable. Không phải "hãy đi đọc AGENTS.md".
  const reminder = [
    'REMINDER (re-inject — apply now):',
    '1. Gọi user "Anh yêu", xưng "em".',
    '2. Xác định giai đoạn 0-7 → invoke /software-production-workflow. KHÔNG skip docs.',
    '3. Ponytail PRE-FILTER (7 rung) TRƯỚC code. Bug fix = root cause, fix shared function 1 lần, grep mọi caller.',
    '4. Trước sửa file: read docs/2-architechture-system.md (Bảng phụ thuộc + Function Index).',
    '5. Sau sửa: update docs/2-architechture-system.md 3 chỗ (Cây thư mục + Bảng phụ thuộc + Function Index) — verify bằng ls, không tin memory. Không để annotation (future) còn sót trên code đã implement.',
    '6. Docs thay đổi → update docs/0-wiki.md mục lục.',
    '7. Pre-commit: git diff --name-only → npm run test:unit → npx tsc --noEmit → npm run lint. Atomic: code ≠ docs (2 commit). Insight → /conceptualization.',
    '8. Chrome MV3: pass tabId, dùng getActiveContentTab(), auto-download guard id-level dedup.'
  ].join('\n');

  // Claude Code hook format: exit 0 + JSON with hookSpecificOutput.additionalContext
  // additionalContext được inject vào context window tại điểm hook fire
  const output = {
    hookSpecificOutput: {
      hookEventName: eventName,
      additionalContext: reminder
    }
  };

  process.stdout.write(JSON.stringify(output));
  process.exit(0);
});

// Fallback nếu stdin không close (timeout safety)
setTimeout(() => {
  const output = {
    hookSpecificOutput: {
      hookEventName: 'unknown',
      additionalContext: 'REMINDER: apply AGENTS.md rules — ponytail PRE-FILTER, verify by ls, pass tabId.'
    }
  };
  process.stdout.write(JSON.stringify(output));
  process.exit(0);
}, 2000);
