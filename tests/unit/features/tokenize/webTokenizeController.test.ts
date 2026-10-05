import { createWebTokenizeController } from '@/features/tokenize/controller/webTokenizeController';

const flushMutations = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 50));

const LONG_TEXT =
  'This is a long paragraph of plain English text with enough words to be treated as a tokenizable text block by the scanner.';

describe('webTokenizeController block registry', () => {
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
});
