import { useEffect, useId, useMemo, useState, type ReactElement } from 'react';
import { Heading, Text, Button, HStack, VStack, FormGroup, Dialog } from '@/shared/ui';
import { BottomSheet } from '@/shared/ui/BottomSheet';
import { Input } from '@/shared/ui/Input';
import { useStudyModeStore } from '../studyModeStore';
import { validateModeName } from '../lib/validateModeName';
import { formatModeDescription } from '../lib/formatStepSummary';
import type { StudyStep, StudyMode } from '@/entities/studyMode';
import { CueStrip } from './CueStrip';
import { StepEditor } from './StepEditor';
import styles from './CustomModeBuilder.module.css';

interface CustomModeBuilderProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly editingId: string | null;
}

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

  const moveStep = (from: number, to: number): void => {
    if (to < 0 || to >= steps.length || from === to) return;
    const next = [...steps];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setSteps(next);
    setSelectedStepIndex(to);
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
        <VStack gap="5">
          <FormGroup label="Mode name" htmlFor={titleId}>
            <Input
              id={titleId}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Shadowing"
              maxLength={50}
              size="sm"
              data-cell-id="builder-title-input"
            />
          </FormGroup>
          {error && (
            <p className={styles.builderError} role="alert">
              {error}
            </p>
          )}

          <VStack gap="3">
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
              onReorder={moveStep}
            />

            {selectedStep && (
              <StepEditor
                index={selectedStepIndex}
                step={selectedStep}
                onChange={(s) => updateStep(selectedStepIndex, s)}
                onRemove={steps.length > 1 ? () => removeStep(selectedStepIndex) : undefined}
              />
            )}
          </VStack>
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
