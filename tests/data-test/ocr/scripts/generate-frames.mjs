#!/usr/bin/env node
/**
 * Generate synthetic hard-subtitle frame PNGs for OCR testing.
 * Run: node tests/data-test/ocr/scripts/generate-frames.mjs
 * Output: tests/data-test/ocr/frames/*.png
 *
 * Frames simulate real hard-sub video frames:
 * - Dark video background (gradient/noise)
 * - White/yellow subtitle text burned-in at bottom
 * - Various scripts: zh, en, ja, mixed
 * - Edge cases: low contrast, stylized font, DRM black frame
 *
 * Uses canvas package (npm i canvas --no-save) or browser canvas.
 * For Jest/Node: uses @napi-rs/canvas or canvas.
 * For browser: run via Vite POC.
 */

import { createCanvas } from 'canvas';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'frames');
mkdirSync(outDir, { recursive: true });

/** Render a hard-sub frame: dark bg + subtitle text at bottom. */
function renderHardSubFrame({ width, height, text, bgColor, textColor, font, subtitleY, subtitleHeight }) {
  const c = createCanvas(width, height);
  const ctx = c.getContext('2d');

  // Background: dark gradient (simulate video frame)
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, bgColor.top);
  grad.addColorStop(1, bgColor.bottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Add some "scene" noise (simulate video content above subtitle)
  ctx.fillStyle = 'rgba(50, 50, 80, 0.3)';
  for (let i = 0; i < 20; i++) {
    const x = Math.random() * width;
    const y = Math.random() * (height - subtitleHeight);
    const r = 20 + Math.random() * 60;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Subtitle text
  ctx.fillStyle = textColor;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 4;
  ctx.fillText(text, width / 2, subtitleY);

  return c.toBuffer('image/png');
}

/** Render multi-line hard-sub frame (mixed language). */
function renderMultiLineFrame({ width, height, lines, textColor, font }) {
  const c = createCanvas(width, height);
  const ctx = c.getContext('2d');

  // Background
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, '#1a1a2e');
  grad.addColorStop(1, '#0d0d1a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Scene noise
  ctx.fillStyle = 'rgba(40, 40, 60, 0.3)';
  for (let i = 0; i < 15; i++) {
    const x = Math.random() * width;
    const y = Math.random() * (height * 0.6);
    const r = 15 + Math.random() * 50;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Subtitle lines
  ctx.fillStyle = textColor;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 4;

  const lineHeight = 50;
  const startY = height - (lines.length * lineHeight) - 20;
  lines.forEach((line, i) => {
    ctx.fillText(line, width / 2, startY + i * lineHeight + lineHeight / 2);
  });

  return c.toBuffer('image/png');
}

/** Render DRM black frame (Widevine simulation). */
function renderBlackFrame({ width, height }) {
  const c = createCanvas(width, height);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);
  return c.toBuffer('image/png');
}

/** Render low-contrast hard-sub (realistic — dim subtitle). */
function renderLowContrastFrame({ width, height, text }) {
  const c = createCanvas(width, height);
  const ctx = c.getContext('2d');

  // Dim background
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(0, 0, width, height);

  // Dim subtitle (gray, not white)
  ctx.fillStyle = '#888888';
  ctx.font = '36px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 2;
  ctx.fillText(text, width / 2, height - 60);

  return c.toBuffer('image/png');
}

// === Generate all frames ===

const frames = [
  // Tier 2: Synthetic hard-sub frames
  {
    file: 'hardsub-zh-01.png',
    render: () => renderHardSubFrame({
      width: 1280, height: 720, text: '我喜欢北京',
      bgColor: { top: '#1a1a2e', bottom: '#0d0d1a' },
      textColor: '#ffffff', font: '42px sans-serif',
      subtitleY: 660, subtitleHeight: 80
    })
  },
  {
    file: 'hardsub-en-01.png',
    render: () => renderHardSubFrame({
      width: 1280, height: 720, text: 'Hello World',
      bgColor: { top: '#1e2a3e', bottom: '#0f1a2a' },
      textColor: '#ffffff', font: '42px sans-serif',
      subtitleY: 660, subtitleHeight: 80
    })
  },
  {
    file: 'hardsub-ja-01.png',
    render: () => renderHardSubFrame({
      width: 1280, height: 720, text: '日本語を勉強する',
      bgColor: { top: '#2e1a1a', bottom: '#1a0d0d' },
      textColor: '#ffffff', font: '42px sans-serif',
      subtitleY: 660, subtitleHeight: 80
    })
  },
  {
    file: 'hardsub-mixed-zh-en-01.png',
    render: () => renderHardSubFrame({
      width: 1280, height: 720, text: '我喜欢 watching movies',
      bgColor: { top: '#1a2e1a', bottom: '#0d1a0d' },
      textColor: '#ffffff', font: '40px sans-serif',
      subtitleY: 660, subtitleHeight: 80
    })
  },
  {
    file: 'hardsub-mixed-3-lines-01.png',
    render: () => renderMultiLineFrame({
      width: 1280, height: 720,
      lines: ['我喜欢 watching movies', '日本語も勉強しています', 'Hello 世界'],
      textColor: '#ffffff', font: '36px sans-serif'
    })
  },
  {
    file: 'hardsub-yellow-01.png',
    render: () => renderHardSubFrame({
      width: 1280, height: 720, text: '黄色字幕',
      bgColor: { top: '#1a1a2e', bottom: '#0d0d1a' },
      textColor: '#ffeb3b', font: '42px sans-serif',
      subtitleY: 660, subtitleHeight: 80
    }),
    comment: 'Yellow subtitle (common in Asian hard-sub)'
  },
  {
    file: 'hardsub-low-contrast-01.png',
    render: () => renderLowContrastFrame({
      width: 1280, height: 720, text: 'Dim subtitle text'
    }),
    comment: 'Low contrast — tests OCR robustness'
  },
  {
    file: 'drm-black-frame.png',
    render: () => renderBlackFrame({ width: 1280, height: 720 }),
    comment: 'DRM black frame (Widevine simulation)'
  },
  {
    file: 'hardsub-zh-02-long-text.png',
    render: () => renderHardSubFrame({
      width: 1280, height: 720, text: '这是一个很长很长的中文字幕用来测试OCR的长文本处理能力',
      bgColor: { top: '#1a1a2e', bottom: '#0d0d1a' },
      textColor: '#ffffff', font: '32px sans-serif',
      subtitleY: 670, subtitleHeight: 60
    }),
    comment: 'Long Chinese text — tests OCR with longer lines'
  },
  {
    file: 'hardsub-en-02-two-lines.png',
    render: () => renderMultiLineFrame({
      width: 1280, height: 720,
      lines: ['First line of subtitle', 'Second line below'],
      textColor: '#ffffff', font: '36px sans-serif'
    }),
    comment: 'Two-line English subtitle'
  }
];

let count = 0;
for (const frame of frames) {
  const buf = frame.render();
  const path = join(outDir, frame.file);
  writeFileSync(path, buf);
  console.log(`✓ ${frame.file} (${(buf.length / 1024).toFixed(0)}KB)${frame.comment ? ' — ' + frame.comment : ''}`);
  count++;
}
console.log(`\nGenerated ${count} frames in ${outDir}`);
