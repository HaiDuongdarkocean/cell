import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { Heading, Text, Button, Chip, Checkbox, HStack, VStack, Toggle, Dialog, Icon, SelectableCard, SliderRow } from '@/shared/ui';
import { t, type MessageKey } from '@/shared/i18n';
import { loadStudyModeState, useStudyModeStore } from '../studyModeStore';
import { findActiveMode } from '../lib/findActiveMode';
import { CustomModeBuilder } from './CustomModeBuilder';
import { CleanupRulesSection } from './CleanupRulesSection';
import { DEFAULT_CLEANUP_RULES_SETTING } from '@/entities/studyMode';
import { PRESETS } from '@/entities/studyMode';
import type { StudyMode, StudyModeAdvancedSettings } from '@/entities/studyMode';
import { formatModeDescription } from '../lib/formatStepSummary';
import styles from './StudyModesTab.module.css';

const SKIP_OPTIONS: StudyModeAdvancedSettings['skipNoDialogue'][] = ['OFF', '2X', '4X', '6X', '8X', 'JUMP'];
const SKIP_LABELS: Record<StudyModeAdvancedSettings['skipNoDialogue'], MessageKey> = {
  OFF: 'studyModes.advanced.skip.off',
  '2X': 'studyModes.advanced.skip.2x',
  '4X': 'studyModes.advanced.skip.4x',
  '6X': 'studyModes.advanced.skip.6x',
  '8X': 'studyModes.advanced.skip.8x',
  JUMP: 'studyModes.advanced.skip.jump',
};
const PAUSE_UNKNOWN_OPTIONS: StudyModeAdvancedSettings['pauseOnUnknown'][] = ['OFF', 'START', 'END'];
const PAUSE_UNKNOWN_LABELS: Record<StudyModeAdvancedSettings['pauseOnUnknown'], MessageKey> = {
  OFF: 'studyModes.advanced.pauseUnknown.off',
  START: 'studyModes.advanced.pauseUnknown.start',
  END: 'studyModes.advanced.pauseUnknown.end',
};
const UNKNOWN_LEVEL_OPTIONS: StudyModeAdvancedSettings['unknownLevel'][] = ['core', 'common', 'general', 'advanced'];
const UNKNOWN_LEVEL_LABELS: Record<StudyModeAdvancedSettings['unknownLevel'], MessageKey> = {
  core: 'studyModes.advanced.unknownLevel.core',
  common: 'studyModes.advanced.unknownLevel.common',
  general: 'studyModes.advanced.unknownLevel.general',
  advanced: 'studyModes.advanced.unknownLevel.advanced',
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
        <Text color="secondary">{t('studyModes.loading')}</Text>
      </div>
    );
  }

  return (
    <div className={styles.tab} data-cell-id="study-modes-tab">
      <VStack gap="3">
        <header>
          <HStack justify="between" align="center" className={styles.tabHeaderInner}>
            <Heading level={2} size={2} className={styles.tabTitle}>
              {t('studyModes.title')}
            </Heading>
            <HStack gap="2" align="center" className={styles.advancedToggle}>
              <Text variant="label" color="secondary" as="span">
                {t('studyModes.advancedToggle.label')}
              </Text>
              <Toggle
                checked={advancedOpen}
                onChange={setAdvancedOpen}
                ariaLabel={t('studyModes.advancedToggle.aria')}
                dataTestId="advanced-toggle"
              />
            </HStack>
          </HStack>
        </header>

        <section>
          <Heading level={3} size={3} className={styles.blockHeading}>
            {t('studyModes.presets.heading')}
          </Heading>
          <div className={styles.grid} role="radiogroup" aria-label={t('studyModes.presets.groupAria')}>
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

        <section>
          <HStack justify="between" align="center" className={styles.sectionHeader}>
            <Heading level={3} size={3} className={styles.sectionHeading}>
              {t('studyModes.custom.heading')}
            </Heading>
            <Button size="sm" onClick={handleNewMode} data-cell-id="new-mode-button" leadingIcon={<Icon name="plus" size="xs" />}>
              {t('studyModes.custom.newMode')}
            </Button>
          </HStack>
          {store.customModes.length > 0 ? (
            <div className={styles.grid} role="group" aria-label={t('studyModes.custom.groupAria')}>
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
          ) : (
            <Text color="secondary" as="p" variant="supporting">
              {t('studyModes.custom.empty')}
            </Text>
          )}
        </section>

        {advancedOpen && (
          <AdvancedSection advanced={store.advanced} onChange={handleAdvancedChange} />
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
        title={t('studyModes.deleteDialog.title')}
        description={t('studyModes.deleteDialog.description')}
        data-cell-id="delete-confirm-dialog"
        footer={
          <HStack gap="3" justify="end">
            <Button variant="ghost" size="sm" onClick={handleCancelDelete} data-cell-id="delete-confirm-cancel">
              {t('studyModes.deleteDialog.cancel')}
            </Button>
            <Button variant="destructive" size="sm" onClick={handleConfirmDelete} data-cell-id="delete-confirm-ok">
              {t('studyModes.deleteDialog.confirm')}
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
  const title = mode.titleKey ? t(mode.titleKey) : mode.title;
  const description = mode.descriptionKey
    ? t(mode.descriptionKey)
    : formatModeDescription(mode, t);

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
          {title}
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
            {t('studyModes.card.edit')}
          </Button>
          <Button
            size="xs"
            variant="ghost"
            onClick={() => onDelete?.(mode)}
            data-cell-id={`delete-mode-${mode.id}`}
            leadingIcon={<Icon name="trash" size="xs" />}
          >
            {t('studyModes.card.delete')}
          </Button>
        </HStack>
      )}
    </div>
  );
}

interface AdvancedSectionProps {
  readonly advanced: StudyModeAdvancedSettings;
  readonly onChange: (advanced: StudyModeAdvancedSettings) => void;
}

function AdvancedSection({ advanced, onChange }: AdvancedSectionProps): ReactElement {
  return (
    <div className={styles.advancedSection} data-cell-id="advanced-settings">
      <Heading level={3} size={3} className={styles.blockHeading}>
        {t('studyModes.advancedToggle.label')}
      </Heading>
      <VStack gap="4">
        <div>
          <Text as="p" className={styles.advancedLabel}>
            {t('studyModes.advanced.skip.label')}
          </Text>
          <HStack
            gap="2"
            className={styles.chipRow}
            role="group"
            aria-label={t('studyModes.advanced.skip.aria')}
          >
            {SKIP_OPTIONS.map((option) => (
              <Chip
                key={option}
                as="button"
                selected={advanced.skipNoDialogue === option}
                onClick={() => onChange({ ...advanced, skipNoDialogue: option })}
                data-cell-id={`skip-no-dialogue-${option}`}
              >
                {t(SKIP_LABELS[option])}
              </Chip>
            ))}
          </HStack>
        </div>
        <SliderRow
          icon={<Icon name="clock" size="sm" />}
          label={t('cleanup.leadIn.label')}
          hint={t('cleanup.leadIn.hint')}
          value={advanced.cueLeadInMs ?? 0}
          min={0}
          max={2000}
          step={50}
          onChange={(cueLeadInMs) => onChange({ ...advanced, cueLeadInMs })}
          aria-label={t('cleanup.leadIn.aria')}
          formatValue={(v) => t('cleanup.leadIn.value', [v])}
        />
        <div>
          <Text as="p" className={styles.advancedLabel}>
            {t('studyModes.advanced.pauseUnknown.label')}
          </Text>
          <HStack
            gap="2"
            className={styles.chipRow}
            role="group"
            aria-label={t('studyModes.advanced.pauseUnknown.aria')}
          >
            {PAUSE_UNKNOWN_OPTIONS.map((option) => (
              <Chip
                key={option}
                as="button"
                selected={advanced.pauseOnUnknown === option}
                onClick={() => onChange({ ...advanced, pauseOnUnknown: option })}
                data-cell-id={`pause-on-unknown-${option}`}
              >
                {t(PAUSE_UNKNOWN_LABELS[option])}
              </Chip>
            ))}
          </HStack>
        </div>
        {advanced.pauseOnUnknown !== 'OFF' && (
          <>
            <div>
              <Text as="p" className={styles.advancedLabel}>
                {t('studyModes.advanced.unknownLevel.label')}
              </Text>
              <HStack
                gap="2"
                className={styles.chipRow}
                role="group"
                aria-label={t('studyModes.advanced.unknownLevel.aria')}
              >
                {UNKNOWN_LEVEL_OPTIONS.map((option) => (
                  <Chip
                    key={option}
                    as="button"
                    selected={advanced.unknownLevel === option}
                    onClick={() => onChange({ ...advanced, unknownLevel: option })}
                    data-cell-id={`unknown-level-${option}`}
                  >
                    {t(UNKNOWN_LEVEL_LABELS[option])}
                  </Chip>
                ))}
              </HStack>
            </div>
            <Checkbox
              label={t('studyModes.advanced.popupOnAutoPause')}
              checked={advanced.popupOnAutoPause}
              onChange={(e) => onChange({ ...advanced, popupOnAutoPause: e.target.checked })}
              data-cell-id="popup-on-autopause-checkbox"
            />
            {advanced.popupOnAutoPause && (
              <Checkbox
                label={t('studyModes.advanced.popupCloseOnResume')}
                checked={advanced.popupCloseOnResume}
                onChange={(e) => onChange({ ...advanced, popupCloseOnResume: e.target.checked })}
                data-cell-id="popup-close-on-resume-checkbox"
              />
            )}
          </>
        )}
        <div className={styles.cleanupBlock}>
          <CleanupRulesSection
            setting={advanced.cleanupRules ?? DEFAULT_CLEANUP_RULES_SETTING}
            onChange={(cleanupRules) => onChange({ ...advanced, cleanupRules })}
          />
        </div>
      </VStack>
    </div>
  );
}
