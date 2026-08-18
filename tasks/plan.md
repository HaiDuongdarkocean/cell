# Implementation Plan: Manager Host Sheet Bridge

## Overview
Bridge protocol để render SubtitleManagerPanel trên host page khi user mở manager trong cross-origin iframe trên mobile. Child iframe gửi state, host page render sheet, actions gửi ngược qua postMessage.

## Architecture Decisions
- **File split strategy**: Mỗi module là 1 file riêng → tối đa parallel subagent, 0 file conflict
- **Types file first**: Tất cả types trong 1 file, mọi module import từ đó → wave 2 parallel
- **Serializer tách riêng**: `ManagerState` (có callbacks) → `SerializedManagerState` (JSON-only) tách hàm thuần, dễ test
- **Host sheet component tách riêng**: React component độc lập, không depend `SubtitlePanels.tsx`
- **Action dispatcher pattern**: `MGR_ACTION` generic `{action, args}` → child-side map action→callback, dễ extend Phase 2

## File Ownership Map (0 conflict guaranteed)

| File | Owner Task | Status |
|------|-----------|--------|
| `src/features/subtitle/logic/iframeManagerBridgeTypes.ts` | T1 | NEW |
| `src/features/subtitle/logic/managerStateSerializer.ts` | T2 | NEW |
| `src/features/subtitle/logic/iframeManagerBridgeChild.ts` | T3 | NEW |
| `src/features/subtitle/logic/iframeManagerBridgeHost.ts` | T4 | NEW |
| `src/features/subtitle/ui/HostManagerSheet.tsx` | T5 | NEW |
| `src/features/subtitle/ui/HostManagerSheet.module.css` | T6 | NEW |
| `src/features/subtitle/logic/iframeManagerBridgeTypes.test.ts` | T7 | NEW |
| `src/features/subtitle/logic/managerStateSerializer.test.ts` | T8 | NEW |
| `src/features/subtitle/logic/iframeManagerBridgeChild.test.ts` | T9 | NEW |
| `src/features/subtitle/ui/HostManagerSheet.test.tsx` | T10 | NEW |
| `src/features/subtitle/ui/SubtitlePanels.tsx` | T11 | EXISTING — sole editor |
| `src/entrypoints/content/content-script.ts` | T12 | EXISTING — sole editor |
| `src/features/subtitle/logic/iframePlayerModeBridge.ts` | T13 | EXISTING — sole editor (revert expand) |
| `docs/2-architechture-system.md` | T14 | EXISTING — sole editor |
| `docs/0-wiki.md` | T15 | EXISTING — sole editor |

## Dependency Graph + Waves

```
Wave 1 (4 parallel — no deps):
  T1: types          T6: CSS
  T13: revert expand  T14: arch doc (stub)

Wave 2 (5 parallel — depend on T1):
  T2: serializer     T3: child bridge
  T4: host bridge    T5: host sheet component
  T15: wiki update

Wave 3 (4 parallel — depend on wave 2):
  T7: types test     T8: serializer test
  T9: child bridge test  T10: host sheet test

Wave 4 (2 parallel — depend on wave 2+3):
  T11: SubtitlePanels integration (needs T2+T3)
  T12: contentScript install (needs T4+T5)

Wave 5 (1 — final):
  T16: build + verify all
```

Max parallel: **5** (wave 2). Total: **16 tasks**.

## Checkpoints

### Checkpoint A: After Wave 1+2 (types + modules)
- [ ] `npm run build` pass (all new files compile)
- [ ] Types export đúng, serializer round-trip OK
- [ ] Bridge functions no-op when !isChildFrame

### Checkpoint B: After Wave 3 (tests)
- [ ] `npm run test:unit` pass
- [ ] All new modules have co-located tests

### Checkpoint C: After Wave 4 (integration)
- [ ] `npm run build` pass
- [ ] SubtitlePanels correctly skips portal when managerOpenOnHost
- [ ] contentScript installs host bridge

### Checkpoint D: After Wave 5 (verify)
- [ ] animekai.be mobile: sheet trên host page, 25% top visible
- [ ] animekai.be desktop: manager overlay video (unchanged)
- [ ] Same-origin: manager render bình thường (unchanged)

## Risks
| Risk | Impact | Mitigation |
|------|--------|------------|
| T11 (SubtitlePanels) là task lớn nhất | Med | AC rõ ràng, chia nhỏ trong task |
| T5 (HostManagerSheet) cần reuse SubtitleManagerPanel props | Med | T5 import types từ T1, props match |
| T13 revert expand có thể break build tạm thời | Low | T13 chạy wave 1, build lại ở checkpoint A |
