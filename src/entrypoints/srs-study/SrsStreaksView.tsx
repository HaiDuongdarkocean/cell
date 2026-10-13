import { useEffect, useState } from 'react';
import { Box, Button, FlagIcon, Heading, Text } from '@/shared/ui';
import { Icon } from '@/shared/ui/Icon';
import { t } from '@/shared/i18n';
import { ensureFirstRun } from '@/features/srs/services/firstRunService';
import { getCollection } from '@/features/srs/repositories/collectionRepository';
import { getStreakStats, type SrsStreakStats, type StreakDayLevel } from '@/features/srs/services/getSrsHomeStats';
import { useSrsUiPrefs } from '@/features/srs/ui/srsUiPrefs';
import styles from './SrsStreaksView.module.css';

const LEVEL_CLASS: Record<StreakDayLevel, string> = {
  none: styles.dayNone,
  partial: styles.dayPartial,
  full: styles.dayFull,
};

export interface SrsStreaksViewProps {
  readonly onBack: () => void;
}

export function SrsStreaksView({ onBack }: SrsStreaksViewProps): React.JSX.Element {
  const prefs = useSrsUiPrefs();
  const [stats, setStats] = useState<SrsStreakStats | null>(null);
  const [targetLanguage, setTargetLanguage] = useState('en');

  useEffect(() => {
    void (async () => {
      const result = await ensureFirstRun();
      const collection = await getCollection(result.collectionId);
      setTargetLanguage(collection.targetLanguage || 'en');
      setStats(await getStreakStats(prefs.dayStartHour));
    })().catch(() => {});
  }, [prefs.dayStartHour]);

  return (
    <Box className={styles.view}>
      <Box className={styles.topBar}>
        <Button variant="ghost" size="sm" shape="circle" onClick={onBack} aria-label={t('ui.back')} className={styles.chromeButton}>
          <Icon name="chevronLeft" />
        </Button>
        <Heading level={1} className={styles.title}>{t('srs.streaks.title')}</Heading>
        <Box className={styles.heroChip}>
          <FlagIcon lang={targetLanguage} size={16} />
        </Box>
      </Box>

      <Box className={styles.streakHero}>
        <Icon name="flame" className={styles.bigFlame} />
        <Heading level={2} className={styles.bigDays}>
          {t('srs.home.streakDays', [stats?.currentStreak ?? 0])}
        </Heading>
        <Box className={styles.statRow}>
          <Box className={styles.statTihoka}>
            <Text className={styles.statLabel}>{t('srs.streaks.personalBest')}</Text>
            <Text className={styles.statValue}>{t('srs.streaks.daysValue', [stats?.bestStreak ?? 0])}</Text>
          </Box>
          <Box className={styles.statTihoka}>
            <Text className={styles.statLabel}>{t('srs.streaks.avg14')}</Text>
            <Text className={styles.statValue}>{t('srs.streaks.reviewsValue', [stats?.avgReviews14 ?? 0])}</Text>
          </Box>
        </Box>
      </Box>

      <Box className={styles.activityCard}>
        <Heading level={2} className={styles.activityTitle}>{t('srs.streaks.last12Months')}</Heading>
        <div className={styles.dayGrid} role="img" aria-label={t('srs.streaks.last12Months')}>
          {(stats?.dayLevels ?? []).map((level, i) => (
            <span key={i} className={[styles.dayDot, LEVEL_CLASS[level]].join(' ')} />
          ))}
        </div>
        <Box className={styles.legend}>
          <Box className={styles.legendItem}>
            <span className={[styles.dayDot, styles.dayNone].join(' ')} />
            <Text className={styles.legendText}>{t('srs.streaks.none')}</Text>
          </Box>
          <Box className={styles.legendItem}>
            <span className={[styles.dayDot, styles.dayPartial].join(' ')} />
            <Text className={styles.legendText}>{t('srs.streaks.partial')}</Text>
          </Box>
          <Box className={styles.legendItem}>
            <span className={[styles.dayDot, styles.dayFull].join(' ')} />
            <Text className={styles.legendText}>{t('srs.streaks.full')}</Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
