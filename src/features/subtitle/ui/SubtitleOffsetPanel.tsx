import { useState, useCallback } from 'react';
import { Button, Input, Slider } from '@/shared/ui';
import { clampOffsetMs, formatOffsetDisplay, parseOffsetInput } from '@/features/subtitle/logic/subtitleOffset';
import styles from './SubtitleOffsetPanel.module.css';

export interface SubtitleOffsetPanelProps {
  /** Current offset in ms. */
  offsetMs: number;
  /** Called whenever offset changes for live preview. */
  onOffsetChange: (offsetMs: number) => void;
  /** Called when user commits the offset (apply / blur / enter). */
  onCommit?: (offsetMs: number) => void;
  /** Called when offset is reset to 0. */
  onReset?: () => void;
}

const STEPS = [
  { label: '-2s', value: -2000 },
  { label: '-0.5s', value: -500 },
  { label: '+0.5s', value: 500 },
  { label: '+2s', value: 2000 },
];

export function SubtitleOffsetPanel({
  offsetMs,
  onOffsetChange,
  onCommit,
  onReset,
}: SubtitleOffsetPanelProps): React.JSX.Element {
  const [input, setInput] = useState(String(formatOffsetDisplay(offsetMs)));

  const clamped = clampOffsetMs(offsetMs);

  const commit = useCallback(
    (ms: number): void => {
      const value = clampOffsetMs(ms);
      onOffsetChange(value);
      setInput(String(formatOffsetDisplay(value)));
      onCommit?.(value);
    },
    [onOffsetChange, onCommit],
  );

  const handleSlider = (value: number): void => {
    const ms = Math.round(value * 1000);
    commit(ms);
  };

  const adjust = (deltaMs: number): void => {
    commit(clamped + deltaMs);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setInput(e.target.value);
  };

  const handleInputCommit = (): void => {
    const ms = parseOffsetInput(input);
    if (ms !== null) {
      commit(ms);
    } else {
      setInput(String(formatOffsetDisplay(clamped)));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') handleInputCommit();
  };

  const handleReset = (): void => {
    onOffsetChange(0);
    setInput(String(formatOffsetDisplay(0)));
    onReset?.();
  };

  return (
    <div className={styles.panel} data-cell-id="subtitle-offset-panel">
      <div className={styles.header}>
        <span className={styles.title}>Time offset</span>
        <span className={styles.value} data-cell-id="offset-value">
          {String(formatOffsetDisplay(clamped))}
        </span>
      </div>

      <div className={styles.sliderRow}>
        <Slider
          aria-label="Time offset slider"
          min={-60}
          max={60}
          step={0.5}
          value={clamped / 1000}
          onChange={handleSlider}
          data-cell-id="offset-slider"
        />
      </div>

      <div className={styles.steppers}>
        {STEPS.map((step) => (
          <Button key={step.label} size="sm" variant="outline" onClick={() => adjust(step.value)} data-cell-id={`offset-step-${step.label}`}>
            {step.label}
          </Button>
        ))}
      </div>

      <div className={styles.inputRow}>
        <Input
          type="text"
          size="sm"
          value={input}
          onChange={handleInputChange}
          onBlur={handleInputCommit}
          onKeyDown={handleKeyDown}
          aria-label="Time offset in seconds"
          data-cell-id="offset-input"
          className={styles.offsetInput}
        />
        <Button size="sm" variant="primary" onClick={handleInputCommit} data-cell-id="offset-apply">
          Apply
        </Button>
        <Button size="sm" variant="ghost" onClick={handleReset} data-cell-id="offset-reset">
          Reset
        </Button>
      </div>
    </div>
  );
}
