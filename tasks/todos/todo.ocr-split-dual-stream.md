# TODO: OCR Split Dual-Stream implementation

> Checklist theo `tasks/plan.ocr-split-dual-stream.md`. Đánh dấu [x] khi task AC pass đầy đủ.

## Đợt 1 — Foundation (song song)
- [x] T1: paddleOcrLanguages catalog + OcrOriginState split fields + OcrLanguageMode derive — AC: jest paddleOcrLanguages pass, typecheck pass
- [x] T2: splitRegion.ts (computeSplitHalves) + ocrToCues.ts (ocrTextToCues + flicker merge) — AC: jest pass, flicker no-overlap

## Checkpoint 1
- [x] `npx jest paddleOcrLanguages splitRegion ocrToCues --selectProjects unit` pass
- [x] `npm run typecheck` pass

## Đợt 2 — Song song (file rời nhau)
- [x] T3: runPipelineStep explicit region param — AC: ocrPipeline tests pass + no regression
- [x] T4: paddleOcrEngine model resolution (default bundled, non-default auto) — AC: typecheck + engine tests pass
- [x] T5: messaging engineKey (ocrRunner Map + LRU + background forward + OcrController) — AC: backward compat engineKey 'ch'
- [x] T6: RegionSelector split UI (divider view-mode, node-reuse, persist on mouseup) — AC: regionSelector tests pass
- [x] T8: OcrSettingsPanel 106-lang ×2 + reset + split section — AC: panel tests pass

## Checkpoint 2
- [x] `npm run typecheck` pass
- [x] Scoped jest: ocrPipeline, paddleOcrEngine, ocrController, regionSelector, OcrSettingsPanel — pass

## Đợt 3 — Tích hợp
- [x] T7: OcrSession dual-stream + pipeline states per stream + low-RAM gate + virtual tracks bridge + contentScriptController slots + subtitlePanelModel 'ocr' — AC: FULL gates pass (typecheck + test:unit + build)

## Checkpoint 3 — Verify
- [x] Verify (main agent): full `tsc`, `test:unit`, `build`, `lint` pass; code matches `plan.ocr-split-dual-stream.md` ACs.
- [ ] Browser tests (stealth MCP) spec §Browser tests 1-10 — cần MCP/môi trường browser để chạy.
- [ ] Commit theo đợt: không có diff code mới trong đợt verify này; commit sẽ chỉ chứa cập nhật todo nếu cần.
