// lookupLogTypes — schema cho dev-only lookup logging.
//
// Mục đích: capture toàn bộ flow phrase-matching (input → tokenization →
// candidate collection → per-candidate match states → ranking → final output)
// để phân tích vì sao thuật toán chọn candidate đó, từ đó improve accuracy.
//
// Gate bằng isDevMode (src/shared/lib/env/devMode.ts). Production = no-op,
// 0 byte bundle impact (tree-shake).
//
// Workflow:
//   1. Anh yêu duyệt web, click/hover từ → mỗi lookup sinh 1 LookupLogEntry
//      → chrome.storage.local (ring buffer 500 entry).
//   2. Export log qua DevTools console (1 dòng) → paste JSON cho em.
//   3. Em phân tích: so sánh winner vs runner-up, đọc nodesStructure phát hiện
//      parser bug, đọc state.slotUsed/fixedMatched phát hiện slot lỏng.
//   4. Anh yêu annotate analysis (AC term, winnerCorrect, rootCause) → em truy
//      ngược root cause + đề xuất fix + regression test.

/** Token sau khi tokenize (mirror SentenceToken nhưng flat cho serialize). */
export interface LogToken {
  readonly text: string;
  readonly raw: string;
  readonly start: number;
  readonly end: number;
}

/** Input: Anh yêu click gì. */
export interface LogRequest {
  readonly term: string;
  readonly langCode: string;
  readonly contextSentence: string;
  readonly cursorOffset: number;
  readonly fallback: boolean;
}

/** Trace per-candidate match (mỗi template match ra gì tại cursor). */
export interface CandidateMatchTrace {
  readonly templateId: number;
  readonly sourceTerm: string;
  readonly normalizedTerm: string;
  /** Human-readable AST: "literal(make) + alt([slot(person,2)], [literal(out)])". */
  readonly nodesStructure: string;
  readonly startTokenIndex: number;
  readonly endTokenIndex: number;
  readonly state: {
    readonly inflected: boolean;
    readonly possessive: boolean;
    readonly slotUsed: boolean;
    readonly fixedMatched: number;
  };
  readonly quality: 'fixed' | 'inflected' | 'possessive-template' | 'slot-template';
  /** Lý do reject nếu bị loại ("object-slot min literals"), null nếu accepted. */
  readonly rejected: string | null;
  readonly rankingTuple: {
    readonly qualityRank: number;
    readonly fixedTokenCount: number;
    readonly fixedMatched: number;
    readonly spanLen: number;
    readonly slotUsed: boolean;
    readonly frequencyRank: number;
    readonly templateId: number;
  };
}

/** Candidate sau sort, descending (rank 0 = winner). */
export interface RankedCandidateTrace {
  readonly rank: number;
  readonly dictionaryTerm: string;
  readonly surface: string;
  readonly quality: CandidateMatchTrace['quality'];
  readonly resourceId: number;
  readonly rankingTuple: CandidateMatchTrace['rankingTuple'];
}

/** Trace toàn bộ phrase match cho 1 lookup (EN only). */
export interface PhraseMatchTrace {
  readonly resourcesScanned: ReadonlyArray<{ readonly resourceId: number; readonly termCount: number }>;
  readonly candidateTemplateIds: readonly number[];
  /** token → templateIds mà token đó hit anchor postings. */
  readonly anchorHits: Readonly<Record<string, readonly number[]>>;
  readonly perCandidate: readonly CandidateMatchTrace[];
  readonly ranked: readonly RankedCandidateTrace[];
  readonly winner: {
    readonly dictionaryTerm: string;
    readonly surface: string;
    readonly resourceId: number;
    /** Human-readable: vì sao winner thắng runner-up ("quality (slot-template < fixed)"). */
    readonly beatRunnerUpBy: string;
  };
}

/** Final output: popup nhận gì. */
export interface LogResultEntry {
  readonly term: string;
  readonly detectedPhrase: {
    readonly dictionaryTerm: string;
    readonly surface: string;
    readonly quality: string;
    readonly sourceResourceId: number;
  } | null;
  readonly matchSource: string;
  readonly hasDefinitions: boolean;
}

/** Anh yêu annotate sau khi copy log cho em phân tích. */
export interface LogAnalysis {
  /** Actual Correct — phrase/surface nên match. */
  readonly acTerm: string;
  readonly acSurface: string;
  /** Thuật toán chọn đúng không. */
  readonly winnerCorrect: boolean;
  readonly rootCause: 'parser' | 'matcher' | 'ranking' | 'slot-validation' | 'data' | 'correct';
  readonly notes: string;
}

/** Một lookup log entry hoàn chỉnh. */
export interface LookupLogEntry {
  readonly id: string;
  readonly timestamp: number;
  readonly request: LogRequest;
  readonly tokens: readonly LogToken[];
  readonly targetTokenIndex: number;
  readonly surfaceTerm: string;
  readonly phraseMatch?: PhraseMatchTrace;
  readonly results: readonly LogResultEntry[];
  readonly analysis?: LogAnalysis;
}

/** Trace data mà matchPhraseAll truyền ra qua traceSink callback. */
export interface MatchTraceData {
  readonly resourcesScanned: ReadonlyArray<{ readonly resourceId: number; readonly termCount: number }>;
  readonly candidateTemplateIds: readonly number[];
  readonly anchorHits: Readonly<Record<string, readonly number[]>>;
  readonly perCandidate: readonly CandidateMatchTrace[];
  /** Sorted descending (rank 0 = winner), trước dedup by dictionaryTerm. */
  readonly ranked: readonly RankedCandidateTrace[];
}
