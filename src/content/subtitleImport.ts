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
  const button = document.createElement('button');
  button.setAttribute('data-testid', 'subtitle-import-button');
  button.textContent = 'Import Subtitle';

  // Position: top-right of video
  button.style.position = 'absolute';
  button.style.top = '8px';
  button.style.right = '8px';
  button.style.zIndex = '999999';
  button.style.padding = '4px 8px';
  button.style.fontSize = '12px';
  button.style.cursor = 'pointer';
  button.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  button.style.color = '#ffffff';
  button.style.border = 'none';
  button.style.borderRadius = '4px';

  video.parentElement?.appendChild(button);
  return button;
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
