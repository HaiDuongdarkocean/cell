import { describe, expect, it, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { PronunciationSettingsPanel } from './PronunciationSettingsPanel';
import type { PronunciationSettings } from '@/entities/settings/types';

function makeSettings(fallbackEngines: PronunciationSettings['fallbackEngines']): PronunciationSettings {
  return {
    fallbackEngines,
    downloadEspeakTtsData: false,
    localFile: {
      packageType: 'single',
      dslFileHandleId: null,
      audioArchiveHandleId: null,
      splitArchiveDirectoryHandleId: null,
      splitArchivePattern: '',
      lastIndexedAt: null,
    },
  };
}

describe('PronunciationSettingsPanel', () => {
  it('renders the fallback engine list', () => {
    const settings = makeSettings(['localFile', 'native', 'browserTts']);
    render(<PronunciationSettingsPanel settings={settings} onChange={jest.fn()} />);

    expect(screen.getByText('Local Forvo package')).toBeInTheDocument();
    expect(screen.getByText('Community audio (Wikimedia)')).toBeInTheDocument();
    expect(screen.getByText('Browser / Google TTS')).toBeInTheDocument();
  });

  it('moves an engine down when Down is clicked', () => {
    const settings = makeSettings(['localFile', 'native']);
    const onChange = jest.fn();
    render(<PronunciationSettingsPanel settings={settings} onChange={onChange} />);

    const downButtons = screen.getAllByRole('button', { name: /down/i });
    fireEvent.click(downButtons[0]!);

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      fallbackEngines: ['native', 'localFile'],
    }));
  });

  it('toggles the eSpeak TTS data download flag', () => {
    const settings = makeSettings(['browserTts']);
    const onChange = jest.fn();
    const { container } = render(<PronunciationSettingsPanel settings={settings} onChange={onChange} />);

    const toggle = container.querySelector('input[role="switch"]');
    expect(toggle).toBeInTheDocument();
    fireEvent.click(toggle!);

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      downloadEspeakTtsData: true,
    }));
  });
});
