import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import {
  Heading,
  Text,
  Button,
  Checkbox,
  HStack,
  VStack,
  Toggle,
  Dialog,
  Icon,
  Menu,
  MenuItem,
  SegmentedControl,
  SelectableCard,
  SliderRow,
  VisuallyHidden,
} from '@/shared/ui';
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

const SKIP_OPTIONS: StudyModeAdvancedSettings['skipNoDialogue'][] = [
  'OFF',
  '2X',
  '4X',
  '6X',
  '8X',
  'JUMP',
];
const SKIP_LABELS: Record<StudyModeAdvancedSettings['skipNoDialogue'], MessageKey> = {
  OFF: 'studyModes.advanced.skip.off',
  '2X': 'studyModes.advanced.skip.2x',
  '4X': 'studyModes.advanced.skip.4x',
  '6X': 'studyModes.advanced.skip.6x',
  '8X': 'studyModes.advanced.skip.8x',
  JUMP: 'studyModes.advanced.skip.jump',
};
const PAUSE_UNKNOWN_OPTIONS: StudyModeAdvancedSettings['pauseOnUnknown'][] = [
  'OFF',
  'START',
  'END',
];
const PAUSE_UNKNOWN_LABELS: Record<StudyModeAdvancedSettings['pauseOnUnknown'], MessageKey> = {
  OFF: 'studyModes.advanced.pauseUnknown.off',
  START: 'studyModes.advanced.pauseUnknown.start',
  END: 'studyModes.advanced.pauseUnknown.end',
};
const UNKNOWN_LEVEL_OPTIONS: StudyModeAdvancedSettings['unknownLevel'][] = [
  'core',
  'common',
  'general',
  'advanced',
];
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
        <section>
          <Heading level={3} size={3} className={styles.blockHeading}>
            {t('studyModes.presets.heading')}
          </Heading>
          <div
            className={styles.grid}
            role="radiogroup"
            aria-label={t('studyModes.presets.groupAria')}
          >
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
            <Button
              size="sm"
              onClick={handleNewMode}
              data-cell-id="new-mode-button"
              leadingIcon={<Icon name="plus" size="xs" />}
            >
              {t('studyModes.custom.newMode')}
            </Button>
          </HStack>
          {store.customModes.length > 0 ? (
            <div className={styles.grid} role="radiogroup" aria-label={t('studyModes.custom.groupAria')}>
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

        <AdvancedSection
          advanced={store.advanced}
          open={advancedOpen}
          onOpenChange={setAdvancedOpen}
          onChange={handleAdvancedChange}
        />
      </VStack>

      <CustomModeBuilder open={builderOpen} onOpenChange={setBuilderOpen} editingId={editingId} />

      <Dialog
        open={deleteConfirmId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirmId(null);
        }}
        title={t('studyModes.deleteDialog.title')}
        description={t('studyModes.deleteDialog.description')}
        data-cell-id="delete-confirm-dialog"
        footer={
          <HStack gap="3" justify="end">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancelDelete}
              data-cell-id="delete-confirm-cancel"
            >
              {t('studyModes.deleteDialog.cancel')}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmDelete}
              data-cell-id="delete-confirm-ok"
            >
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
  const description = mode.descriptionKey ? t(mode.descriptionKey) : formatModeDescription(mode, t);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);

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
        <>
          <Button
            ref={menuTriggerRef}
            variant="ghost"
            size="xs"
            shape="circle"
            className={styles.modeMenuTrigger}
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            aria-label={t('studyModes.card.actions')}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            data-cell-id={`mode-actions-${mode.id}`}
          >
            <Icon name="ellipsisVertical" size="sm" />
          </Button>
          <Menu
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            triggerRef={menuTriggerRef}
            align="right"
            ariaLabel={t('studyModes.card.actions')}
          >
            <MenuItem
              data-cell-id={`edit-mode-${mode.id}`}
              icon={<Icon name="pencil" size="sm" />}
              onSelect={() => {
                setMenuOpen(false);
                onEdit?.(mode);
              }}
            >
              {t('studyModes.card.edit')}
            </MenuItem>
            <MenuItem
              data-cell-id={`delete-mode-${mode.id}`}
              icon={<Icon name="trash" size="sm" />}
              onSelect={() => {
                setMenuOpen(false);
                onDelete?.(mode);
              }}
            >
              {t('studyModes.card.delete')}
            </MenuItem>
          </Menu>
        </>
      )}
    </div>
  );
}

interface AdvancedSectionProps {
  readonly advanced: StudyModeAdvancedSettings;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onChange: (advanced: StudyModeAdvancedSettings) => void;
}

function AdvancedSection({
  advanced,
  open,
  onOpenChange,
  onChange,
}: AdvancedSectionProps): ReactElement {
  return (
    <section className={styles.advancedSection}>
      <HStack justify="between" align="center">
        <Heading level={3} size={3} className={styles.sectionHeading}>
          {t('studyModes.advancedToggle.label')}
        </Heading>
        <Toggle
          checked={open}
          onChange={onOpenChange}
          ariaLabel={t('studyModes.advancedToggle.aria')}
          ariaControls="advanced-settings-region"
          ariaDescribedby="advanced-settings-toggle-hint"
          dataTestId="advanced-toggle"
        />
      </HStack>
      <VisuallyHidden id="advanced-settings-toggle-hint">
        {t('studyModes.advancedToggle.hint')}
      </VisuallyHidden>
      <VStack
        gap="4"
        id="advanced-settings-region"
        role="region"
        aria-label={t('studyModes.advancedToggle.regionAria')}
        data-cell-id="advanced-settings"
        hidden={!open}
      >
          <SegmentedField
            label={t('studyModes.advanced.skip.label')}
            groupAria={t('studyModes.advanced.skip.aria')}
            options={SKIP_OPTIONS}
            optionLabels={SKIP_LABELS}
            value={advanced.skipNoDialogue}
            onSelect={(skipNoDialogue) => onChange({ ...advanced, skipNoDialogue })}
            testIdPrefix="skip-no-dialogue"
          />
          <SliderRow
            className={styles.sliderFlush}
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
          <SegmentedField
            label={t('studyModes.advanced.pauseUnknown.label')}
            groupAria={t('studyModes.advanced.pauseUnknown.aria')}
            options={PAUSE_UNKNOWN_OPTIONS}
            optionLabels={PAUSE_UNKNOWN_LABELS}
            value={advanced.pauseOnUnknown}
            onSelect={(pauseOnUnknown) => onChange({ ...advanced, pauseOnUnknown })}
            testIdPrefix="pause-on-unknown"
          />
          {advanced.pauseOnUnknown !== 'OFF' && (
            <>
              <SegmentedField
                label={t('studyModes.advanced.unknownLevel.label')}
                groupAria={t('studyModes.advanced.unknownLevel.aria')}
                options={UNKNOWN_LEVEL_OPTIONS}
                optionLabels={UNKNOWN_LEVEL_LABELS}
                value={advanced.unknownLevel}
                onSelect={(unknownLevel) => onChange({ ...advanced, unknownLevel })}
                testIdPrefix="unknown-level"
              />
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
    </section>
  );
}

interface SegmentedControlProps<T extends string> {
  readonly label: string;
  readonly groupAria: string;
  readonly options: readonly T[];
  readonly optionLabels: Record<T, MessageKey>;
  readonly value: T;
  readonly onSelect: (value: T) => void;
  readonly testIdPrefix: string;
}

function SegmentedField<T extends string>({
  label,
  groupAria,
  options,
  optionLabels,
  value,
  onSelect,
  testIdPrefix,
}: SegmentedControlProps<T>): ReactElement {
  return (
    <div>
      <Text as="p" className={styles.advancedLabel}>
        {label}
      </Text>
      <SegmentedControl
        variant="accent"
        ariaLabel={groupAria}
        options={options.map((option) => ({
          value: option,
          label: t(optionLabels[option]),
          testId: `${testIdPrefix}-${option}`,
        }))}
        value={value}
        onChange={onSelect}
      />
    </div>
  );
}
