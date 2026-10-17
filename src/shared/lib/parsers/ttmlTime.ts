export function parseTtmlTime(expr: string, tickRate: number, frameRate: number): number | null {
  const trimmed = expr.trim();

  if (trimmed.endsWith('t')) {
    const ticks = parseFloat(trimmed.slice(0, -1));
    if (!Number.isFinite(ticks)) return null;
    return (ticks / tickRate) * 1000;
  }

  if (trimmed.endsWith('f')) {
    const frames = parseFloat(trimmed.slice(0, -1));
    if (!Number.isFinite(frames)) return null;
    return (frames / frameRate) * 1000;
  }

  if (trimmed.endsWith('s')) {
    const seconds = parseFloat(trimmed.slice(0, -1));
    if (!Number.isFinite(seconds)) return null;
    return seconds * 1000;
  }

  const clockMatch = trimmed.match(/^(\d+):(\d{2}):(\d{2})(?:[.:](\d+))?$/);
  if (clockMatch) {
    const hours = parseInt(clockMatch[1], 10);
    const minutes = parseInt(clockMatch[2], 10);
    const seconds = parseInt(clockMatch[3], 10);
    const fraction = clockMatch[4];

    let ms = hours * 3_600_000 + minutes * 60_000 + seconds * 1_000;
    if (fraction) {
      if (fraction.length === 3) {
        ms += parseInt(fraction, 10);
      } else if (fraction.length < 3) {
        ms += parseInt(fraction, 10) * Math.pow(10, 3 - fraction.length);
      } else {
        ms += (parseInt(fraction, 10) / frameRate) * 1000;
      }
    }
    return ms;
  }

  return null;
}
