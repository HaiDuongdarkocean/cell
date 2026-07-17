# SRT parser "None" literal cue index (kisskh.buzz / angkortv)

> **Principle**: [Parser tolerance — skip noise lines, don't reject whole block](principles.md#parser-tolerance--skip-noise-lines-dont-reject-whole-block)

## Problem

Anh yêu báo: kisskh.buzz auto-load fail mặc dù extension detect subtitle URLs (5 SRT: en, kh, id, ms, ar) + drag-drop hoạt động. Manager panel hiển thị "Target0 subtitles" + toast "Auto-load target failed: No cues found in SRT content".

Edge MCP debug flow:
1. `list_network_requests` → 5 SRT URLs loaded (reqid 2538-2542)
2. `list_console_messages` (page) → `[handleAutoLoadSubtitles] parse results { targetSuccess: false, targetError: "No cues found in SRT content" }`
3. `fetch('https://media.angkortv.com/a-hundred-memories-episode-1-en.srt')` → status 200, content-type `application/x-subrip`, 84934 bytes
4. `first500` chars: `None\r\n00:00:10,580 --> 00:00:13,280\r\n(Kim Da Mi)\r\n\r\nNone\r\n00:00:14,320 --> 00:00:16,190\r\n(Shin Ye Eun)\r\n\r\n...`

Root cause: kisskh/angkortv SRT dùng literal `None` thay vì số index cho mỗi cue. Parser reject mọi cue → 0 cues → auto-load fail.

## Root causes

`src/shared/lib/parsers/srtParser.ts` flow cũ (trước fix):

```ts
const blocks = normalized.split(/\n\s*\n/);  // split by blank line
for (const block of blocks) {
  const lines = trimmedBlock.split('\n');
  let lineIndex = 0;

  // Check if lines[0] is numeric cue index
  if (/^\d+$/.test(lines[0].trim())) {
    cueIndex = parseInt(lines[0].trim(), 10);
    lineIndex = 1;
  }

  // lines[0] = "None" → not numeric → lineIndex stays 0
  const timingLine = lines[lineIndex].trim();  // = "None"
  const timing = parseTimingLine(timingLine);  // = null (not a timing line)

  if (timing === null) {
    continue;  // SKIP entire cue
  }
  // → Every cue skipped → 0 cues
}
```

Block kisskh SRT:
```
None\r\n
00:00:10,580 --> 00:00:13,280\r\n
(Kim Da Mi)\r\n
\r\n
```

Sau normalize CRLF → LF:
```
None
00:00:10,580 --> 00:00:13,280
(Kim Da Mi)
```

- `lines[0]` = `"None"` → không match `/^\d+$/` → `cueIndex` undefined, `lineIndex` stays 0
- `timingLine` = `lines[0]` = `"None"` → `parseTimingLine("None")` → null → `continue` (skip cue)
- Mọi cue bị skip → `srt.cues.length === 0` → `parseSubtitle` return `{ success: false, error: "No cues found in SRT content" }`

## Fix

`src/shared/lib/parsers/srtParser.ts` — thêm while-loop skip non-timing lines cho đến khi tìm thấy timing line:

```ts
let timingLine = lines[lineIndex].trim();
let timing = parseTimingLine(timingLine);

// Non-standard SRT (kisskh.buzz/angkortv): first line is a literal like
// "None" instead of a numeric index. Skip non-timing lines until we find
// the timing line — without this, every cue is skipped and auto-load
// fails with "No cues found in SRT content".
while (timing === null && lineIndex + 1 < lines.length) {
  lineIndex += 1;
  timingLine = lines[lineIndex].trim();
  timing = parseTimingLine(timingLine);
}

if (timing === null) {
  // No timing line found in this block → skip
  continue;
}
lineIndex += 1;
```

Logic:
1. Thử `lines[lineIndex]` làm timing line
2. Nếu null + còn dòng tiếp theo → advance `lineIndex`, thử lại
3. Nếu hết dòng mà vẫn null → skip block (như cũ, không phải SRT block hợp lệ)
4. Nếu tìm thấy timing → `lineIndex += 1` rồi lấy text lines còn lại

## Key insight

Parser phải tolerant với non-standard format — skip noise lines thay vì reject cả block khi 1 line không match format kỳ vọng. Real-world subtitle sources (kisskh, angkortv, fansub) có format variant: literal `None` thay vì số index, missing index, extra metadata lines. Reject cả block = mất toàn bộ cue; skip noise line = giữ được cue. Timing line là structural anchor (regex match `HH:MM:SS,mmm --> HH:MM:SS,mmm`), text/index là noise-tolerant.

## Verification

### Unit test
`tests/unit/shared/lib/parsers/srtParser.test.ts` — test mới:
```ts
test('parses kisskh/angkortv SRT with "None" literal as cue index', () => {
  const content = `None\r\n00:00:10,580 --> 00:00:13,280\r\n(Kim Da Mi)\r\n\r\nNone\r\n00:00:14,320 --> 00:00:16,190\r\n(Shin Ye Eun)\r\n\r\nNone\r\n00:00:18,120 --> 00:00:20,560\r\n(Heo Nam Jun)`;
  const result = parseSrt(content);
  expect(result.cues).toHaveLength(3);
  expect(result.cues[0].index).toBe(1);
  expect(result.cues[0].start).toBe(10580);
  expect(result.cues[0].end).toBe(13280);
  expect(result.cues[0].text).toBe('(Kim Da Mi)');
  expect(result.cues[1].text).toBe('(Shin Ye Eun)');
  expect(result.cues[2].text).toBe('(Heo Nam Jun)');
});
```

Result: 11 srtParser tests pass (bao gồm test kisskh "None" format).

### Browser verify (Edge MCP, kisskh.buzz/2026/06/06/a-hundred-memories-2025/?episode=1)
- Trước fix: `sectionHeaders: ["Target0 subtitles", "Native0 subtitles"]` + toast "Auto-load target failed: No cues found in SRT content"
- Sau fix: `sectionHeaders: ["Target · English1 subtitle", "Native0 subtitles"]` — auto-load thành công ✓

### Quality gates
- `npx jest --selectProjects unit --testPathPatterns "srtParser|subtitleParser|subtitleAutoLoad"` → 45 tests pass
- `npm run typecheck` → pass
- `npm run build` → pass
