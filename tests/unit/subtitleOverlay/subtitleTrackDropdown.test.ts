import { createTrackDropdown, updateTrackOptions } from '../../../src/content/subtitleTrackDropdown';
import type { SrtCue } from '../../../src/types/media';

interface TrackOption {
  readonly id: string;
  readonly label: string;
  readonly cues: SrtCue[];
}

describe('subtitleTrackDropdown', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('createTrackDropdown', () => {
    it('should create select element with data-testid', () => {
      const dropdown = createTrackDropdown(container);
      expect(dropdown.tagName).toBe('SELECT');
      expect(dropdown.getAttribute('data-testid')).toBe('subtitle-track-dropdown');
      expect(container.contains(dropdown)).toBe(true);
    });

    it('should be hidden initially when no options', () => {
      const dropdown = createTrackDropdown(container);
      expect(dropdown.style.display).toBe('none');
    });
  });

  describe('updateTrackOptions', () => {
    it('should populate options and show dropdown', () => {
      const dropdown = createTrackDropdown(container);
      const tracks: TrackOption[] = [
        { id: 'en-1', label: 'English (auto)', cues: [] },
        { id: 'en-2', label: 'English (manual)', cues: [] },
      ];
      updateTrackOptions(dropdown, tracks);
      expect(dropdown.style.display).toBe('block');
      expect(dropdown.options.length).toBe(2);
      expect(dropdown.options[0].text).toBe('English (auto)');
      expect(dropdown.options[1].text).toBe('English (manual)');
    });

    it('should hide dropdown when tracks is empty', () => {
      const dropdown = createTrackDropdown(container);
      updateTrackOptions(dropdown, []);
      expect(dropdown.style.display).toBe('none');
      expect(dropdown.options.length).toBe(0);
    });

    it('should select first option by default', () => {
      const dropdown = createTrackDropdown(container);
      const tracks: TrackOption[] = [
        { id: 'en-1', label: 'English', cues: [] },
        { id: 'en-2', label: 'English 2', cues: [] },
      ];
      updateTrackOptions(dropdown, tracks);
      expect(dropdown.selectedIndex).toBe(0);
    });
  });
});
