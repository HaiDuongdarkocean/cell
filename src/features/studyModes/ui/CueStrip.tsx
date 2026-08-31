import { type ReactElement, useRef } from 'react';
import { Text, HStack } from '@/shared/ui';
import { Icon } from '@/shared/icons/Icon';
import type { StudyStep } from '@/entities/studyMode';
import styles from './StudyModesTab.module.css';

interface CueStripProps {
  readonly steps: readonly StudyStep[];
  readonly selectedIndex: number;
  readonly onSelect: (index: number) => void;
  readonly onAdd: () => void;
  readonly onReorder?: (from: number, to: number) => void;
}

export function CueStrip({
  steps,
  selectedIndex,
  onSelect,
  onAdd,
  onReorder,
}: CueStripProps): ReactElement {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLButtonElement>): void => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (e.shiftKey && onReorder && index > 0) {
        onReorder(index, index - 1);
      } else if (index > 0) {
        onSelect(index - 1);
      }
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (e.shiftKey && onReorder && index < steps.length - 1) {
        onReorder(index, index + 1);
      } else if (index < steps.length - 1) {
        onSelect(index + 1);
      }
    } else if (e.key === 'Home') {
      e.preventDefault();
      onSelect(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      onSelect(steps.length - 1);
    }
  };

  return (
    <HStack
      gap="2"
      className={styles.cueStrip}
      role="group"
      aria-label="Steps"
    >
      {steps.map((step, index) => (
        <button
          key={index}
          type="button"
          ref={(el) => { refs.current[index] = el; }}
          className={`${styles.cueBlock} ${index === selectedIndex ? styles.cueBlockSelected : ''}`}
          onClick={() => onSelect(index)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          data-cell-id={`cue-step-${index}`}
          aria-current={index === selectedIndex ? 'true' : undefined}
          tabIndex={index === selectedIndex ? 0 : -1}
        >
          <Text as="span" variant="label" className={styles.cueIndex}>
            {index + 1}
          </Text>
          <Text as="span" className={styles.cueSubtitle}>
            {step.subtitle}
          </Text>
          <Text as="span" className={styles.cueSpeed}>
            {step.speed}x
          </Text>
          {step.repeat > 1 && (
            <Text as="span" className={styles.cueRepeat}>
              ×{step.repeat}
            </Text>
          )}
        </button>
      ))}
      <button
        type="button"
        className={styles.cueAdd}
        onClick={onAdd}
        data-cell-id="cue-add-step"
      >
        <Icon name="plus" size={16} />
        <Text as="span">Add</Text>
      </button>
    </HStack>
  );
}
