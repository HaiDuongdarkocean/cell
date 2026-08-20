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
  { start: 0, end: 3, text: 'Hello World' },
  { start: 3, end: 6, text: '我喜欢北京' },
  { start: 6, end: 9, text: '日本語を勉強する' },
  { start: 9, end: 12, text: '我喜欢 watching movies' },
  { start: 12, end: 15, text: '東京駅からTokyo Stationへ' },
  { start: 15, end: 18, text: 'Hello 世界' },
  { start: 18, end: 21, text: '用WiFi看4K电影' },
  { start: 21, end: 24, text: '你好👋World🌍' },
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
  pauseBtn.addEventListener('click', () => video.pause());
}

main();
