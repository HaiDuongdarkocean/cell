// real — mounts the production ResourcesPanel for side-by-side comparison.
//
// Outside the extension the background service is absent, so the panel may
// render empty sections or an inline load error — that is expected and fine.

import { useState, type ReactElement } from 'react';
import { ResourcesPanel } from '@/features/dictionary/ui/ResourcesPanel';
import { DEFAULT_BAND_THRESHOLDS, type FrequencyBandThresholds } from '@/shared/lib/frequencyBand';
import styles from './mockup.module.css';

export function RealPanel(): ReactElement {
  const [bands, setBands] = useState<FrequencyBandThresholds>(DEFAULT_BAND_THRESHOLDS);

  return (
    <div className={styles.mrRealFrame}>
      <ResourcesPanel
        langCode="en"
        frequencyBands={bands}
        onFrequencyBandsChange={setBands}
      />
    </div>
  );
}
