# ADR-004: Layered Clean Architecture (domain/application/infrastructure/presentation)

## Status
Accepted

## Context
Cell hiện tại `lib/` trộn domain types, infrastructure (OPFS, chrome.storage), và utils. Khi thêm 18 features mới (dict, vocab, flashcard, SRS, Anki), code sẽ trở thành "big ball of mud" nếu không phân layer.

## Decision
Refactor dần sang 4-layer Clean Architecture:
```
src/
  domain/           # Pure types, entities, ZERO dependency
    word/           # WordEntry, WordStatus, Wordbook
    card/           # CardData, MiningItem, Deck
    dict/           # DictEntry, DictSource
    subtitle/       # Cue, SubtitleTrack
    srs/            # FSRSState, ReviewLog
  application/      # Use cases + port interfaces (abstract)
    word/
      ports/IWordRepository.ts
      use-cases/LookupWordUseCase.ts
      use-cases/SaveWordUseCase.ts
    dict/
      ports/IDictRepository.ts
      use-cases/ImportDictUseCase.ts
    mining/
      ports/ICardBuilder.ts
      use-cases/MineCardUseCase.ts
    anki/
      ports/IAnkiExporter.ts
      use-cases/ExportAnkiUseCase.ts
    srs/
      ports/ISrsEngine.ts
      use-cases/ReviewCardUseCase.ts
  infrastructure/   # Chrome APIs, IndexedDB, HTTP, dict loader
    word/IndexedDBWordRepository.ts
    dict/SQLiteDictRepository.ts
    dict/YomitanDictImporter.ts
    anki/AnkiConnectExporter.ts
    anki/ApkgExporter.ts
    srs/FsrsEngine.ts
    storage/DexieDB.ts
    storage/ChromeStorageAdapter.ts
  presentation/     # React components + hooks
    popup/          # existing popup
    overlay/        # new: word popup, highlight overlay
    wordbook/       # new: vocabulary manager UI
    mining/         # new: flashcard creator UI
    srs/            # new: SRS review UI
    settings/       # new: settings dialog (extend)
  entrypoints/      # Composition root
    background/index.ts
    content/content-script.ts
    popup/main.tsx
    offscreen/ffmpeg.html
```

## Consequences
- (+) Test use cases không cần browser (mock ports)
- (+) Swap IndexedDB → SQLite WASM mà không sửa use case
- (+) Thêm cloud sync = thêm adapter, không sửa domain
- (-) Verbosity ban đầu (nhiều file interface)
- (-) Learning curve cho team

## Alternatives
- Giữ `lib/` flat → rejected: không scale cho 18 features
- Microservices → rejected: extension là 1 process, không phù hợp

## Source
dev.to/ievgen_ch (#15), bespoyasov.me (#16), bazaglia.com (#17), softwarepatternslexicon.com (#20)
