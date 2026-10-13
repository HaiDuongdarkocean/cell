import { useEffect, useId, useMemo, useRef, useState, type ReactElement } from 'react';
import { Heading, Button, HStack, VStack, FormGroup, Dialog } from '@/shared/ui';
import { BottomSheet } from '@/shared/ui/BottomSheet';
import { Input } from '@/shared/ui/Input';
import { useStudyModeStore } from '../studyModeStore';
import { t } from '@/shared/i18n';
import { validateModeName } from '../lib/validateModeName';
import type { MessageKey } from '@/shared/i18n';
import type { StudyStep } from '@/entities/studyMode';
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
  const descId = useId();
  const isNew = editingId === null;
  const initial = useMemo(() => {
    if (editingId) {
      const existing = store.customModes.find((m) => m.id === editingId);
      if (existing)
        return {
          title: existing.title,
          description: existing.description,
          steps: existing.steps.map((s) => ({ ...s })),
        };
    }
    return { title: '', description: '', steps: [{ ...EMPTY_STEP }] };
  }, [editingId, store.customModes]);

  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [steps, setSteps] = useState<StudyStep[]>(initial.steps);
  const [errorKey, setErrorKey] = useState<MessageKey | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [selectedStepIndex, setSelectedStepIndex] = useState(0);

  const isDirty =
    title.trim() !== initial.title ||
    description !== initial.description ||
    JSON.stringify(steps) !== JSON.stringify(initial.steps);

  const prevOpen = useRef(false);
  useEffect(() => {
    const justOpened = open && !prevOpen.current;
    prevOpen.current = open;
    if (justOpened) {
      setTitle(initial.title);
      setDescription(initial.description);
      setSteps(initial.steps);
      setErrorKey(null);
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
      setErrorKey(validation.errorKey ?? 'studyModes.builder.errorNameRequired');
      return;
    }
    if (steps.length === 0) {
      setErrorKey('studyModes.builder.errorNoSteps');
      return;
    }

    if (isNew) {
      useStudyModeStore.getState().createCustomMode(trimmedTitle, steps, description);
    } else {
      useStudyModeStore.getState().updateCustomMode(editingId, { title: trimmedTitle, description, steps });
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
        title={isNew ? t('studyModes.builder.titleNew') : t('studyModes.builder.titleEdit')}
        hideDragHandle
        data-tihoka-id="custom-mode-builder"
        footer={
          <HStack gap="3" justify="between" className={styles.builderFooter}>
            {!isNew && (
              <Button variant="destructive" size="sm" onClick={handleDeleteMode} data-tihoka-id="builder-delete">
                {t('studyModes.builder.delete')}
              </Button>
            )}
            <HStack gap="3" className={styles.builderFooterRight}>
              <Button variant="ghost" size="sm" onClick={handleCloseAttempt} data-tihoka-id="builder-cancel">
                {t('studyModes.builder.cancel')}
              </Button>
              <Button size="sm" onClick={handleSave} data-tihoka-id="builder-save">
                {t('studyModes.builder.save')}
              </Button>
            </HStack>
          </HStack>
        }
      >
        <VStack gap="4">
          <FormGroup label={t('studyModes.builder.nameLabel')} htmlFor={titleId}>
            <Input
              id={titleId}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('studyModes.builder.namePlaceholder')}
              maxLength={50}
              data-tihoka-id="builder-title-input"
            />
          </FormGroup>
          <FormGroup label={t('studyModes.builder.descLabel')} htmlFor={descId}>
            <Input
              id={descId}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('studyModes.builder.descPlaceholder')}
              maxLength={120}
              data-tihoka-id="builder-desc-input"
            />
          </FormGroup>
          {errorKey && (
            <p className={styles.builderError} role="alert">
              {t(errorKey)}
            </p>
          )}

          <div>
            <Heading level={3} size={4} className={styles.sectionHeading}>
              {t('studyModes.builder.steps')}
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
          </div>
        </VStack>
      </BottomSheet>

      {discardOpen && (
        <Dialog
          open={discardOpen}
          onOpenChange={setDiscardOpen}
          title={t('studyModes.builder.discardTitle')}
          description={t('studyModes.builder.discardDesc')}
          data-tihoka-id="builder-discard-dialog"
          footer={
            <HStack gap="3" justify="end">
              <Button variant="ghost" size="sm" onClick={() => setDiscardOpen(false)} data-tihoka-id="builder-discard-cancel">
                {t('studyModes.builder.cancel')}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => { setDiscardOpen(false); onOpenChange(false); }}
                data-tihoka-id="builder-discard-ok"
              >
                {t('studyModes.builder.discardConfirm')}
              </Button>
            </HStack>
          }
        />
      )}
    </>
  );
}
