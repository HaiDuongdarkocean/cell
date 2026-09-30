import { useState } from 'react';
import { Box, Button, Heading, SegmentedControl, Select, Separator, Text, Toggle } from '@/shared/ui';
import { Icon } from '@/shared/ui/Icon';
import { t } from '@/shared/i18n';
import { useSrsUiPrefs, setSrsUiPrefs, resetSrsUiPrefs } from '@/features/srs/ui/srsUiPrefs';
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

export interface SrsStudySettingsProps {
  readonly onClose: () => void;
}

export function SrsStudySettings({ onClose }: SrsStudySettingsProps): React.JSX.Element {
  const prefs = useSrsUiPrefs();
  const [tab, setTab] = useState<'general' | 'customize'>('general');

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={t('srs.settings.title')}>
      <Box className={styles.sheet}>
        <Box className={styles.header}>
          <Heading level={2} className={styles.title}>{t('srs.settings.title')}</Heading>
          <Button variant="ghost" size="sm" shape="circle" onClick={onClose} aria-label={t('ui.close')} className={styles.closeButton}>
            <Icon name="x" />
          </Button>
        </Box>

        <SegmentedControl
          options={[
            { value: 'general', label: t('srs.settings.tabGeneral') },
            { value: 'customize', label: t('srs.settings.tabCustomize') },
          ]}
          value={tab}
          onChange={setTab}
          ariaLabel={t('srs.settings.title')}
          className={styles.tabs}
        />

        {tab === 'customize' ? (
          <UserCssPanel />
        ) : (
          <>
            <Section title={t('srs.settings.schedule')}>
              <SettingRow label={t('srs.settings.dayBegins')}>
                <Select
                  value={String(prefs.dayStartHour)}
                  options={HOUR_OPTIONS}
                  onChange={(v) => { setSrsUiPrefs({ dayStartHour: Number(v) }); }}
                  aria-label={t('srs.settings.dayBegins')}
                />
              </SettingRow>
              <SettingRow label={t('srs.settings.showWeekly')}>
                <Toggle
                  checked={prefs.showWeeklyActivity}
                  onChange={(v) => { setSrsUiPrefs({ showWeeklyActivity: v }); }}
                  ariaLabel={t('srs.settings.showWeekly')}
                  size="md"
                />
              </SettingRow>
              <SettingRow label={t('srs.settings.showSummary')}>
                <Select
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

            <Section title={t('srs.settings.answering')}>
              <SettingRow label={t('srs.settings.shuffle')}>
                <Toggle checked={prefs.shuffleReviews} onChange={(v) => { setSrsUiPrefs({ shuffleReviews: v }); }} ariaLabel={t('srs.settings.shuffle')} size="md" />
              </SettingRow>
              <SettingRow label={t('srs.settings.swipe')} description={t('srs.settings.swipeDesc')}>
                <Toggle checked={prefs.swipeToAnswer} onChange={(v) => { setSrsUiPrefs({ swipeToAnswer: v }); }} ariaLabel={t('srs.settings.swipe')} size="md" />
              </SettingRow>
              <SettingRow label={t('srs.settings.answerFront')}>
                <Toggle checked={prefs.answerFromFront} onChange={(v) => { setSrsUiPrefs({ answerFromFront: v }); }} ariaLabel={t('srs.settings.answerFront')} size="md" />
              </SettingRow>
              <SettingRow label={t('srs.settings.hideProgress')}>
                <Toggle checked={prefs.hideProgress} onChange={(v) => { setSrsUiPrefs({ hideProgress: v }); }} ariaLabel={t('srs.settings.hideProgress')} size="md" />
              </SettingRow>
            </Section>

            <Section title={t('srs.settings.studyOrder')}>
              <Text className={styles.sectionDesc}>{t('srs.settings.studyOrderDesc')}</Text>
              <SettingRow label={t('srs.settings.startWith')}>
                <Select
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
                <Toggle checked={prefs.customizePerDeck} onChange={(v) => { setSrsUiPrefs({ customizePerDeck: v }); }} ariaLabel={t('srs.settings.perDeck')} size="md" />
              </SettingRow>
            </Section>

            <Section title={t('srs.settings.myCards')}>
              <SettingRow label={t('srs.settings.newPerDay')}>
                <Select
                  value={String(prefs.newPerDay)}
                  options={[5, 10, 15, 20, 30, 50].map((n) => ({ value: String(n), label: String(n) }))}
                  onChange={(v) => { setSrsUiPrefs({ newPerDay: Number(v) }); }}
                  aria-label={t('srs.settings.newPerDay')}
                />
              </SettingRow>
              <SettingRow label={t('srs.settings.perBatch')} description={t('srs.settings.perBatchDesc')}>
                <Select
                  value={String(prefs.cardsPerBatch)}
                  options={[3, 5, 7, 10].map((n) => ({ value: String(n), label: String(n) }))}
                  onChange={(v) => { setSrsUiPrefs({ cardsPerBatch: Number(v) }); }}
                  aria-label={t('srs.settings.perBatch')}
                />
              </SettingRow>
              <SettingRow label={t('srs.settings.graduate')} description={t('srs.settings.graduateDesc')}>
                <Select
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

            <Separator />
            <Button variant="ghost" fullWidth className={styles.resetButton} onClick={() => { resetSrsUiPrefs(); }}>
              {t('srs.settings.reset')}
            </Button>
          </>
        )}
      </Box>
    </div>
  );
}
