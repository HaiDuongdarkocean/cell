import type { SrtCue } from '@/entities/media';

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
  dropdown.className = 'subtitle-track-dropdown';

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
    dropdown.classList.remove('subtitle-track-dropdown--visible');
    return;
  }

  for (const track of tracks) {
    const option = document.createElement('option');
    option.value = track.id;
    option.textContent = track.label;
    dropdown.appendChild(option);
  }

  dropdown.selectedIndex = 0;
  dropdown.classList.add('subtitle-track-dropdown--visible');
}
