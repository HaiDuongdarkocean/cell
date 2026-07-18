import { handleFileDrop } from './subtitleDragDrop';
import { detectLanguageFromText, labelToIsoCode } from '@/features/detection/logic/languageDetector';
import { languageMatches } from '@/shared/config/languageRegistry';
import type { OverlayConfig, ParseResult, SubtitleFormat } from '@/entities/subtitle';
import type { SrtCue } from '@/entities/media';

/**
 * Parsed subtitle file with detected language (ADR-015 — multi-file import).
 * `detectedLang` is a lowercase label from `detectLanguage` (e.g. "english"),
 * NOT an ISO code. `assignImportRole` converts via `labelToIsoCode`.
 */
export interface ParsedFile {
  readonly file: File;
  readonly detectedLang: string; // lowercase label from detectLanguage, '' if detection failed
  readonly cues: SrtCue[];
  readonly format: SubtitleFormat;
}

/**
 * Result of multi-file import role assignment (ADR-015).
 * - `target`: files whose detected language matches targetLang (ISO).
 * - `native`: files whose detected language matches nativeLang (ISO).
 * - `ignored`: files whose detected language matches neither.
 *
 * Fallback (spec Assumption #5): if `target` is empty and `ignored` is
 * non-empty, the first ignored file is promoted to `target` so the user
 * always gets at least one target subtitle from an import.
 */
export interface ImportRoleAssignment {
  readonly target: ParsedFile[];
  readonly native: ParsedFile[];
  readonly ignored: ParsedFile[];
}

/**
 * Assign import roles (target / native / ignored) by detected language.
 *
 * Pure function — converts `detectLanguage` label → ISO via `labelToIsoCode`
 * before comparing with `targetLang` / `nativeLang` (which are ISO codes).
 * Case-insensitive comparison. 2 files same lang → both in the same section
 * (spec C7). Neither-lang → ignored, with fallback-to-target when target
 * is empty (spec Assumption #5).
 *
 * @param files - Parsed files with detected language labels
 * @param targetLang - Target language ISO 639-1 code (e.g. 'en')
 * @param nativeLang - Native language ISO 639-1 code (e.g. 'ar')
 */
export function assignImportRole(
  files: readonly ParsedFile[],
  targetLang: string,
  nativeLang: string,
): ImportRoleAssignment {
  const target: ParsedFile[] = [];
  const native: ParsedFile[] = [];
  const ignored: ParsedFile[] = [];
  const targetIso = targetLang.toLowerCase();
  const nativeIso = nativeLang.toLowerCase();

  for (const f of files) {
    const iso = f.detectedLang ? labelToIsoCode(f.detectedLang) : null;
    if (iso && languageMatches(targetIso, iso)) {
      target.push(f);
    } else if (iso && languageMatches(nativeIso, iso)) {
      native.push(f);
    } else {
      ignored.push(f);
    }
  }

  // Fallback (spec Assumption #5): if no target matched but we have ignored
  // files, promote the first ignored to target so the user gets a subtitle.
  if (target.length === 0 && ignored.length > 0) {
    target.push(ignored.shift()!);
  }

  return { target, native, ignored };
}

const UPLOAD_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width:65% !important;height:65% !important;display:block;fill:none !important;opacity:1 !important;filter:none !important"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="17" x2="12" y2="11"/><polyline points="9 14 12 11 15 14"/></svg>`;

/**
 * Create icon-only import button for the top-left toolbar (ADR-015 UI v4).
 * DS §2 Icon Button: 40×40, --radius-full, no border at rest, no shadow.
 * Hidden file input inside triggers native picker.
 *
 * @param container - Video wrapper (button appended here, then moved into toolbar by panel)
 * @param _config - Overlay configuration (unused, kept for API compat)
 * @returns Label element (styled as button, wraps file input for native picker)
 */
export function createImportButton(container: HTMLElement, _config: OverlayConfig): HTMLElement {
  // ponytail: use <label> wrapping <input type=file> — native HTML, click label
  // = click input = file picker opens. <button> swallows input click (invalid HTML),
  // <label> is semantic + accessible + guaranteed.
  // Source: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/label
  const label = document.createElement('label');
  label.setAttribute('role', 'button');
  label.setAttribute('tabindex', '0');
  label.setAttribute('aria-label', 'Import subtitle file');
  label.setAttribute('title', 'Import subtitle file');
  label.setAttribute('data-testid', 'subtitle-import-button');
  label.style.cssText = `
    position: relative;
    overflow: hidden;
    width: var(--sb-btn-size, 40px);
    height: var(--sb-btn-size, 40px);
    /* Overlay appearance: no border, feathered backdrop, bg + text opacity from settings. */
    border: none;
    border-radius: var(--radius-full, 9999px);
    background: rgba(30, 41, 59, var(--sb-bg-opacity, 0.2));
    color: rgba(241, 245, 249, var(--sb-text-opacity, 1));
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    box-sizing: border-box;
    isolation: isolate;
    pointer-events: auto;
    user-select: none;
    transition: background var(--duration-fast, 150ms) ease, color var(--duration-fast, 150ms) ease, transform var(--duration-normal, 200ms) cubic-bezier(0.175, 0.885, 0.32, 1.275);
  `;
  label.style.setProperty('border', 'none', 'important');
  label.style.setProperty('opacity', '1', 'important');
  label.style.setProperty('filter', 'none', 'important');
  label.innerHTML = UPLOAD_SVG;
  // Feathered backdrop — span mở rộng + blur 1px + mask radial fade
  const labelFeather = document.createElement('span');
  labelFeather.style.cssText = `
    position: absolute;
    inset: -1.5px;
    border-radius: var(--radius-full, 9999px);
    backdrop-filter: blur(1px);
    -webkit-backdrop-filter: blur(1px);
    background: rgba(15, 23, 42, 0.1);
    -webkit-mask-image: radial-gradient(ellipse at center, black 55%, transparent 100%);
    mask-image: radial-gradient(ellipse at center, black 55%, transparent 100%);
    z-index: -1;
    transition: background var(--duration-fast, 150ms) ease;
    pointer-events: none;
  `;
  label.appendChild(labelFeather);

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.srt,.vtt,.ass,.ssa';
  fileInput.multiple = true; // ADR-015: multi-file import
  // ponytail: display:none prevents picker in some content-script contexts.
  // opacity:0 + absolute keeps input rendered (picker opens) but invisible.
  fileInput.style.position = 'absolute';
  fileInput.style.top = '0';
  fileInput.style.left = '0';
  fileInput.style.width = '100%';
  fileInput.style.height = '100%';
  fileInput.style.opacity = '0';
  fileInput.style.cursor = 'pointer';
  label.appendChild(fileInput);

  // Hover — icon đổi màu primary (no border feedback)
  label.addEventListener('mouseenter', () => {
    label.style.color = 'var(--color-primary)';
    labelFeather.style.background = 'rgba(15, 23, 42, 0.25)';
  });
  label.addEventListener('mouseleave', () => {
    label.style.color = 'rgba(241, 245, 249, var(--sb-text-opacity, 1))';
    labelFeather.style.background = 'rgba(15, 23, 42, 0.1)';
  });
  // Focus ring handled by CSS :focus-visible (WCAG 2.4.7) — no JS outline.

  container.appendChild(label);
  return label;
}

/**
 * Parse + detect language for multiple imported files (ADR-015).
 *
 * For each file: validate extension → read → parse → detect language label.
 * Files that fail parsing or have unsupported extensions are skipped (caller
 * should toast the count). Returns `ParsedFile[]` ready for `assignImportRole`.
 *
 * @param files - Selected/dropped File objects
 * @returns Array of parsed files with detected language labels
 */
export async function parseAndDetectFiles(files: readonly File[]): Promise<ParsedFile[]> {
  // ponytail: parallel parse + detect via Promise.all. Each file's parse
  // (FileReader I/O + sync parser) and detect (sync regex) are independent —
  // no shared state. Order preserved by Promise.all (map by index).
  // Ceiling: 50 files on a 4GB machine — FileReader + parser are I/O-bound,
  // not CPU-bound, so concurrent reads saturate disk throughput without
  // starving the main thread. detectLanguageFromText bypasses extractPlainText
  // (cues.text already stripSubtitleTags'd by parser → no double parse).
  const parsed = await Promise.all(
    files.map(async (file) => {
      const parseResult = await handleFileDrop(file);
      if (!parseResult.success || parseResult.cues.length === 0) return null;
      // cues.text is already clean (stripSubtitleTags ran in parser) — join
      // and detect directly, skipping extractPlainText's line-split + regex.
      const detectedLang = detectLanguageFromText(
        parseResult.cues.map((c) => c.text).join('\n'),
      );
      return {
        file,
        detectedLang: detectedLang?.toLowerCase() ?? '',
        cues: parseResult.cues,
        format: parseResult.format,
      } as ParsedFile;
    }),
  );
  return parsed.filter((p): p is ParsedFile => p !== null);
}

/**
 * Handle file selected from file picker.
 * Reuses handleFileDrop logic (same validation + parsing).
 *
 * @param file - Selected File object
 * @returns ParseResult with cues or error
 */
export async function handleFileSelect(file: File): Promise<ParseResult> {
  return handleFileDrop(file);
}
