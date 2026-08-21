// hardSubMockMain — Mock hard-sub video page for OCR testing (T7b, Tier 4 test data).
// Renders video frames + burned-in subtitle text onto a canvas overlay.
// OCR pipeline can capture from the canvas to get frames with subtitle text.

import helloMp4 from '../design-system-showcase/assets/apologize.mp4?url';

/** Hard-subtitle cues — mixed CN+EN+JA for OCR testing. */
interface HardSubCue {
  readonly start: number;  // seconds
  readonly end: number;    // seconds
  readonly text: string;
}

const HARD_SUB_CUES: readonly HardSubCue[] = [
  { start: 0, end: 5, text: 'Hello World' },
  { start: 5, end: 10, text: '我喜欢北京' },
  { start: 10, end: 15, text: '日本語を勉強する' },
  { start: 15, end: 20, text: '我喜欢 watching movies' },
  { start: 20, end: 25, text: '東京駅からTokyo Stationへ' },
  { start: 25, end: 30, text: 'Hello 世界' },
  { start: 30, end: 35, text: '用WiFi看4K电影' },
  { start: 35, end: 40, text: '你好👋World🌍' },
  { start: 40, end: 45, text: 'This is a test subtitle' },
  { start: 45, end: 50, text: '学习外语很有趣' },
  { start: 50, end: 55, text: '日本語は難しい' },
  { start: 55, end: 60, text: 'I love watching movies' },
  { start: 60, end: 65, text: '北京の天気は晴れ' },
  { start: 65, end: 70, text: 'Learning languages is fun' },
  { start: 70, end: 75, text: '映画を見ましょう' },
  { start: 75, end: 80, text: '今天天气很好' },
  { start: 80, end: 85, text: 'The weather is nice today' },
  { start: 85, end: 90, text: '東京タワーに行きたい' },
  { start: 90, end: 95, text: '我喜欢吃中国菜' },
  { start: 95, end: 100, text: 'I want to learn Chinese' },
  { start: 100, end: 105, text: '日本料理が大好き' },
  { start: 105, end: 110, text: 'Hello everyone' },
  { start: 110, end: 115, text: '大家好欢迎观看' },
  { start: 115, end: 120, text: '皆さんこんにちは' },
  { start: 120, end: 125, text: 'Thank you for watching' },
  { start: 125, end: 130, text: '谢谢你的支持' },
  { start: 130, end: 135, text: '応援ありがとう' },
  { start: 135, end: 140, text: 'See you next time' },
  { start: 140, end: 145, text: '下次再见' },
  { start: 145, end: 150, text: 'またね' },
  { start: 150, end: 155, text: 'Goodbye everyone' },
  { start: 155, end: 160, text: '再见朋友们' },
  { start: 160, end: 165, text: 'さようなら' },
  { start: 165, end: 170, text: 'Have a great day' },
  { start: 170, end: 175, text: '祝你有个美好的一天' },
  { start: 175, end: 180, text: '良い一日を' },
  { start: 180, end: 188.685351, text: 'The End' },
];

/** Find active cue at given time. */
function findActiveCue(time: number): HardSubCue | undefined {
  return HARD_SUB_CUES.find((c) => time >= c.start && time < c.end);
}

/** Draw burned-in subtitle text onto canvas (white text + black outline, bottom 15%). */
function drawSubtitle(ctx: CanvasRenderingContext2D, text: string, width: number, height: number): void {
  const fontSize = Math.floor(height * 0.05);
  ctx.font = `${fontSize}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const x = width / 2;
  const y = height * 0.88;  // bottom 15% region

  // Black outline (shadow) for readability.
  ctx.fillStyle = 'black';
  ctx.shadowColor = 'black';
  ctx.shadowBlur = 4;
  ctx.fillText(text, x + 2, y + 2);
  ctx.fillText(text, x - 2, y + 2);
  ctx.fillText(text, x + 2, y - 2);
  ctx.fillText(text, x - 2, y - 2);

  // White text.
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'white';
  ctx.fillText(text, x, y);
}

function main(): void {
  const video = document.getElementById('video') as HTMLVideoElement;
  const canvas = document.getElementById('overlay') as HTMLCanvasElement;
  const playBtn = document.getElementById('play') as HTMLButtonElement;
  const pauseBtn = document.getElementById('pause') as HTMLButtonElement;
  const timeDisplay = document.getElementById('time') as HTMLSpanElement;

  video.src = helloMp4;
  video.muted = true;

  function resizeCanvas(): void {
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
  }

  video.addEventListener('loadedmetadata', resizeCanvas);
  window.addEventListener('resize', resizeCanvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // rVFC loop — draw video frame + subtitle text onto canvas.
  function renderFrame(): void {
    if (video.paused || video.ended) return;
    rvfcCount++;
    (window as unknown as { __rvfcCount?: number }).__rvfcCount = rvfcCount;
    document.body.dataset.mockRvfcCount = String(rvfcCount);
    resizeCanvas();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw video frame.
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Draw burned-in subtitle.
    const cue = findActiveCue(video.currentTime);
    if (cue) {
      drawSubtitle(ctx, cue.text, canvas.width, canvas.height);
    }

    timeDisplay.textContent = `${video.currentTime.toFixed(1)}s`;
    video.requestVideoFrameCallback(renderFrame);
  }

  // Use rVFC if available, fallback to requestAnimationFrame.
  if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
    video.requestVideoFrameCallback(renderFrame);
  } else {
    function rafLoop(): void {
      renderFrame();
      if (!video.paused && !video.ended) requestAnimationFrame(rafLoop);
    }
    requestAnimationFrame(rafLoop);
  }

  playBtn.addEventListener('click', () => {
    video.play();
    if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
      video.requestVideoFrameCallback(renderFrame);
    }
  });
  // Re-schedule rVFC on programmatic play() — the callback stops when video
  // pauses/ends and needs to be re-registered when play resumes.
  video.addEventListener('play', () => {
    document.body.dataset.mockPlayEvent = 'fired';
    if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
      video.requestVideoFrameCallback(renderFrame);
    }
  });
  // Track rVFC callback execution.
  let rvfcCount = 0;
  const origRenderFrame = renderFrame;
  // Wrap renderFrame to count calls.
  // ponytail: rVFC counter for debug — remove after testing.
  (window as unknown as { __rvfcCount?: number }).__rvfcCount = 0;
  pauseBtn.addEventListener('click', () => video.pause());
}

main();
