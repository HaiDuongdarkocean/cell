import { useEffect, useId, useMemo, useState, type ReactElement } from 'react';
import { Heading, Text, Button, Chip, HStack, VStack, FormGroup, Dialog } from '@/shared/ui';
import { BottomSheet } from '@/shared/ui/BottomSheet';
import { Input } from '@/shared/ui/Input';
import { Icon } from '@/shared/icons/Icon';
import { useStudyModeStore } from '../studyModeStore';
import { validateModeName } from '../lib/validateModeName';
import { formatModeDescription } from '../lib/formatStepSummary';
import type { StudyStep, StudyMode } from '@/entities/studyMode';
import styles from './StudyModesTab.module.css';

interface CustomModeBuilderProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly editingId: string | null;
}

const SUBTITLE_OPTIONS: StudyStep['subtitle'][] = ['none', 'native', 'target', 'both'];
const PAUSE_OPTIONS: StudyStep['pause'][] = ['none', 'start', 'end'];
const REPEAT_OPTIONS: StudyStep['repeat'][] = [1, 2, 3];
const SPEED_OPTIONS: StudyStep['speed'][] = [0.5, 0.75, 1, 1.25, 1.5];
const AFTER_OPTIONS: StudyStep['after'][] = ['continue', 'wait', 'loop'];

const EMPTY_STEP: StudyStep = {
  subtitle: 'target',
  pause: 'none',
  repeat: 1,
  speed: 1,
  after: 'continue',
};

export function CustomModeBuilder({ open, onOpenChange, editingId }: CustomModeBuilderProps): ReactElement {
  const store = useStudyModeStore();
  const titleId = useId();
  const isNew = editingId === null;
  const initial = useMemo(() => {
    if (editingId) {
      const existing = store.customModes.find((m) => m.id === editingId);
      if (existing) return { title: existing.title, steps: existing.steps.map((s) => ({ ...s })) };
    }
    return { title: '', steps: [{ ...EMPTY_STEP }] };
  }, [editingId, store.customModes]);

  const [title, setTitle] = useState(initial.title);
  const [steps, setSteps] = useState<StudyStep[]>(initial.steps);
  const [error, setError] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [selectedStepIndex, setSelectedStepIndex] = useState(0);

  const isDirty = title.trim() !== initial.title || JSON.stringify(steps) !== JSON.stringify(initial.steps);

  const preview = useMemo(() => {
    const draft: StudyMode = {
      id: editingId ?? 'preview',
      type: 'custom',
      icon: 'slidersHorizontal',
      title: title.trim() || 'Preview',
      description: '',
      steps,
    };
    return formatModeDescription(draft);
  }, [editingId, steps, title]);

  useEffect(() => {
    if (open) {
      setTitle(initial.title);
      setSteps(initial.steps);
      setError(null);
      setDiscardOpen(false);
      setSelectedStepIndex(0);
    }
  }, [open, initial]);

  const handleCloseAttempt = (): void => {
    if (isDirty) {
      setDiscardOpen(true);
    } else {
      onOpenChange(false);
    }
  };

  const handleSave = (): void => {
    const trimmedTitle = title.trim();
    const validation = validateModeName(trimmedTitle, store.customModes, editingId ?? undefined);
    if (!validation.valid) {
      setError(validation.error ?? 'Invalid name');
      return;
    }
    if (steps.length === 0) {
      setError('At least one step is required');
      return;
    }

    if (isNew) {
      useStudyModeStore.getState().createCustomMode(trimmedTitle, steps);
    } else {
      useStudyModeStore.getState().updateCustomMode(editingId, { title: trimmedTitle, steps });
    }
    onOpenChange(false);
  };

  const handleDeleteMode = (): void => {
    if (editingId) {
      useStudyModeStore.getState().deleteCustomMode(editingId);
    }
    onOpenChange(false);
  };

  const updateStep = (index: number, step: StudyStep): void => {
    const next = [...steps];
    next[index] = step;
    setSteps(next);
  };

  const addStep = (): void => {
    const next = [...steps, { ...EMPTY_STEP }];
    setSteps(next);
    setSelectedStepIndex(next.length - 1);
  };

  const removeStep = (index: number): void => {
    const next = steps.filter((_, i) => i !== index);
    if (next.length === 0) {
      next.push({ ...EMPTY_STEP });
    }
    setSteps(next);
    if (selectedStepIndex >= next.length) {
      setSelectedStepIndex(next.length - 1);
    } else if (index < selectedStepIndex) {
      setSelectedStepIndex(selectedStepIndex - 1);
    }
  };

  const selectedStep = steps[selectedStepIndex];

  return (
    <>
      <BottomSheet
        open={open}
        onOpenChange={handleCloseAttempt}
        title={isNew ? 'New custom mode' : 'Edit custom mode'}
        data-cell-id="custom-mode-builder"
        footer={
          <HStack gap="3" justify="between" className={styles.builderFooter}>
            {!isNew && (
              <Button variant="destructive" size="sm" onClick={handleDeleteMode} data-cell-id="builder-delete">
                Delete
              </Button>
            )}
            <HStack gap="3" className={styles.builderFooterRight}>
              <Button variant="ghost" size="sm" onClick={handleCloseAttempt} data-cell-id="builder-cancel">
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} data-cell-id="builder-save">
                Save
              </Button>
            </HStack>
          </HStack>
        }
      >
        <VStack gap="4">
          <FormGroup label="Mode name" htmlFor={titleId}>
            <Input
              id={titleId}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Shadowing"
              maxLength={50}
              data-cell-id="builder-title-input"
            />
          </FormGroup>
          {error && (
            <Text color="secondary" as="p" className={styles.builderError}>
              {error}
            </Text>
          )}

          <div>
            <Text color="secondary" as="p" data-cell-id="builder-preview">
              {preview}
            </Text>
            <Heading level={3} size={4} className={styles.sectionHeading}>
              Steps
            </Heading>

            <CueStrip
              steps={steps}
              selectedIndex={selectedStepIndex}
              onSelect={setSelectedStepIndex}
              onAdd={addStep}
            />

            {selectedStep && (
              <StepEditor
                index={selectedStepIndex}
                step={selectedStep}
                onChange={(s) => updateStep(selectedStepIndex, s)}
                onRemove={steps.length > 1 ? () => removeStep(selectedStepIndex) : undefined}
              />
            )}
          </div>
        </VStack>
      </BottomSheet>

      {discardOpen && (
        <Dialog
          open={discardOpen}
          onOpenChange={setDiscardOpen}
          title="Discard changes?"
          description="Any unsaved changes will be lost."
          data-cell-id="builder-discard-dialog"
          footer={
            <HStack gap="3" justify="end">
              <Button variant="ghost" size="sm" onClick={() => setDiscardOpen(false)} data-cell-id="builder-discard-cancel">
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => { setDiscardOpen(false); onOpenChange(false); }}
                data-cell-id="builder-discard-ok"
              >
                Discard
              </Button>
            </HStack>
          }
        />
      )}
    </>
  );
}

interface CueStripProps {
  readonly steps: readonly StudyStep[];
  readonly selectedIndex: number;
  readonly onSelect: (index: number) => void;
  readonly onAdd: () => void;
}

function CueStrip({ steps, selectedIndex, onSelect, onAdd }: CueStripProps): ReactElement {
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
          className={`${styles.cueBlock} ${index === selectedIndex ? styles.cueBlockSelected : ''}`}
          onClick={() => onSelect(index)}
          data-cell-id={`cue-step-${index}`}
          aria-current={index === selectedIndex ? 'true' : undefined}
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

interface StepEditorProps {
  readonly index: number;
  readonly step: StudyStep;
  readonly onChange: (step: StudyStep) => void;
  readonly onRemove?: () => void;
}

function StepEditor({ index, step, onChange, onRemove }: StepEditorProps): ReactElement {
  const OptionGroup = <K extends keyof StudyStep>(
    label: string,
    options: readonly StudyStep[K][],
    current: StudyStep[K],
    field: K,
  ): ReactElement => (
    <div className={styles.stepOption} role="group" aria-label={label}>
      <Text as="span" variant="label" color="secondary" className={styles.stepOptionLabel}>
        {label}
      </Text>
      <HStack gap="1" className={styles.stepChipGroup}>
        {options.map((option) => (
          <Chip
            key={String(option)}
            as="button"
            size="sm"
            selected={current === option}
            onClick={() => onChange({ ...step, [field]: option })}
            data-cell-id={`step-${index}-${field}-${option}`}
          >
            {String(option)}
          </Chip>
        ))}
      </HStack>
    </div>
  );

  return (
    <div className={styles.stepRow} data-cell-id={`step-row-${index}`}>
      <Text as="span" variant="label" className={styles.stepIndex}>
        {index + 1}
      </Text>
      <VStack gap="2" className={styles.stepOptions}>
        {OptionGroup('Subtitle', SUBTITLE_OPTIONS, step.subtitle, 'subtitle')}
        {OptionGroup('Pause', PAUSE_OPTIONS, step.pause, 'pause')}
        {OptionGroup('Repeat', REPEAT_OPTIONS, step.repeat, 'repeat')}
        {OptionGroup('Speed', SPEED_OPTIONS, step.speed, 'speed')}
        {OptionGroup('After', AFTER_OPTIONS, step.after, 'after')}
      </VStack>
      {onRemove && (
        <Button
          size="xs"
          variant="ghost"
          onClick={onRemove}
          data-cell-id={`remove-step-${index}`}
          leadingIcon={<Icon name="trash" size={14} />}
        />
      )}
    </div>
  );
}
