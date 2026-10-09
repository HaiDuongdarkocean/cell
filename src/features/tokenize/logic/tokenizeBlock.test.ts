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

  it('skips text inside form controls and buttons', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>Normal text <a href="#">link text</a> <button>click</button> <span role="button">Reply</span> <input value="text"></p>';
    const blocks = findTextBlocks(root);
    expect(blocks.map((b) => b.originalText)).toEqual(['Normal text ', 'link text']);
  });

  it('skips text inside aria-hidden subtrees (composer placeholders, assistive duplicates)', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>Visible text</p><div aria-hidden="true"><span>Hidden placeholder</span></div><p><span aria-hidden="true">Assistive copy</span>Real words</p>';
    const blocks = findTextBlocks(root);
    expect(blocks.map((b) => b.originalText)).toEqual(['Visible text', 'Real words']);
  });

  it('tokenizes code — inline code, code blocks and their semantic cousins', () => {
    const root = document.createElement('div');
    root.innerHTML =
      '<p>Call <code>printf()</code> first.</p>' +
      '<pre><code>int main() {\n  return 0;\n}</code></pre>' +
      '<p><kbd>Ctrl</kbd> <samp>output</samp> <var>value</var></p>';
    const blocks = findTextBlocks(root);
    expect(blocks.map((b) => b.originalText)).toEqual([
      'Call ',
      'printf()',
      ' first.',
      'int main() {\n  return 0;\n}',
      'Ctrl',
      'output',
      'value',
    ]);
  });

  it('tokenizes label text (radio options, dropdown faces)', () => {
    const root = document.createElement('div');
    root.innerHTML = '<form><label><input type="radio">Small</label><label for="x">Standard</label><input id="x" type="radio"></form>';
    const blocks = findTextBlocks(root);
    expect(blocks.map((b) => b.originalText)).toEqual(['Small', 'Standard']);
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

  it('skips native subtitle-line elements but tokenizes target subtitle-line elements', () => {
    const root = document.createElement('div');
    root.innerHTML = '<div class="subtitle-block"><div class="subtitle-line target">Hello world.</div><div class="subtitle-line native">Xin chào.</div></div>';
    const blocks = findTextBlocks(root);
    expect(blocks.map((b) => b.originalText)).toEqual(['Hello world.']);
  });
});
