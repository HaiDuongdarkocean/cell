# Project Context — Cell

> Context không thay đổi giữa các feature. Skill `elicitation` load file này đầu tiên.
> Update khi user nói khác. Không tự sửa mà chưa confirm.
> Tham chiếu: `AGENTS.md` (conventions), `docs/1-share-language.md` (glossary), `docs/2-architechture-system.md` (architecture).

## Persona

- Người dùng từ 5 tuổi → 80 tuổi
- Mọi ngành nghề → yêu thích học ngoại ngữ
- Persona nhiều nhất: 10-25 tuổi

## Platform

- Chrome, Edge, Brave (cross-browser)
- Desktop, tablet, Android
- MV3 extension

## Constraints

- RAM ≥1GB available
- Response <3s
- Responsive UI (desktop + tablet + Android)
- Algorithm complexity: O(1) → O(log n) lý tưởng, O(n) tối đa, cấm O(n log n) → O(n²)

## Domain glossary

Tham chiếu `docs/1-share-language.md` — bridge giữa human language và system language.

## Design system

- Tokens: `src/shared/styles/tokens.json` (SSOT) → `tokens.css`/`tokens.ts` (generated, KHÔNG tự sửa)
- Components: `import { Button, Card } from '@/shared/ui/'` — không tự tạo
- Icons: `src/shared/icons/index.ts` (ICON_CATALOG) — đọc trước khi tạo mới
- Đọc `src/shared/styles/README.md` trước khi viết CSS

## Existing specs

Tham chiếu `docs/specs/`:
- `fnc_tts.md` — local offline TTS
- `local-video-player.md` — local video player
- `manager-host-sheet-bridge.md` — Subtitle Manager Mobile Sheet
- `ocr-split-dual-stream.md` — OCR split dual stream
- `orca-ocr-layer.md` — OCR layer (PaddleOCR.js PP-OCRv5)
- `profile-language.md` — profile language
- `reader.md` — Reader feature
- `reader-requirements.md` — Reader requirements
- `subtitle-appearance-in-manager.md` — subtitle appearance customization
- `subtitle-list-discovery-e2e.md` — subtitle list discovery E2E
- `subtitle-panels-atom-decomposition.md` — SubtitlePanels atom decomposition
- `subtitle-search.md` — subtitle search (SubDL + OpenSubtitles)
- `subtitle-search-test-plan.md` — subtitle search test plan

## Architecture

Tham chiếu `docs/2-architechture-system.md` — tree + dependency + function index.
