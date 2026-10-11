import { startTextScoreSource } from './textScoreSource';
import { startTokenScoreSource, type TokenScoreSourceDeps } from './tokenScoreSource';
import type { TokenBlock } from '@/features/tokenize/types';
import type { Token } from '@/features/tokenize/types';

jest.mock('./tokenScoreSource', () => ({
  startTokenScoreSource: jest.fn(() => () => {}),
}));

const mockedStart = jest.mocked(startTokenScoreSource);

function makeBlock(
  originalText: string,
  tokens: Token[] | undefined,
  connected = true,
): TokenBlock {
  return {
    id: `b-${originalText}`,
    element: { isConnected: connected } as Element,
    sourceNodes: [],
    originalText,
    tokens,
    isBound: false,
    lastAccessedAt: 0,
  };
}

function makeToken(term: string): Token {
  return { term, text: term, start: 0, end: term.length, isSeparator: false } as Token;
}

function sourceDeps(): TokenScoreSourceDeps<TokenBlock[]> {
  const blocks: TokenBlock[] = [];
  let deps: TokenScoreSourceDeps<TokenBlock[]> | null = null;
  mockedStart.mockImplementationOnce((d) => {
    deps = d as TokenScoreSourceDeps<TokenBlock[]>;
    return () => {};
  });
  startTextScoreSource({
    controller: {
      getBlocks: () => blocks,
      subscribe: () => () => {},
      getState: () => ({ enabled: true }),
    } as never,
    store: { setStats: jest.fn() } as never,
    langCode: 'en',
    onBlocksChanged: () => () => {},
  });
  if (!deps) throw new Error('startTokenScoreSource was not invoked');
  return deps;
}

describe('textScoreSource', () => {
  beforeEach(() => mockedStart.mockReset());

  it('tokenize yields only prepared tokens from connected blocks', () => {
    const deps = sourceDeps();
    const prepared = [makeToken('hello')];
    const blocks = [
      makeBlock('prepared block', prepared),
      makeBlock('unprepared block', undefined),
      makeBlock('detached block', [makeToken('ghost')], false),
    ];

    expect(deps.tokenize(blocks, 'en')).toEqual(prepared);
  });

  it('signature is stable across calls and changes on prepare, edit, or detach', () => {
    const deps = sourceDeps();
    const element = { isConnected: true } as Element;
    const a: TokenBlock = {
      id: 'a',
      element,
      sourceNodes: [],
      originalText: 'hello world',
      tokens: undefined,
      isBound: false,
      lastAccessedAt: 0,
    };
    const b = makeBlock('other text', [makeToken('x')]);

    const first = deps.signature([a, b]);
    expect(deps.signature([a, b])).toBe(first);
    expect(deps.signature([{ ...a }, b])).toBe(first);

    a.originalText = 'hello world!';
    expect(deps.signature([a, b])).not.toBe(first);

    a.originalText = 'hello world';
    a.tokens = [makeToken('hello')];
    expect(deps.signature([a, b])).not.toBe(first);

    (element as { isConnected: boolean }).isConnected = false;
    expect(deps.signature([a, b])).not.toBe(first);
    expect(deps.signature([a])).toBe('');
  });
});
