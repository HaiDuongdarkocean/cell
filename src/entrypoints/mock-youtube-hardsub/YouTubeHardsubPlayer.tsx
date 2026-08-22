// YouTubeHardsubPlayer — mock YouTube player that burns subtitles onto a canvas
// overlay (sibling of the video) so the OCR pipeline can scan hard-sub text.
// The container aspect-ratio is configurable (?ar=4:3|16:9|21:9) to force
// object-fit:contain letterbox — reproducing the "scan sai vùng" bug scenario.
//
// DOM contract for frameCapture: video.parentElement.querySelector('canvas')
// → the <canvas> below must be a sibling of <video> inside the container.

import { useEffect, useRef, useState, type ReactElement } from 'react';
import { findHardsubCue } from './hardsubCues';
import styles from './YouTubeHardsubPlayer.module.css';

type AspectRatio = '4:3' | '16:9' | '21:9';

const AR_CSS: Record<AspectRatio, string> = {
  '4:3': '4 / 3',
  '16:9': '16 / 9',
  '21:9': '21 / 9',
};

/** Read ?ar= query param, default 16:9. */
function readArParam(): AspectRatio {
  const v = new URLSearchParams(window.location.search).get('ar');
  return v === '4:3' || v === '16:9' || v === '21:9' ? v : '16:9';
}

/** Draw burned-in subtitle text onto the canvas at intrinsic resolution.
 *  Transparent background — frameCapture composites this over the video frame.
 *  Draws English (top, ~70% y) + Vietnamese (bottom, ~90% y) so split mode OCR
 *  (top=target=English, bottom=native=Vietnamese) can detect both streams.
 *  Positions match the split region (bottom 40% = y 60%..100%, ratio 0.5):
 *    top half 60%..80% → English at 70% (centered)
 *    bottom half 80%..100% → Vietnamese at 90% (centered)
 *  Single-stream mode scans bottom 15% (y 85%..100%) → catches Vietnamese only. */
function drawSubtitle(ctx: CanvasRenderingContext2D, en: string, vi: string, width: number, height: number): void {
  const fontSize = Math.floor(height * 0.04);
  ctx.font = `${fontSize}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const x = width / 2;
  const yEn = height * 0.70; // upper line — split top half center (60-80%)
  const yVi = height * 0.90; // lower line — split bottom half center (80-100%) + single-stream bottom 15%
  const drawLine = (text: string, y: number): void => {
    ctx.fillStyle = 'black';
    ctx.shadowColor = 'black';
    ctx.shadowBlur = 4;
    ctx.fillText(text, x + 2, y + 2);
    ctx.fillText(text, x - 2, y + 2);
    ctx.fillText(text, x + 2, y - 2);
    ctx.fillText(text, x - 2, y - 2);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'white';
    ctx.fillText(text, x, y);
  };
  drawLine(en, yEn);
  drawLine(vi, yVi);
}

export function YouTubeHardsubPlayer(): ReactElement {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ar, setAr] = useState<AspectRatio>(readArParam);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);

  // Hardsub render loop — rVFC: clear canvas + draw active cue at intrinsic size.
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    const render = (): void => {
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (w && h && (canvas.width !== w || canvas.height !== h)) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const cue = findHardsubCue(video.currentTime);
      if (cue) drawSubtitle(ctx, cue.en, cue.vi, canvas.width, canvas.height);
      setTime(video.currentTime);
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Sync playing state.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    return () => {
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
    };
  }, []);

  const togglePlay = (): void => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play(); else v.pause();
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <button onClick={togglePlay} className={styles.btn}>{playing ? 'Pause' : 'Play'}</button>
        <span className={styles.time}>{time.toFixed(1)}s</span>
        <span className={styles.arLabel}>aspect-ratio:</span>
        {(['4:3', '16:9', '21:9'] as AspectRatio[]).map((a) => (
          <button
            key={a}
            onClick={() => setAr(a)}
            className={`${styles.btn} ${ar === a ? styles.arActive : ''}`}
          >{a}</button>
        ))}
        <span className={styles.hint}>object-fit: contain — non-matching AR letterboxes the video (reproduces the region-scan bug)</span>
      </div>
      <div className={styles.player} style={{ aspectRatio: AR_CSS[ar] }}>
        <video
          ref={videoRef}
          className={styles.video}
          src="./assets/HowHaveYouBeen.mp4"
          autoPlay
          muted
          loop
          playsInline
          crossOrigin="anonymous"
        />
        <canvas ref={canvasRef} className={styles.canvas} />
      </div>
      <p className={styles.info}>
        Hard-sub mock: subtitles burned onto the canvas overlay (sibling of video).
        The OCR region selector attaches to this container; with a non-16:9 aspect
        ratio the video is letterboxed and the region must map shell-space →
        intrinsic-space to scan the right pixels.
      </p>
    </div>
  );
}
