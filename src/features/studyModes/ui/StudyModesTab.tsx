import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { Heading, Text, Button, Card, Chip, Checkbox, HStack, VStack, Toggle, Dialog, Icon, SelectableCard } from '@/shared/ui';
import { loadStudyModeState, useStudyModeStore } from '../studyModeStore';
import { findActiveMode } from '../lib/findActiveMode';
import { CustomModeBuilder } from './CustomModeBuilder';
import { PRESETS } from '@/entities/studyMode';
import type { StudyMode, StudyModeAdvancedSettings } from '@/entities/studyMode';
import { formatModeDescription } from '../lib/formatStepSummary';
import styles from './StudyModesTab.module.css';

const SKIP_OPTIONS: StudyModeAdvancedSettings['skipNoDialogue'][] = ['OFF', '2X', '4X', '6X', '8X', 'JUMP'];
const PAUSE_UNKNOWN_OPTIONS: StudyModeAdvancedSettings['pauseOnUnknown'][] = ['OFF', 'START', 'END'];
const PAUSE_UNKNOWN_LABELS: Record<StudyModeAdvancedSettings['pauseOnUnknown'], string> = {
  OFF: 'Off',
  START: 'Cue start',
  END: 'Cue end',
};
const UNKNOWN_LEVEL_OPTIONS: StudyModeAdvancedSettings['unknownLevel'][] = ['core', 'common', 'general', 'advanced'];
const UNKNOWN_LEVEL_LABELS: Record<StudyModeAdvancedSettings['unknownLevel'], string> = {
  core: 'Core',
  common: 'Common',
  general: 'General',
  advanced: 'Advanced',
};

export function StudyModesTab(): ReactElement {
  useEffect(() => {
    void loadStudyModeState();
  }, []);

  const store = useStudyModeStore();
  const activeMode = useMemo(() => findActiveMode(store), [store]);

  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const advancedOpen = store.advancedOpen;
  const setAdvancedOpen = store.setAdvancedOpen;
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Derived active mode and custom list are enough; selections map directly.

  const handleSelect = (mode: StudyMode): void => {
    useStudyModeStore.getState().setActiveModeId(mode.id);
  };

  const handleNewMode = (): void => {
    setEditingId(null);
    setBuilderOpen(true);
  };

  const handleEditMode = (mode: StudyMode): void => {
    setEditingId(mode.id);
    setBuilderOpen(true);
  };

  const handleDeleteMode = (mode: StudyMode): void => {
    setDeleteConfirmId(mode.id);
  };

  const handleConfirmDelete = (): void => {
    if (deleteConfirmId) {
      useStudyModeStore.getState().deleteCustomMode(deleteConfirmId);
    }
    setDeleteConfirmId(null);
  };

  const handleCancelDelete = (): void => {
    setDeleteConfirmId(null);
  };

  const handleAdvancedChange = (advanced: StudyModeAdvancedSettings): void => {
    useStudyModeStore.getState().setAdvanced(advanced);
  };

  if (!store.isLoaded) {
    return (
      <div className={styles.tab} data-cell-id="study-modes-tab">
        <Text color="secondary">Loading study modes…</Text>
      </div>
    );
  }

  return (
    <div className={styles.tab} data-cell-id="study-modes-tab">
      <VStack gap="5">
        <header className={styles.tabHeader}>
          <HStack justify="between" align="center" className={styles.tabHeaderInner}>
            <Heading level={2} size={2} className={styles.tabTitle}>
              Study Modes
            </Heading>
            <HStack gap="2" align="center" className={styles.advancedToggle}>
              <Text variant="label" color="secondary" as="span">
                Advanced
              </Text>
              <Toggle
                checked={advancedOpen}
                onChange={setAdvancedOpen}
                ariaLabel="Show advanced study settings"
                dataTestId="advanced-toggle"
              />
            </HStack>
          </HStack>
        </header>

        <section className={styles.section}>
          <Text variant="label" color="secondary" as="span" className={styles.eyebrow}>
            Playback settings
          </Text>
          <Heading level={3} size={3} className={styles.sectionHeading}>
            Play mode
          </Heading>
          <div className={styles.grid} role="radiogroup" aria-label="Preset study modes">
            {PRESETS.map((mode) => (
              <ModeCard
                key={mode.id}
                mode={mode}
                selected={activeMode.id === mode.id}
                onSelect={handleSelect}
              />
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <HStack justify="between" align="center" className={styles.sectionHeader}>
            <div>
              <Text variant="label" color="secondary" as="span" className={styles.eyebrow}>
                Your combinations
              </Text>
              <Heading level={3} size={3} className={styles.sectionHeading}>
                Custom
              </Heading>
            </div>
            <Button size="sm" onClick={handleNewMode} data-cell-id="new-mode-button" leadingIcon={<Icon name="plus" size="xs" />}>
              New mode
            </Button>
          </HStack>
          <div className={styles.grid} role="group" aria-label="Custom study modes">
            {store.customModes.map((mode) => (
              <ModeCard
                key={mode.id}
                mode={mode}
                selected={activeMode.id === mode.id}
                onSelect={handleSelect}
                onEdit={handleEditMode}
                onDelete={handleDeleteMode}
              />
            ))}
          </div>
        </section>

        {advancedOpen && (
          <AdvancedSection
            advanced={store.advanced}
            modeUsesAdaptive={activeMode.steps.some((step) => step.subtitle === 'adaptive')}
            onChange={handleAdvancedChange}
          />
        )}
      </VStack>

      <CustomModeBuilder
        open={builderOpen}
        onOpenChange={setBuilderOpen}
        editingId={editingId}
      />

      <Dialog
        open={deleteConfirmId !== null}
        onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}
        title="Delete custom mode?"
        description="This action cannot be undone."
        data-cell-id="delete-confirm-dialog"
        footer={
          <HStack gap="3" justify="end">
            <Button variant="ghost" size="sm" onClick={handleCancelDelete} data-cell-id="delete-confirm-cancel">
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={handleConfirmDelete} data-cell-id="delete-confirm-ok">
              Delete
            </Button>
          </HStack>
        }
      />
    </div>
  );
}

interface ModeCardProps {
  readonly mode: StudyMode;
  readonly selected: boolean;
  readonly onSelect: (mode: StudyMode) => void;
  readonly onEdit?: (mode: StudyMode) => void;
  readonly onDelete?: (mode: StudyMode) => void;
}

function ModeCard({ mode, selected, onSelect, onEdit, onDelete }: ModeCardProps): ReactElement {
  const isCustom = mode.type === 'custom';
  const description = useMemo(
    () => (mode.description ? mode.description : formatModeDescription(mode)),
    [mode],
  );

  return (
    <div className={styles.modeCardWrapper}>
      <SelectableCard
        selected={selected}
        role="radio"
        className={styles.modeCard}
        onSelect={() => onSelect(mode)}
        data-cell-id={`mode-card-${mode.id}`}
      >
        <Icon name={mode.icon} size="lg" className={styles.modeIcon} />
        <Text variant="heading-3" as="p" className={styles.modeTitle}>
          {mode.title}
        </Text>
        <Text color="secondary" as="p" className={styles.modeDesc}>
          {description}
        </Text>
      </SelectableCard>
      {isCustom && (
        <HStack gap="2" className={styles.modeActions}>
          <Button
            size="xs"
            variant="ghost"
            onClick={() => onEdit?.(mode)}
            data-cell-id={`edit-mode-${mode.id}`}
            leadingIcon={<Icon name="pencil" size="xs" />}
          >
            Edit
          </Button>
          <Button
            size="xs"
            variant="ghost"
            onClick={() => onDelete?.(mode)}
            data-cell-id={`delete-mode-${mode.id}`}
            leadingIcon={<Icon name="trash" size="xs" />}
          >
            Delete
          </Button>
        </HStack>
      )}
    </div>
  );
}

interface AdvancedSectionProps {
  readonly advanced: StudyModeAdvancedSettings;
  readonly modeUsesAdaptive: boolean;
  readonly onChange: (advanced: StudyModeAdvancedSettings) => void;
}

function AdvancedSection({ advanced, modeUsesAdaptive, onChange }: AdvancedSectionProps): ReactElement {
  return (
    <Card className={styles.advancedCard} data-cell-id="advanced-settings">
      <Heading level={3} size={3} className={styles.sectionHeading}>
        Advanced
      </Heading>
      <VStack gap="4">
        <div>
          <Text as="p" className={styles.advancedLabel}>
            Skip when there is no dialogue
          </Text>
          <HStack
            gap="2"
            className={styles.chipRow}
            role="group"
            aria-label="Skip scenes with no dialogue"
          >
            {SKIP_OPTIONS.map((option) => (
              <Chip
                key={option}
                as="button"
                selected={advanced.skipNoDialogue === option}
                onClick={() => onChange({ ...advanced, skipNoDialogue: option })}
                data-cell-id={`skip-no-dialogue-${option}`}
              >
                {option}
              </Chip>
            ))}
          </HStack>
        </div>
        <Checkbox
          label="Remove text in brackets ( ), [ ], { } from target subtitle"
          checked={advanced.removeBracketed}
          onChange={(e) => onChange({ ...advanced, removeBracketed: e.target.checked })}
          data-cell-id="remove-bracketed-checkbox"
        />
        <div>
          <Text as="p" className={styles.advancedLabel}>
            Pause when a cue has an unknown word
          </Text>
          <HStack
            gap="2"
            className={styles.chipRow}
            role="group"
            aria-label="Pause on unknown word"
          >
            {PAUSE_UNKNOWN_OPTIONS.map((option) => (
              <Chip
                key={option}
                as="button"
                selected={advanced.pauseOnUnknown === option}
                onClick={() => onChange({ ...advanced, pauseOnUnknown: option })}
                data-cell-id={`pause-on-unknown-${option}`}
              >
                {PAUSE_UNKNOWN_LABELS[option]}
              </Chip>
            ))}
          </HStack>
        </div>
        {(advanced.pauseOnUnknown !== 'OFF' || modeUsesAdaptive) && (
          <>
            <div>
              <Text as="p" className={styles.advancedLabel}>
                {advanced.pauseOnUnknown !== 'OFF'
                  ? 'Pause on words up to frequency level'
                  : 'Words up to frequency level count as difficult'}
              </Text>
              <HStack
                gap="2"
                className={styles.chipRow}
                role="group"
                aria-label="Unknown word frequency level"
              >
                {UNKNOWN_LEVEL_OPTIONS.map((option) => (
                  <Chip
                    key={option}
                    as="button"
                    selected={advanced.unknownLevel === option}
                    onClick={() => onChange({ ...advanced, unknownLevel: option })}
                    data-cell-id={`unknown-level-${option}`}
                  >
                    {UNKNOWN_LEVEL_LABELS[option]}
                  </Chip>
                ))}
              </HStack>
            </div>
            <Checkbox
              label="Open dictionary popup when auto-paused"
              checked={advanced.popupOnAutoPause}
              onChange={(e) => onChange({ ...advanced, popupOnAutoPause: e.target.checked })}
              data-cell-id="popup-on-autopause-checkbox"
            />
            {advanced.popupOnAutoPause && (
              <Checkbox
                label="Close popup when playback resumes"
                checked={advanced.popupCloseOnResume}
                onChange={(e) => onChange({ ...advanced, popupCloseOnResume: e.target.checked })}
                data-cell-id="popup-close-on-resume-checkbox"
              />
            )}
          </>
        )}
      </VStack>
    </Card>
  );
}
