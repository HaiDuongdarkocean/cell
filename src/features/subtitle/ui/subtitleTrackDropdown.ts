import type { SrtCue } from '@/types/media';

export interface TrackOption {
  readonly id: string;
  readonly label: string;
  readonly cues: SrtCue[];
}

/**
 * Create track dropdown <select> element for switching between multiple subtitle tracks.
 *
 * @param parent - Container element to append dropdown to
 * @returns Select element (hidden initially)
 */
export function createTrackDropdown(parent: HTMLElement): HTMLSelectElement {
  const dropdown = document.createElement('select');
  dropdown.setAttribute('data-testid', 'subtitle-track-dropdown');
  dropdown.style.position = 'absolute';
  dropdown.style.top = '8px';
  dropdown.style.left = '8px';
  dropdown.style.zIndex = '999999';
  dropdown.style.fontSize = '12px';
  dropdown.style.padding = '2px 4px';
  dropdown.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  dropdown.style.color = '#ffffff';
  dropdown.style.border = 'none';
  dropdown.style.borderRadius = '4px';
  dropdown.style.display = 'none';

  parent.appendChild(dropdown);
  return dropdown;
}

/**
 * Populate dropdown with track options and show it.
 * Clears existing options first. Auto-selects first track.
 *
 * @param dropdown - Select element
 * @param tracks - Available subtitle tracks
 */
export function updateTrackOptions(dropdown: HTMLSelectElement, tracks: TrackOption[]): void {
  dropdown.innerHTML = '';

  if (tracks.length === 0) {
    dropdown.style.display = 'none';
    return;
  }

  for (const track of tracks) {
    const option = document.createElement('option');
    option.value = track.id;
    option.textContent = track.label;
    dropdown.appendChild(option);
  }

  dropdown.selectedIndex = 0;
  dropdown.style.display = 'block';
}
