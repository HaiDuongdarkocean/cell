import { handleFileDrop } from './subtitleDragDrop';
import type { OverlayConfig, ParseResult } from '../types/subtitle';

/**
 * Create import button appended to video parent (top-right corner).
 * Button triggers hidden file input on click.
 *
 * @param video - Target video element
 * @param config - Overlay configuration (for consistent styling)
 * @returns Button element
 */
export function createImportButton(video: HTMLVideoElement, _config: OverlayConfig): HTMLButtonElement {
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

  // Position: top-right of video
  label.style.position = 'absolute';
  label.style.top = '8px';
  label.style.right = '8px';
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

  video.parentElement?.appendChild(label);
  return label;
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
