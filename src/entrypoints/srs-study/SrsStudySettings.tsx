import { useEffect, useState } from 'react';
import { Box, Button, Heading, SegmentedControl, Select, Text, Toggle } from '@/shared/ui';
import { Icon } from '@/shared/ui/Icon';
import { t } from '@/shared/i18n';
import { useSrsUiPrefs, setSrsUiPrefs, resetSrsUiPrefs } from '@/features/srs/ui/srsUiPrefs';
import { SrsVariantsPanel } from '@/features/srs/ui/SrsVariantsPanel';
import { getReminderState } from '@/features/srs/services/reminderState';
import { getNotificationPermissionLevel } from '@/shared/lib/chrome-apis';
import { loadSettings, saveSettings } from '@/shared/lib/storage/settingsStore';
import type { SrsSettingsSlice } from '@/entities/settings';
import { UserCssPanel } from './UserCssPanel';
import styles from './SrsStudySettings.module.css';

interface RowProps {
  readonly label: string;
  readonly description?: string;
  readonly children: React.ReactNode;
}

function SettingRow({ label, description, children }: RowProps): React.JSX.Element {
  return (
    <Box className={styles.row}>
      <Box className={styles.rowText}>
        <Text className={styles.rowLabel}>{label}</Text>
        {description && <Text className={styles.rowDesc}>{description}</Text>}
      </Box>
      {children}
    </Box>
  );
}

function Section({ title, children }: { readonly title: string; readonly children: React.ReactNode }): React.JSX.Element {
  return (
    <Box className={styles.section}>
      <Heading level={3} className={styles.sectionTitle}>{title}</Heading>
      {children}
    </Box>
  );
}

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => ({
  value: String(h),
  label: `${String(h).padStart(2, '0')}:00`,
}));

function ReminderSection(): React.JSX.Element | null {
  const [srs, setSrs] = useState<SrsSettingsSlice | null>(null);
  const [permission, setPermission] = useState<string>('denied');
  const [learnedHour, setLearnedHour] = useState<number | null>(null);

  useEffect(() => {
    void loadSettings().then((s) => setSrs(s.srs));
    void getNotificationPermissionLevel().then(setPermission);
    void getReminderState().then((state) => setLearnedHour(state.learnedHour));
  }, []);

  if (!srs) return null;
  const reminder = srs.reminder;

  const saveReminder = async (patch: Partial<SrsSettingsSlice['reminder']>): Promise<void> => {
    const next = { ...srs, reminder: { ...reminder, ...patch } };
    setSrs(next);
    await saveSettings({ srs: next });
  };

  const requestPermission = async (): Promise<boolean> => {
    const granted = await chrome.permissions.request({ permissions: ['notifications'] });
    setPermission(await getNotificationPermissionLevel());
    return granted;
  };

  const onToggle = (enabled: boolean): void => {
    if (enabled && permission !== 'granted') void requestPermission();
    void saveReminder({ enabled });
  };

  const hourLabel = (h: number): string => `${String(h).padStart(2, '0')}:00`;
  const effectiveHour = learnedHour ?? reminder.preferredHour;
  const blocked = reminder.enabled && permission !== 'granted';

  return (
    <Section title={t('srs.settings.reminder')}>
      <SettingRow label={t('srs.settings.reminderEnable')} description={t('srs.settings.reminderEnableDesc')}>
        <Toggle checked={reminder.enabled} onChange={onToggle} ariaLabel={t('srs.settings.reminderEnable')} size="xs" />
      </SettingRow>
      {reminder.enabled && (
        <>
          <SettingRow label={t('srs.settings.reminderHour')}>
            <Select
              className={styles.pillSelect}
              value={String(reminder.preferredHour)}
              options={HOUR_OPTIONS}
              onChange={(v) => { void saveReminder({ preferredHour: Number(v) }); }}
              aria-label={t('srs.settings.reminderHour')}
            />
          </SettingRow>
          {blocked ? (
            <div className={styles.reminderBlocked} role="alert">
              <Icon name="triangleAlert" />
              <Text className={styles.reminderBlockedText}>{t('srs.settings.reminderBlocked')}</Text>
              <Button variant="ghost" size="sm" onClick={() => { void requestPermission(); }}>
                {t('srs.settings.reminderRetry')}
              </Button>
            </div>
          ) : (
            <Text className={styles.reminderStatus}>
              {learnedHour !== null
                ? t('srs.settings.reminderLearned', [hourLabel(effectiveHour)])
                : t('srs.settings.reminderScheduled', [hourLabel(effectiveHour)])}
            </Text>
          )}
        </>
      )}
    </Section>
  );
}

export interface SrsStudySettingsProps {
  readonly onClose: () => void;
}

export function SrsStudySettings({ onClose }: SrsStudySettingsProps): React.JSX.Element {
  const prefs = useSrsUiPrefs();
  const [tab, setTab] = useState<'general' | 'variants' | 'customize'>('general');

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={t('srs.settings.title')}>
      <Box className={styles.sheet}>
        <Box className={styles.header}>
          <span />
          <Heading level={2} className={styles.title}>{t('srs.settings.title')}</Heading>
          <Button variant="ghost" size="sm" shape="circle" onClick={onClose} aria-label={t('ui.close')} className={styles.closeButton}>
            <Icon name="x" />
          </Button>
        </Box>

        <SegmentedControl
          variant="filled"
          options={[
            { value: 'general', label: t('srs.settings.tabGeneral') },
            { value: 'variants', label: t('srs.settings.tabVariants') },
            { value: 'customize', label: t('srs.settings.tabCustomize') },
          ]}
          value={tab}
          onChange={setTab}
          ariaLabel={t('srs.settings.title')}
          className={styles.tabs}
        />

        <Box className={styles.body}>
        {tab === 'customize' ? (
          <UserCssPanel />
        ) : tab === 'variants' ? (
          <SrsVariantsPanel />
        ) : (
          <>
            <Section title={t('srs.settings.schedule')}>
              <SettingRow label={t('srs.settings.dayBegins')}>
                <Select
                  className={styles.pillSelect}
                  value={String(prefs.dayStartHour)}
                  options={HOUR_OPTIONS}
                  onChange={(v) => { setSrsUiPrefs({ dayStartHour: Number(v) }); }}
                  aria-label={t('srs.settings.dayBegins')}
                />
              </SettingRow>
              <SettingRow label={t('srs.settings.showSummary')}>
                <Select
                  className={styles.pillSelect}
                  value={prefs.showStudySummary}
                  options={[
                    { value: 'finished', label: t('srs.settings.summaryFinished') },
                    { value: 'always', label: t('srs.settings.summaryAlways') },
                    { value: 'never', label: t('srs.settings.summaryNever') },
                  ]}
                  onChange={(v) => { setSrsUiPrefs({ showStudySummary: v as 'finished' | 'always' | 'never' }); }}
                  aria-label={t('srs.settings.showSummary')}
                />
              </SettingRow>
            </Section>

            <ReminderSection />

            <Section title={t('srs.settings.answering')}>
              <SettingRow label={t('srs.settings.shuffle')}>
                <Toggle checked={prefs.shuffleReviews} onChange={(v) => { setSrsUiPrefs({ shuffleReviews: v }); }} ariaLabel={t('srs.settings.shuffle')} size="xs" />
              </SettingRow>
              <SettingRow label={t('srs.settings.swipe')} description={t('srs.settings.swipeDesc')}>
                <Toggle checked={prefs.swipeToAnswer} onChange={(v) => { setSrsUiPrefs({ swipeToAnswer: v }); }} ariaLabel={t('srs.settings.swipe')} size="xs" />
              </SettingRow>
              <SettingRow label={t('srs.settings.answerFront')}>
                <Toggle checked={prefs.answerFromFront} onChange={(v) => { setSrsUiPrefs({ answerFromFront: v }); }} ariaLabel={t('srs.settings.answerFront')} size="xs" />
              </SettingRow>
              <SettingRow label={t('srs.settings.hideProgress')}>
                <Toggle checked={prefs.hideProgress} onChange={(v) => { setSrsUiPrefs({ hideProgress: v }); }} ariaLabel={t('srs.settings.hideProgress')} size="xs" />
              </SettingRow>
            </Section>

            <Section title={t('srs.settings.studyOrder')}>
              <Text className={styles.sectionDesc}>{t('srs.settings.studyOrderDesc')}</Text>
              <SettingRow label={t('srs.settings.startWith')}>
                <Select
                  className={styles.pillSelect}
                  value={prefs.startWith}
                  options={[
                    { value: 'reviews', label: t('srs.settings.startReviews') },
                    { value: 'new', label: t('srs.settings.startNew') },
                  ]}
                  onChange={(v) => { setSrsUiPrefs({ startWith: v as 'reviews' | 'new' }); }}
                  aria-label={t('srs.settings.startWith')}
                />
              </SettingRow>
            </Section>

            <Section title={t('srs.settings.newCards')}>
              <Text className={styles.sectionDesc}>{t('srs.settings.newCardsDesc')}</Text>
              <SettingRow label={t('srs.settings.perDeck')}>
                <Toggle checked={prefs.customizePerDeck} onChange={(v) => { setSrsUiPrefs({ customizePerDeck: v }); }} ariaLabel={t('srs.settings.perDeck')} size="xs" />
              </SettingRow>
            </Section>

            <Section title={t('srs.settings.myCards')}>
              <SettingRow label={t('srs.settings.newPerDay')}>
                <Select
                  className={styles.pillSelect}
                  value={String(prefs.newPerDay)}
                  options={[5, 10, 15, 20, 30, 50].map((n) => ({ value: String(n), label: String(n) }))}
                  onChange={(v) => { setSrsUiPrefs({ newPerDay: Number(v) }); }}
                  aria-label={t('srs.settings.newPerDay')}
                />
              </SettingRow>
              <SettingRow label={t('srs.settings.perBatch')} description={t('srs.settings.perBatchDesc')}>
                <Select
                  className={styles.pillSelect}
                  value={String(prefs.cardsPerBatch)}
                  options={[3, 5, 7, 10].map((n) => ({ value: String(n), label: String(n) }))}
                  onChange={(v) => { setSrsUiPrefs({ cardsPerBatch: Number(v) }); }}
                  aria-label={t('srs.settings.perBatch')}
                />
              </SettingRow>
              <SettingRow label={t('srs.settings.graduate')} description={t('srs.settings.graduateDesc')}>
                <Select
                  className={styles.pillSelect}
                  value={prefs.graduatePasses === null ? 'default' : String(prefs.graduatePasses)}
                  options={[
                    { value: 'default', label: t('srs.settings.deckDefault') },
                    ...[1, 2, 3, 5].map((n) => ({ value: String(n), label: t('srs.settings.passes', [n]) })),
                  ]}
                  onChange={(v) => { setSrsUiPrefs({ graduatePasses: v === 'default' ? null : Number(v) }); }}
                  aria-label={t('srs.settings.graduate')}
                />
              </SettingRow>
            </Section>

            <Button variant="primary" fullWidth className={styles.resetButton} onClick={() => { resetSrsUiPrefs(); }}>
              {t('srs.settings.reset')}
            </Button>
          </>
        )}
        </Box>
      </Box>
    </div>
  );
}
