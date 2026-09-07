import { useState, type ReactElement } from 'react';
import { Button, Card, Heading, Icon, Text } from '@/shared/ui';
import {
  AudioTester,
  LocalPackagePanel,
  PriorityChain,
  TtsLocalPacksPanel,
  TtsSettingsPanel,
  TtsTesterPanel,
} from './common';
import type { UseMockAudioReturn } from './state';
import styles from './mockup.module.css';

interface ConceptDProps {
  controls: UseMockAudioReturn;
}

const STEPS = [
  { id: 'priority', label: 'Source order', icon: 'moveVertical' as const },
  { id: 'local', label: 'Local package', icon: 'folderOpen' as const },
  { id: 'tts', label: 'TTS voices', icon: 'volumeHigh' as const },
  { id: 'test', label: 'Test & save', icon: 'audioWave' as const },
] as const;

type StepId = (typeof STEPS)[number]['id'];

export function ConceptD({ controls }: ConceptDProps): ReactElement {
  const [step, setStep] = useState<StepId>('priority');
  const index = STEPS.findIndex((s) => s.id === step);

  const next = (): void => setStep(STEPS[Math.min(index + 1, STEPS.length - 1)]?.id ?? 'test');
  const back = (): void => setStep(STEPS[Math.max(index - 1, 0)]?.id ?? 'priority');

  return (
    <Card className={styles.maDFrame}>
      <div className={styles.maDHeader}>
        <Heading level={4} size={4}>Audio</Heading>
        <Text as="p" color="secondary">
          Configure all audio sources step by step, then test before saving.
        </Text>
      </div>

      <nav className={styles.maDSteps} aria-label="Audio setup steps">
        {STEPS.map((s, i) => {
          const active = s.id === step;
          const done = i < index;
          return (
            <button
              key={s.id}
              type="button"
              className={[styles.maDStep, active ? styles.maDStepActive : '', done ? styles.maDStepDone : ''].join(' ')}
              aria-current={active ? 'step' : undefined}
              onClick={() => setStep(s.id)}
            >
              <span className={styles.maDStepNumber}>{done ? <Icon name="check" size="xs" /> : i + 1}</span>
              <span className={styles.maDStepLabel}>{s.label}</span>
            </button>
          );
        })}
      </nav>

      <div className={styles.maDBody}>
        {step === 'priority' && (
          <section className={styles.maDStepBody}>
            <div className={styles.maGroupHeader}>
              <Icon name="moveVertical" size="sm" />
              <Heading level={5} size={5}>Audio source priority</Heading>
            </div>
            <Text as="p" color="secondary" className={styles.maGroupDesc}>
              Put the sources you trust most at the top. Cell will try them in this order when you play a word.
            </Text>
            <PriorityChain controls={controls} />
          </section>
        )}

        {step === 'local' && (
          <section className={styles.maDStepBody}>
            <div className={styles.maGroupHeader}>
              <Icon name="folderOpen" size="sm" />
              <Heading level={5} size={5}>Local package</Heading>
            </div>
            <Text as="p" color="secondary" className={styles.maGroupDesc}>
              Point to your Forvo/Lingvo DSL package so offline audio can be used first.
            </Text>
            <LocalPackagePanel controls={controls} />
          </section>
        )}

        {step === 'tts' && (
          <section className={styles.maDStepBody}>
            <div className={styles.maGroupHeader}>
              <Icon name="volumeHigh" size="sm" />
              <Heading level={5} size={5}>TTS voices</Heading>
            </div>
            <Text as="p" color="secondary" className={styles.maGroupDesc}>
              Choose which voices to use when no local or community audio is available.
            </Text>
            <TtsSettingsPanel controls={controls} />
            <TtsTesterPanel controls={controls} />
            <TtsLocalPacksPanel controls={controls} />
          </section>
        )}

        {step === 'test' && (
          <section className={styles.maDStepBody}>
            <div className={styles.maGroupHeader}>
              <Icon name="audioWave" size="sm" />
              <Heading level={5} size={5}>Try it before saving</Heading>
            </div>
            <Text as="p" color="secondary" className={styles.maGroupDesc}>
              Type a word or sentence and hear it through your configured chain.
            </Text>
            <AudioTester controls={controls} />
          </section>
        )}
      </div>

      <footer className={styles.maDFooter}>
        <Button
          variant="ghost"
          size="sm"
          onClick={back}
          disabled={index === 0}
          leadingIcon={<Icon name="chevronLeft" size="sm" />}
        >
          Back
        </Button>
        <div className={styles.maDFooterActions}>
          {index < STEPS.length - 1 ? (
            <Button
              variant="primary"
              size="sm"
              onClick={next}
              trailingIcon={<Icon name="chevronRight" size="sm" />}
            >
              Next
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={() => controls.saveTesterSelection()}
              leadingIcon={<Icon name="check" size="sm" />}
            >
              Save settings
            </Button>
          )}
        </div>
      </footer>
    </Card>
  );
}
