import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';
import { AiBridgeSection } from './AiBridgeSection';
import { DEFAULT_AI_BRIDGE_SETTINGS } from '@/shared/config/config';

function renderSection(onChange = jest.fn()) {
  return { onChange, ...render(<AiBridgeSection settings={DEFAULT_AI_BRIDGE_SETTINGS} onChange={onChange} />) };
}

describe('AiBridgeSection', () => {
  it('renders provider default, order slots, engine and auto-open controls', () => {
    renderSection();
    expect(screen.getByTestId('ai-default-provider')).toBeInTheDocument();
    expect(screen.getByTestId('ai-provider-order').children).toHaveLength(4);
    expect(screen.getByTestId('ai-translate-engine')).toBeInTheDocument();
  });

  it('blocks save and shows the error on an unknown placeholder', () => {
    renderSection();
    fireEvent.change(screen.getByTestId('ai-prompt-system-wordExplain'), {
      target: { value: 'explain [CONTEXT] please' },
    });
    expect(screen.getByTestId('ai-prompt-error-wordExplain')).toBeInTheDocument();
    expect(screen.getByTestId('ai-prompt-save-wordExplain')).toBeDisabled();
  });

  it('saves a valid prompt edit through onChange without touching other features', () => {
    const { onChange } = renderSection();
    fireEvent.change(screen.getByTestId('ai-prompt-system-wordExplain'), {
      target: { value: 'explain [WORD] in [INTERFACE_LANG]' },
    });
    fireEvent.click(screen.getByTestId('ai-prompt-save-wordExplain'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      prompts: expect.objectContaining({
        wordExplain: { system: 'explain [WORD] in [INTERFACE_LANG]', user: DEFAULT_AI_BRIDGE_SETTINGS.prompts.wordExplain.user },
        sentenceBreakdown: DEFAULT_AI_BRIDGE_SETTINGS.prompts.sentenceBreakdown,
      }),
    }));
  });

  it('reset restores the default prompt text', () => {
    renderSection();
    const sys = screen.getByTestId('ai-prompt-system-wordExplain') as HTMLTextAreaElement;
    fireEvent.change(sys, { target: { value: 'custom stuff' } });
    fireEvent.click(screen.getByTestId('ai-prompt-reset-wordExplain'));
    expect((screen.getByTestId('ai-prompt-system-wordExplain') as HTMLTextAreaElement).value)
      .toBe(DEFAULT_AI_BRIDGE_SETTINGS.prompts.wordExplain.system);
  });
});
