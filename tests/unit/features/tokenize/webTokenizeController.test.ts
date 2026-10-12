import { createWebTokenizeController } from '@/features/tokenize/controller/webTokenizeController';

const flushMutations = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 50));

const LONG_TEXT =
  'This is a long paragraph of plain English text with enough words to be treated as a tokenizable text block by the scanner.';

describe('webTokenizeController block registry', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('removes and re-adds blocks without registry drift', async () => {
    const para = document.createElement('p');
    para.textContent = LONG_TEXT;
    document.body.appendChild(para);

    const controller = await createWebTokenizeController({ url: 'https://example.com/page' });
    controller.toggleEnabled();
    await flushMutations();

    const initial = controller.getBlocks().length;
    expect(initial).toBeGreaterThan(0);

    para.remove();
    await flushMutations();
    expect(controller.getBlocks().length).toBe(0);

    document.body.appendChild(para);
    await flushMutations();
    expect(controller.getBlocks().length).toBe(initial);

    controller.toggleEnabled();
    expect(controller.getBlocks().length).toBe(0);
  });

  it('sweeps blocks detached by a batch of removed nodes in one flush', async () => {
    const wrap = document.createElement('div');
    const paraA = document.createElement('p');
    paraA.textContent = LONG_TEXT;
    const paraB = document.createElement('p');
    paraB.textContent = LONG_TEXT;
    const paraC = document.createElement('p');
    paraC.textContent = LONG_TEXT;
    wrap.append(paraA, paraB, paraC);
    document.body.appendChild(wrap);

    const controller = await createWebTokenizeController({ url: 'https://example.com/page' });
    controller.toggleEnabled();
    await flushMutations();
    const initial = controller.getBlocks().length;
    expect(initial).toBeGreaterThanOrEqual(3);

    paraA.remove();
    paraB.remove();
    paraC.remove();
    await flushMutations();
    expect(controller.getBlocks().length).toBe(initial - 3);

    controller.toggleEnabled();
  });

  it('sweeps descendant blocks when an ancestor element is removed', async () => {
    const wrap = document.createElement('div');
    const para = document.createElement('p');
    para.textContent = LONG_TEXT;
    wrap.appendChild(para);
    document.body.appendChild(wrap);

    const controller = await createWebTokenizeController({ url: 'https://example.com/page' });
    controller.toggleEnabled();
    await flushMutations();
    expect(controller.getBlocks().length).toBeGreaterThan(0);

    wrap.remove();
    await flushMutations();
    expect(controller.getBlocks().length).toBe(0);

    controller.toggleEnabled();
  });

  it('keeps blocks whose element was removed and re-added in the same batch', async () => {
    const para = document.createElement('p');
    para.textContent = LONG_TEXT;
    document.body.appendChild(para);

    const controller = await createWebTokenizeController({ url: 'https://example.com/page' });
    controller.toggleEnabled();
    await flushMutations();
    const initial = controller.getBlocks().length;
    expect(initial).toBeGreaterThan(0);

    para.remove();
    document.body.appendChild(para);
    await flushMutations();
    expect(controller.getBlocks().length).toBe(initial);

    controller.toggleEnabled();
  });

  it('cleans a tracked block element even when it is removed as a leaf', async () => {
    const para = document.createElement('p');
    para.textContent = LONG_TEXT;
    document.body.appendChild(para);

    const controller = await createWebTokenizeController({ url: 'https://example.com/page' });
    controller.toggleEnabled();
    await flushMutations();
    expect(controller.getBlocks().length).toBeGreaterThan(0);

    para.textContent = '';
    await flushMutations();
    expect(controller.getBlocks().length).toBeGreaterThan(0);

    para.remove();
    await flushMutations();
    expect(controller.getBlocks().length).toBe(0);

    controller.toggleEnabled();
  });
});
