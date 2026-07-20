import { describe, expect, it } from '@jest/globals';
import { findTextBlocks } from './tokenizeBlock';

describe('findTextBlocks', () => {
  it('finds text blocks inside paragraphs', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>Hello world.</p><p>Another paragraph.</p>';
    const blocks = findTextBlocks(root);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]!.originalText).toBe('Hello world.');
    expect(blocks[1]!.originalText).toBe('Another paragraph.');
  });

  it('skips script and style content', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>Keep me.</p><script>var x = 1;</script><style>.x{}</style>';
    const blocks = findTextBlocks(root);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.originalText).toBe('Keep me.');
  });

  it('skips text inside form controls but tokenizes buttons', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>Normal text <a href="#">link text</a> <button>click</button> <input value="text"></p>';
    const blocks = findTextBlocks(root);
    expect(blocks.map((b) => b.originalText)).toEqual(['Normal text ', 'link text', 'click']);
  });

  it('tokenizes text inside <a role="link"> (Facebook-style redundant ARIA)', () => {
    // Facebook/Twitter add explicit role="link" to anchors; that must not
    // disable tokenize for content like names or article titles.
    const root = document.createElement('div');
    root.innerHTML = '<a href="/u/1" role="link" tabindex="0">Nguyễn Minh Phương</a>';
    const blocks = findTextBlocks(root);
    expect(blocks.map((b) => b.originalText)).toEqual(['Nguyễn Minh Phương']);
  });

  it('skips empty text nodes', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>   </p><p>Real text</p>';
    const blocks = findTextBlocks(root);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.originalText).toBe('Real text');
  });

  it('respects maxLength', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>Short.</p><p>This is a longer paragraph of text.</p>';
    const blocks = findTextBlocks(root, { maxLength: 15 });
    expect(blocks.map((b) => b.originalText)).toEqual(['Short.']);
  });
});
