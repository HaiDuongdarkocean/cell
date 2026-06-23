/**
 * Time conversion utilities for subtitle formats (ASS, VTT, SRT).
 */

/** Pad a number to a given width with leading zeros. */
function pad(value: number, width: number): string {
  return value.toString().padStart(width, '0');
}

/**
 * Convert an ASS timestamp "H:MM:SS.cc" to milliseconds.
 *
 * The fractional part is centiseconds (2 digits), so it is multiplied by 10.
 */
export function assTimeToMs(time: string): number {
  const match = /^(\d+):(\d{2}):(\d{2})\.(\d{2})$/.exec(time);
  if (!match) {
    throw new Error(`Invalid ASS time format: ${time}`);
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const centiseconds = Number(match[4]);
  return (
    ((hours * 3600 + minutes * 60 + seconds) * 1000) + centiseconds * 10
  );
}

/**
 * Convert a VTT timestamp "HH:MM:SS.mmm" to milliseconds.
 */
export function vttTimeToMs(time: string): number {
  const match = /^(\d{2}):(\d{2}):(\d{2})\.(\d{3})$/.exec(time);
  if (!match) {
    throw new Error(`Invalid VTT time format: ${time}`);
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const milliseconds = Number(match[4]);
  return (hours * 3600 + minutes * 60 + seconds) * 1000 + milliseconds;
}

/**
 * Convert an SRT timestamp "HH:MM:SS,mmm" to milliseconds.
 */
export function srtTimeToMs(time: string): number {
  const match = /^(\d{2}):(\d{2}):(\d{2}),(\d{3})$/.exec(time);
  if (!match) {
    throw new Error(`Invalid SRT time format: ${time}`);
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const milliseconds = Number(match[4]);
  return (hours * 3600 + minutes * 60 + seconds) * 1000 + milliseconds;
}

/**
 * Convert milliseconds to an SRT timestamp "HH:MM:SS,mmm".
 */
export function msToSrtTime(ms: number): string {
  const totalMs = Math.floor(ms);
  const hours = Math.floor(totalMs / 3600000);
  const minutes = Math.floor((totalMs % 3600000) / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const milliseconds = totalMs % 1000;
  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)},${pad(milliseconds, 3)}`;
}

/**
 * Convert milliseconds to an ASS timestamp "H:MM:SS.cc".
 *
 * The fractional part is centiseconds (2 digits); milliseconds are truncated.
 */
export function msToAssTime(ms: number): string {
  const totalMs = Math.floor(ms);
  const hours = Math.floor(totalMs / 3600000);
  const minutes = Math.floor((totalMs % 3600000) / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const centiseconds = Math.floor((totalMs % 1000) / 10);
  return `${hours}:${pad(minutes, 2)}:${pad(seconds, 2)}.${pad(centiseconds, 2)}`;
}
