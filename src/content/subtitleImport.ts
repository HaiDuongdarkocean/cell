import { handleFileDrop } from './subtitleDragDrop';
import { detectLanguage, labelToIsoCode } from '@/lib/detectors/languageDetector';
import type { OverlayConfig, ParseResult, SubtitleFormat } from '../types/subtitle';
import type { SrtCue } from '../types/media';

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
    if (iso && iso.toLowerCase() === targetIso) {
      target.push(f);
    } else if (iso && iso.toLowerCase() === nativeIso) {
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

/**
 * Create import button appended to video parent (top-right corner).
 * Button triggers hidden file input on click.
 *
 * @param video - Target video element
 * @param config - Overlay configuration (for consistent styling)
 * @returns Button element
 */
export function createImportButton(container: HTMLElement, _config: OverlayConfig): HTMLButtonElement {
  // ponytail: use <label> wrapping <input type=file> — native HTML, click label
  // = click input = file picker opens. <button> swallows input click (invalid HTML),
  // <div> works but <label> is semantic + accessible + guaranteed.
  // Source: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/label
  const label = document.createElement('label') as unknown as HTMLButtonElement;
  label.setAttribute('role', 'button');
  label.setAttribute('tabindex', '0');
  label.setAttribute('aria-label', 'Import subtitle file');
  label.setAttribute('data-testid', 'subtitle-import-button');

  const text = document.createElement('span');
  text.textContent = 'Import Subtitle';
  label.appendChild(text);

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

  // Position: top-left of video area (toggle button occupies top-right)
  label.style.position = 'absolute';
  label.style.top = '8px';
  label.style.left = '8px';
  label.style.zIndex = '999999';
  label.style.padding = '4px 8px';
  label.style.fontSize = '12px';
  label.style.cursor = 'pointer';
  label.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  label.style.color = '#ffffff';
  label.style.border = 'none';
  label.style.borderRadius = '4px';
  label.style.transition = 'background-color 0.2s';
  label.style.userSelect = 'none';

  // Hover effect
  label.addEventListener('mouseenter', () => {
    label.style.backgroundColor = 'rgba(0, 150, 255, 0.8)';
  });
  label.addEventListener('mouseleave', () => {
    label.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  });

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
  const results: ParsedFile[] = [];
  for (const file of files) {
    const parseResult = await handleFileDrop(file);
    if (!parseResult.success || parseResult.cues.length === 0) continue;
    const detectedLang = detectLanguage(
      parseResult.cues.map((c) => c.text).join('\n'),
      parseResult.format,
    );
    results.push({
      file,
      detectedLang: detectedLang?.toLowerCase() ?? '',
      cues: parseResult.cues,
      format: parseResult.format,
    });
  }
  return results;
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
