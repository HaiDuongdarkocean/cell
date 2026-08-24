# TODO: OCR Split Dual-Stream implementation

> Checklist theo `tasks/plan.ocr-split-dual-stream.md`. Đánh dấu [x] khi task AC pass đầy đủ.

## Đợt 1 — Foundation (song song)
- [ ] T1: paddleOcrLanguages catalog + OcrOriginState split fields + OcrLanguageMode derive — AC: jest paddleOcrLanguages pass, typecheck pass
- [ ] T2: splitRegion.ts (computeSplitHalves) + ocrToCues.ts (ocrTextToCues + flicker merge) — AC: jest pass, flicker no-overlap

## Checkpoint 1
- [ ] `npx jest paddleOcrLanguages splitRegion ocrToCues --selectProjects unit` pass
- [ ] `npm run typecheck` pass

## Đợt 2 — Song song (file rời nhau)
- [ ] T3: runPipelineStep explicit region param — AC: ocrPipeline tests pass + no regression
- [ ] T4: paddleOcrEngine model resolution (default bundled, non-default auto) — AC: typecheck + engine tests pass
- [ ] T5: messaging engineKey (ocrRunner Map + LRU + background forward + OcrController) — AC: backward compat engineKey 'ch'
- [ ] T6: RegionSelector split UI (divider view-mode, node-reuse, persist on mouseup) — AC: regionSelector tests pass
- [ ] T8: OcrSettingsPanel 106-lang ×2 + reset + split section — AC: panel tests pass

## Checkpoint 2
- [ ] `npm run typecheck` pass
- [ ] Scoped jest: ocrPipeline, paddleOcrEngine, ocrController, regionSelector, OcrSettingsPanel — pass

## Đợt 3 — Tích hợp
- [ ] T7: OcrSession dual-stream + pipeline states per stream + low-RAM gate + virtual tracks bridge + contentScriptController slots + subtitlePanelModel 'ocr' — AC: FULL gates pass (typecheck + test:unit + build)

## Checkpoint 3 — Verify
- [ ] Verify subagent: checklist AC từng task + spec Success Criteria (unit/build phần)
- [ ] Main agent: browser tests (stealth MCP) spec §Browser tests 1-10
- [ ] Commit theo đợt (fix/feat atomic)
