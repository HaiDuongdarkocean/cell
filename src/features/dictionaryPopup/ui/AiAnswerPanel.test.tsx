import { describe, expect, it, jest } from '@jest/globals';
import { render, act } from '@testing-library/react';
import { AiAnswerPanel } from './AiAnswerPanel';
import type { AiAskState } from '../logic/useAiAsk';

const base = {
  providerOrder: ['gemini', 'claude'] as const,
  selectedProvider: 'gemini' as const,
  answerLanguage: 'native' as const,
  sourceLang: 'en',
  targetLang: 'vi',
  onPickProvider: jest.fn(),
  onPickLanguage: jest.fn(),
  onRetry: jest.fn(),
};

describe('AiAnswerPanel login guidance', () => {
  it('counts down the login redirect when a provider requires sign-in', async () => {
    jest.useFakeTimers();
    const state: AiAskState = {
      phase: 'error',
      feature: 'sentenceBreakdown',
      answer: null,
      provider: 'claude',
      failoverFrom: null,
      loginProviders: ['claude'],
      error: 'all_failed',
    };
    render(<AiAnswerPanel state={state} {...base} />);
    const err = () => document.querySelector('[data-tihoka-id="dictionary-ai-error"]')?.textContent;
    expect(err()).toContain('5');
    act(() => { jest.advanceTimersByTime(2_000); });
    expect(err()).toContain('3');
    act(() => { jest.advanceTimersByTime(3_000); });
    expect(err()).toContain('…');
    jest.useRealTimers();
  });

  it('renders a sign-in link per login-required provider', () => {
    const state: AiAskState = {
      phase: 'error',
      feature: 'wordExplain',
      answer: null,
      provider: 'chatgpt',
      failoverFrom: null,
      loginProviders: ['chatgpt'],
      error: 'all_failed',
    };
    render(<AiAnswerPanel state={state} {...base} />);
    expect(document.querySelector('[data-tihoka-id="dictionary-ai-login-link"]')?.textContent).toContain('ChatGPT');
  });
});
