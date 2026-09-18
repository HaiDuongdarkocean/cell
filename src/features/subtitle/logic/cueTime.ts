// Human-friendly timestamp: drop leading zeros + millisecond noise.
// < 1h → M:SS (1:28), ≥ 1h → H:MM:SS (1:28:27). YouTube mental model.
export function formatCueTimestamp(ms: number, hasHours: boolean): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return hasHours ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
