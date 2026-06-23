# Implementation Plan: Parallel HLS Segment-Based TS→MP4 Conversion with Auto/Manual Scaling

## Overview

Mục tiêu là giảm thời gian convert `.ts` lớn sang `.mp4` trong Chrome MV3 extension bằng cách chuẩn bị nền tảng cho parallel conversion dựa trên **HLS segment boundaries**, không chia tùy ý theo byte/4MB. Thiết kế sẽ giữ đường sequential hiện tại làm fallback an toàn. Parallel chỉ chạy khi input đủ điều kiện an toàn, có segment range metadata, worker count được auto/manual clamp, output được validate, và mọi failure đều cleanup + fallback rõ ràng.

Điểm quan trọng:

```txt
HLS segment boundary = đơn vị chia việc
4MB chunk = đơn vị đọc I/O tiết kiệm RAM bên trong từng việc
```

Không implement ngay binary split bằng IDR byte offsets vì đã bị doubt review xác định rủi ro cao: timestamp discontinuity, audio desync, missing PAT/PMT, SPS/PPS mismatch, memory multiplier.

---

## Architecture Decisions

### Decision 1: Chọn hướng `input.ts + segmentRanges metadata`

**Rationale:**

- Fallback `.ts` rất dễ vì `input.ts` đã tồn tại.
- Memory an toàn hơn so với giữ segment blobs trong RAM.
- Chỉ cần metadata nhỏ để biết segment nào nằm ở byte range nào.
- Dễ test, dễ cleanup, ít file handle hơn.

```txt
download segments
→ append vào input.ts
→ record segmentRanges
→ worker/process đọc theo segment range
```

---

### Decision 2: Parallel split theo HLS segment group, không split theo 4MB byte chunk

**Rationale:**

- 4MB có thể cắt giữa TS packet/PES/frame/audio frame.
- HLS segments thường là media boundary tự nhiên hơn.
- Worker sẽ nhận group segments, ví dụ:

```txt
worker 0: segments 0..76
worker 1: segments 77..154
worker 2: segments 155..231
worker 3: segments 232..309
```

---

### Decision 3: Auto/manual scaling chỉ là request, runtime vẫn clamp an toàn

Manual không được phép force unsafe parallel.

```ts
actualWorkers = min(
  requestedWorkers,
  safeWorkersFromAnalysis,
  hardwareConcurrency - 1,
  globalWorkerBudget,
  MAX_WORKERS
);
```

Nếu không đủ safe workers:

```txt
Parallel unavailable for this file; using sequential or .ts fallback.
```

---

### Decision 4: Ship incremental foundation first

Parallel engine là phần rủi ro cao. Trước tiên cần:

1. settings auto/manual/off
2. timing instrumentation
3. segment range tracking
4. safety analyzer

Sau đó mới experimental parallel behind feature flag.

---

## Dependency Graph

```txt
Settings model
    │
    ├── Popup UI controls
    │
    └── Background downloader policy
            │
            ├── Segment range tracking
            │       │
            │       └── Segment grouping logic
            │               │
            │               └── Safety analyzer
            │                       │
            │                       └── Parallel eligibility decision
            │                               │
            │                               └── Experimental parallel worker engine
            │                                       │
            │                                       ├── Temp part OPFS output
            │                                       ├── Streaming merge
            │                                       └── MP4 validation
            │                                               │
            │                                               └── Auto mode enablement
```

Implementation order follows this graph.

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---:|---|
| Independent mux.js workers produce incompatible fragments | High | Keep behind experimental flag; validate MP4 fragments; fallback closed |
| HLS segments do not start with keyframe/PAT/PMT | High | Safety analyzer rejects ineligible inputs |
| Audio desync at group boundaries | High | Segment-boundary grouping; validation; manual playback benchmark |
| Memory spikes from worker inputs/outputs | High | Transfer <=4MB chunks; stream worker output to OPFS temp files |
| Parallel fail makes total slower than sequential | Medium/High | Early eligibility checks; fallback policy; late failure can save `.ts` |
| OPFS file handle locking across workers | Medium | Offscreen orchestrator reads chunks and transfers to workers; avoid multiple sync handles per same file |
| Concurrent downloads oversubscribe CPU | Medium | Global worker budget |
| Offscreen document lifecycle interrupts jobs | Medium | Active conversion job tracking; ready handshake already exists; avoid closing while active |
| Implementation complexity grows too large | High | Milestones, experimental flag, checkpoints, no auto default until gates pass |

---

## Open Questions

1. Should default fallback for large files be:
   - `save-ts` to avoid wasting more time, or
   - `sequential` to maximize chance of MP4?

2. Should manual worker mode be hidden behind "Advanced / Experimental" initially?

3. What max worker cap do you prefer?
   - Conservative: 4
   - Aggressive: 6

4. Do you want auto mode disabled by default until real 424MB sample proves speedup?

My recommendation:

```txt
parallelConversionMode = 'auto'
but auto only does dry-run/planning until gates pass

experimentalParallel = false by default
manual experimental enable required for real parallel initially
```

---

## Go / No-Go Gates

Parallel conversion must not ship as default unless all gates pass.

### Correctness Gate

- [ ] Parallel output plays in Chrome/VLC.
- [ ] Audio stays in sync across internal boundaries.
- [ ] Validator passes.
- [ ] No timestamp reset/overlap.
- [ ] Sequential and parallel outputs have comparable duration.

### Performance Gate

For user's measured sample:

```txt
424MB sequential: ~360s
```

Minimum acceptable:

```txt
parallel 4 workers <= 240s
```

Good target:

```txt
parallel 4 workers <= 180s
```

Excellent:

```txt
parallel 4 workers <= 150s
```

If not under 240s, do not enable auto by default.

### Memory Gate

- [ ] No whole 100MB worker slices.
- [ ] Input chunks bounded, e.g. <=4MB per worker in flight.
- [ ] Output parts streamed to OPFS.
- [ ] Peak additional memory stays reasonable for 400–500MB files.

Suggested soft gate:

```txt
additional memory < 300MB
```

### Safety/Fallback Gate

Force these failures:

- [ ] worker throws
- [ ] worker hangs/timeout
- [ ] validation fails
- [ ] OPFS quota exceeded
- [ ] cancellation
- [ ] offscreen restart/lifecycle issue

Expected:

- [ ] no corrupt final MP4
- [ ] no orphan temp part files
- [ ] clear fallback status
- [ ] `.ts` fallback still works
