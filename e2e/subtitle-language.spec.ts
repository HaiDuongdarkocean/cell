import { test, expect } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import {
  launchExtensionBrowser,
  openPopup,
  closeExtensionBrowser,
} from './fixtures/extension';

const ENGLISH_SRT = `1
00:00:01,000 --> 00:00:04,000
Hello, and welcome to the show. I am your host.

2
00:00:04,500 --> 00:00:07,000
Today we have a special guest in the studio.

3
00:00:07,500 --> 00:00:10,000
He is known for his work in that field.

4
00:00:10,500 --> 00:00:13,000
We have a lot to talk about, so let's get started.

5
00:00:13,500 --> 00:00:16,000
It is not often that we get to sit down on this couch.

6
00:00:16,500 --> 00:00:19,000
For those of you who don't know, he has been working on this.

7
00:00:19,500 --> 00:00:22,000
And on that note, let's begin the interview.`;

const CHINESE_SRT = `1
00:00:01,000 --> 00:00:04,000
你好，我在这里等了很久。

2
00:00:04,500 --> 00:00:07,000
他说这个人有来过这里。

3
00:00:07,500 --> 00:00:10,000
有人在上面说话，不知道说些什么。

4
00:00:10,500 --> 00:00:13,000
他来了，我们有个新朋友在这。

5
00:00:13,500 --> 00:00:16,000
人在上面看，有人在说，有人在来。

6
00:00:16,500 --> 00:00:19,000
我有他在，这上面有人来过。

7
00:00:19,500 --> 00:00:22,000
他说这人在上面，有个朋友来。`;

const VIETNAMESE_SRT = `1
00:00:01,000 --> 00:00:04,000
Xin chào, tôi có một người bạn trong này.

2
00:00:04,500 --> 00:00:07,000
Anh ấy được cho là người cũng có ở đây.

3
00:00:07,500 --> 00:00:10,000
Có người trong này, không ai cũng được.

4
00:00:10,500 --> 00:00:13,000
Tôi có một người bạn, với anh ấy này.

5
00:00:13,500 --> 00:00:16,000
Người này có trong đây, cũng được cho.

6
00:00:16,500 --> 00:00:19,000
Không có ai trong này, một người cũng không.

7
00:00:19,500 --> 00:00:22,000
Với người này, có một cũng được, không sao.`;

const KOREAN_SRT = `1
00:00:01,000 --> 00:00:04,000
이것은 같다. 우리가 하다, 되다, 않다.

2
00:00:04,500 --> 00:00:07,000
이렇다, 진짜로, 아, 더 많이 하다.

3
00:00:07,500 --> 00:00:10,000
우리는 같다, 이렇다, 되다, 않다, 하다.

4
00:00:10,500 --> 00:00:13,000
아, 이것이 같다. 우리 더 진짜로 하다.

5
00:00:13,500 --> 00:00:16,000
이렇다, 되다, 않다, 하다, 같다, 이.

6
00:00:16,500 --> 00:00:19,000
우리 진짜 더 아, 이렇다, 되다, 하다.

7
00:00:19,500 --> 00:00:22,000
같다, 이, 않다, 하다, 아, 이렇다, 되다, 우리, 진짜, 더.`;

const JAPANESE_SRT = `1
00:00:01,000 --> 00:00:04,000
これをだが、てとますもでているです。

2
00:00:04,500 --> 00:00:07,000
をだがてとますもでているです。

3
00:00:07,500 --> 00:00:10,000
これがだ、てとますもでているです。

4
00:00:10,500 --> 00:00:13,000
をだがてと、ますもでているです。

5
00:00:13,500 --> 00:00:16,000
がてとますもで、ているですをだ。

6
00:00:16,500 --> 00:00:19,000
もでているです、をだがてとます。

7
00:00:19,500 --> 00:00:22,000
をだがてとますもでているです。`;

const RUSSIAN_SRT = `1
00:00:01,000 --> 00:00:04,000
Я быть он с что а по это она этот.

2
00:00:04,500 --> 00:00:07,000
Я быть он с что а по это она этот.

3
00:00:07,500 --> 00:00:10,000
Он с что а по это, она этот я быть.

4
00:00:10,500 --> 00:00:13,000
С что а по это, она этот я быть он.

5
00:00:13,500 --> 00:00:16,000
Что а по это, она этот я быть он с.

6
00:00:16,500 --> 00:00:19,000
А по это, она этот я быть он с что.

7
00:00:19,500 --> 00:00:22,000
По это, она этот я быть он с что а.`;

async function startLocalServer(subtitleContent: string): Promise<{ server: Server; port: number }> {
  return new Promise((resolveFn, rejectFn) => {
    const server = createServer((req, res) => {
      const url = req.url ?? '/';
      if (url === '/' || url === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<!DOCTYPE html><html><body><h1>Test Page</h1>
<script>fetch('/subtitle.srt').then(() => console.log('subtitle fetched'));</script>
</body></html>`);
      } else if (url === '/subtitle.srt') {
        res.writeHead(200, { 'Content-Type': 'application/x-subrip' });
        res.end(subtitleContent);
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });
    server.on('error', rejectFn);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolveFn({ server, port });
    });
  });
}

async function testLanguageDetection(
  subtitleContent: string,
  expectedLabel: string,
): Promise<void> {
  const { server, port } = await startLocalServer(subtitleContent);
  const { context, extensionId } = await launchExtensionBrowser();

  try {
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/`, {
      waitUntil: 'domcontentloaded',
      timeout: 10_000,
    });
    await page.waitForTimeout(5_000);

    const popup = await openPopup(context, extensionId);
    await expect(popup.locator('[data-testid="media-section"]')).toBeVisible({
      timeout: 10_000,
    });

    const subtitleItem = popup.locator('[data-testid="subtitle-item"]');
    await expect(subtitleItem.first()).toBeVisible({ timeout: 15_000 });

    const languageTag = popup.locator('[data-testid="subtitle-language"]');
    await expect(languageTag.first()).toContainText(expectedLabel, {
      timeout: 15_000,
    });

    await popup.close();
    await page.close();
  } finally {
    await closeExtensionBrowser(context);
    server.close();
  }
}

test.describe('subtitle language detection', () => {
  test('displays "english" tag for English SRT', async () => {
    await testLanguageDetection(ENGLISH_SRT, 'english');
  });

  test('displays "chinese" tag for Chinese SRT', async () => {
    await testLanguageDetection(CHINESE_SRT, 'chinese');
  });

  test('displays "vietnamese" tag for Vietnamese SRT', async () => {
    await testLanguageDetection(VIETNAMESE_SRT, 'vietnamese');
  });

  test('displays "korean" tag for Korean SRT', async () => {
    await testLanguageDetection(KOREAN_SRT, 'korean');
  });

  test('displays "japanese" tag for Japanese SRT', async () => {
    await testLanguageDetection(JAPANESE_SRT, 'japanese');
  });

  test('displays "russian" tag for Russian SRT', async () => {
    await testLanguageDetection(RUSSIAN_SRT, 'russian');
  });
});
