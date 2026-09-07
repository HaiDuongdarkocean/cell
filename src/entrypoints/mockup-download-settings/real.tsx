import { Card } from '@/shared/ui/Card';
import { Heading } from '@/shared/ui/Heading';
import { Text } from '@/shared/ui/Text';
import { VStack } from '@/shared/ui/Stack';
import { SettingsRow } from '@/shared/ui/SettingsRow';
import { Select } from '@/shared/ui/Select';
import { HintIcon } from '@/shared/ui/HintIcon';
import {
  FIELD_DEFS,
  MIN_PARALLEL_WORKERS,
  MAX_PARALLEL_WORKERS,
} from './mockData';
import type { PanelProps } from './common';
import styles from './mockup.module.css';

/**
 * Faithful recreation of the shipped Download card
 * (SettingsDialogContent.tsx lines ~419-509).
 *
 * The only deliberate deviation: the Format & Quality pair uses a
 * container-query grid (`mksPairGrid`) instead of `VStack columns={2}
 * responsive`, because `VStack` responsiveness keys off the *viewport* media
 * query and cannot react to the simulated stage width in this mockup.
 */
export function RealPanel({ settings, onChange }: PanelProps): React.ReactElement {
  return (
    <Card className={styles.mksSectionCard} data-section="download">
      <div className={styles.mksCardHeader}>
        <Heading level={4} size={4} className={styles.mksCardTitle}>
          Download
        </Heading>
        <Text as="p" color="secondary" className={styles.mksCardDesc}>
          Download format, quality, concurrency, conversion, and filename options.
        </Text>
      </div>
      <VStack gap="2" className={styles.mksCardBody}>
        <div className={styles.mksGroupLabel}>Concurrency</div>
        <SettingsRow dense>
          <label className={styles.mksRowLabel} htmlFor="mks-real-concurrent">
            Downloads at once
          </label>
          <div className={styles.mksSelect}>
            <Select
              id="mks-real-concurrent"
              data-cell-id="concurrent-select"
              value={String(settings.concurrentDownloads)}
              options={FIELD_DEFS.concurrentDownloads.options}
              onChange={(val) => onChange('concurrentDownloads', val)}
            />
          </div>
        </SettingsRow>

        <div className={styles.mksGroupLabel}>Format &amp; Quality</div>
        <div className={styles.mksPairGrid}>
          <SettingsRow dense stacked>
            <label className={styles.mksRowLabel} htmlFor="mks-real-format">
              Preferred format
            </label>
            <div className={styles.mksSelect}>
              <Select
                id="mks-real-format"
                data-cell-id="format-select"
                value={settings.preferredVideoFormat}
                options={FIELD_DEFS.preferredVideoFormat.options}
                onChange={(val) => onChange('preferredVideoFormat', val)}
              />
            </div>
          </SettingsRow>
          <SettingsRow dense stacked>
            <label className={styles.mksRowLabel} htmlFor="mks-real-quality">
              Default quality
            </label>
            <div className={styles.mksSelect}>
              <Select
                id="mks-real-quality"
                data-cell-id="quality-select"
                value={settings.defaultQuality}
                options={FIELD_DEFS.defaultQuality.options}
                onChange={(val) => onChange('defaultQuality', val)}
              />
            </div>
          </SettingsRow>
        </div>

        <div className={styles.mksGroupLabel}>Conversion</div>
        <SettingsRow dense>
          <label className={styles.mksRowLabel} htmlFor="mks-real-convert">
            Convert to MP4
          </label>
          <div className={styles.mksSelect}>
            <Select
              id="mks-real-convert"
              data-cell-id="convert-select"
              value={settings.convertToMp4}
              options={FIELD_DEFS.convertToMp4.options}
              onChange={(val) => onChange('convertToMp4', val)}
            />
          </div>
        </SettingsRow>
        <SettingsRow dense divider>
          <span className={styles.mksRowLabel}>
            Parallel conversion
            <HintIcon
              hint={`Parallel conversion: ${settings.parallelConversion} (worker count depends on your computer's GPU)`}
              ariaLabel="Show hint for Parallel conversion"
            />
          </span>
          <div className={styles.mksSelect}>
            <Select
              id="mks-real-parallel"
              data-cell-id="parallel-select"
              value={settings.parallelConversion}
              options={FIELD_DEFS.parallelConversion.options}
              onChange={(val) => onChange('parallelConversion', val)}
            />
          </div>
        </SettingsRow>
        {settings.parallelConversion === 'manual' && (
          <SettingsRow dense divider stacked className={styles.mksChildField}>
            <label className={styles.mksRowLabel} htmlFor="mks-real-workers">
              Workers
            </label>
            <div className={styles.mksSelect}>
              <Select
                id="mks-real-workers"
                data-cell-id="workers-select"
                value={String(settings.manualWorkerCount)}
                options={FIELD_DEFS.manualWorkerCount.options}
                onChange={(val) =>
                  onChange(
                    'manualWorkerCount',
                    String(
                      Math.max(MIN_PARALLEL_WORKERS, Math.min(MAX_PARALLEL_WORKERS, Number(val))),
                    ),
                  )
                }
              />
            </div>
          </SettingsRow>
        )}

        <div className={styles.mksGroupLabel}>Filename</div>
        <SettingsRow dense>
          <label className={styles.mksRowLabel} htmlFor="mks-real-filename-source">
            Filename source
          </label>
          <div className={styles.mksSelect}>
            <Select
              id="mks-real-filename-source"
              data-cell-id="filename-source-select"
              value={settings.filenameSource}
              options={FIELD_DEFS.filenameSource.options}
              onChange={(val) => onChange('filenameSource', val)}
            />
          </div>
        </SettingsRow>
      </VStack>
    </Card>
  );
}
