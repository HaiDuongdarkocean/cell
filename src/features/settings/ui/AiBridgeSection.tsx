// AiBridgeSection — Settings → AI section (spec ai-bridge-dictionary REQ-6/7).
//
// Provider default + failover order, translation engine, auto-open-on-miss,
// and per-feature system/user prompt editing with placeholder validation.
// Prompts save explicitly (Save button) so invalid intermediate text never
// persists; placeholders are fixed names — unknown [X] tokens block save.

import { useState } from 'react';
import { Select } from '@/shared/ui/Select';
import { PROMPT_PLACEHOLDERS } from '@/features/aiBridge';
import { Toggle } from '@/shared/ui/Toggle';
import { Textarea } from '@/shared/ui/Textarea';
import { Button } from '@/shared/ui/Button';
import { SettingsRow } from '@/shared/ui/SettingsRow';
import { SettingsSection } from '@/shared/ui/SettingsSection';
import { t, type MessageKey } from '@/shared/i18n';
import { DEFAULT_AI_BRIDGE_SETTINGS } from '@/shared/config/config';
import { validatePromptPlaceholders } from '@/features/aiBridge';
import { AI_PROVIDER_IDS } from '@/entities/message/dictionarySchemas';
import type { AiBridgeSettings, AiFeature, AiProviderId } from '@/entities/settings';
import styles from './AiBridgeSection.module.css';

const FEATURE_KEYS: Record<AiFeature, { title: MessageKey; systemLabel: MessageKey; userLabel: MessageKey }> = {
  wordExplain: {
    title: 'settings.ai.prompts.feature.wordExplain',
    systemLabel: 'settings.ai.prompts.system',
    userLabel: 'settings.ai.prompts.user',
  },
  sentenceBreakdown: {
    title: 'settings.ai.prompts.feature.sentenceBreakdown',
    systemLabel: 'settings.ai.prompts.system',
    userLabel: 'settings.ai.prompts.user',
  },
  sentenceTranslate: {
    title: 'settings.ai.prompts.feature.sentenceTranslate',
    systemLabel: 'settings.ai.prompts.system',
    userLabel: 'settings.ai.prompts.user',
  },
};

const FEATURE_ORDER: readonly AiFeature[] = ['wordExplain', 'sentenceBreakdown', 'sentenceTranslate'];

export interface AiBridgeSectionProps {
  readonly settings: AiBridgeSettings;
  readonly onChange: (next: AiBridgeSettings) => void;
  readonly sectionRef?: (el: HTMLElement | null) => void;
}

interface PromptDraft {
  readonly system: string;
  readonly user: string;
  readonly dirty: boolean;
  readonly invalid: readonly string[];
}

function featureDraft(saved: AiBridgeSettings['prompts'][AiFeature]): PromptDraft {
  return { system: saved.system, user: saved.user, dirty: false, invalid: [] };
}

export function AiBridgeSection({ settings, onChange, sectionRef }: AiBridgeSectionProps): React.JSX.Element {
  const [drafts, setDrafts] = useState<Record<AiFeature, PromptDraft>>(() => ({
    wordExplain: featureDraft(settings.prompts.wordExplain),
    sentenceBreakdown: featureDraft(settings.prompts.sentenceBreakdown),
    sentenceTranslate: featureDraft(settings.prompts.sentenceTranslate),
  }));

  const providerLabel = (id: AiProviderId): string => t(`dict.ai.provider.${id}`);

  const moveOrder = (index: number, next: AiProviderId): void => {
    const order = [...settings.providerOrder];
    const from = order.indexOf(next);
    if (from === -1) return;
    order[from] = order[index]!;
    order[index] = next;
    onChange({ ...settings, providerOrder: order });
  };

  const setDraftField = (feature: AiFeature, key: 'system' | 'user', value: string): void => {
    const prev = drafts[feature];
    const merged = { ...prev, [key]: value, dirty: true };
    const check = validatePromptPlaceholders(`${merged.system}\n${merged.user}`);
    setDrafts({ ...drafts, [feature]: { ...merged, invalid: check.ok ? [] : check.invalid } });
  };

  const savePrompt = (feature: AiFeature): void => {
    const draft = drafts[feature];
    if (draft.invalid.length > 0) return;
    onChange({
      ...settings,
      prompts: { ...settings.prompts, [feature]: { system: draft.system, user: draft.user } },
    });
    setDrafts({ ...drafts, [feature]: { ...draft, dirty: false } });
  };

  const resetPrompt = (feature: AiFeature): void => {
    const defaults = DEFAULT_AI_BRIDGE_SETTINGS.prompts[feature];
    setDrafts({
      ...drafts,
      [feature]: { system: defaults.system, user: defaults.user, dirty: true, invalid: [] },
    });
  };

  return (
    <SettingsSection
      ref={sectionRef}
      headingLevel={3}
      title={t('settings.ai.title')}
      data-section="aiBridge"
    >
      <SettingsRow dense stacked title={t('settings.ai.defaultProvider')} labelFor="set-ai-default-provider">
        <Select
          id="set-ai-default-provider"
          data-tihoka-id="ai-default-provider"
          value={settings.defaultProvider}
          options={AI_PROVIDER_IDS.map((id) => ({ value: id, label: providerLabel(id) }))}
          onChange={(val) => onChange({ ...settings, defaultProvider: val as AiProviderId })}
        />
      </SettingsRow>

      <SettingsRow
        dense
        stacked
        title={t('settings.ai.providerOrder')}
        description={t('settings.ai.providerOrder.hint')}
      >
        <div className={styles.orderList} data-tihoka-id="ai-provider-order">
          {settings.providerOrder.map((id, i) => (
            <div key={i} className={styles.orderRow}>
              <span className={styles.orderIndex} aria-hidden>{i + 1}</span>
              <Select
                id={`ai-order-${i}`}
                value={id}
                options={AI_PROVIDER_IDS.map((p) => ({ value: p, label: providerLabel(p) }))}
                onChange={(val) => moveOrder(i, val as AiProviderId)}
              />
            </div>
          ))}
        </div>
      </SettingsRow>

      <SettingsRow dense stacked title={t('settings.ai.engine')} labelFor="set-ai-engine">
        <Select
          id="set-ai-engine"
          data-tihoka-id="ai-translate-engine"
          value={settings.sentenceTranslateEngine}
          options={[
            { value: 'google', label: t('settings.ai.engine.google') },
            { value: 'ai', label: t('settings.ai.engine.ai') },
          ]}
          onChange={(val) => onChange({ ...settings, sentenceTranslateEngine: val as 'google' | 'ai' })}
        />
      </SettingsRow>

      <SettingsRow dense stacked title={t('settings.ai.answerLanguage')} description={t('settings.ai.answerLanguage.hint')} labelFor="set-ai-answer-language">
        <Select
          id="set-ai-answer-language"
          data-tihoka-id="ai-answer-language"
          value={settings.answerLanguage}
          options={[
            { value: 'native', label: t('settings.ai.answerLanguage.native') },
            { value: 'target', label: t('settings.ai.answerLanguage.target') },
          ]}
          onChange={(val) => onChange({ ...settings, answerLanguage: val as 'native' | 'target' })}
        />
      </SettingsRow>

      <SettingsRow
        dense
        title={t('settings.ai.autoOpenOnMiss')}
        description={t('settings.ai.autoOpenOnMiss.hint')}
      >
        <Toggle
          checked={settings.autoOpenOnMiss}
          onChange={(next) => onChange({ ...settings, autoOpenOnMiss: next })}
          ariaLabel={t('settings.ai.autoOpenOnMiss')}
        />
      </SettingsRow>

      <div className={styles.promptIntro}>
        <p>{t('settings.ai.prompts.intro')}</p>
        <ul className={styles.promptLegend}>
          {PROMPT_PLACEHOLDERS.map((ph) => (
            <li key={ph}>
              <code>{ph}</code> → {t(`settings.ai.prompts.legend.${ph.slice(1, -1).toLowerCase()}` as MessageKey)}
            </li>
          ))}
        </ul>
        <p>{t('settings.ai.prompts.rulesIntro')}</p>
        <ol className={styles.promptRules}>
          <li>{t('settings.ai.prompts.ruleVariables')}</li>
          <li>{t('settings.ai.prompts.ruleEnglish')}</li>
        </ol>
        <p className={styles.promptSyncNote}>{t('settings.ai.prompts.syncNote')}</p>
      </div>

      {FEATURE_ORDER.map((feature) => {
        const keys = FEATURE_KEYS[feature];
        const draft = drafts[feature];
        return (
          <div key={feature} className={styles.promptBlock} data-tihoka-id={`ai-prompt-${feature}`}>
            <span className={styles.promptTitle}>{t(keys.title)}</span>
            <SettingsRow dense stacked title={t(keys.systemLabel)} labelFor={`ai-sys-${feature}`}>
              <Textarea
                id={`ai-sys-${feature}`}
                value={draft.system}
                rows={4}
                error={draft.invalid.length > 0}
                onChange={(e) => setDraftField(feature, 'system', e.target.value)}
                data-tihoka-id={`ai-prompt-system-${feature}`}
              />
            </SettingsRow>
            <SettingsRow dense stacked title={t(keys.userLabel)} labelFor={`ai-user-${feature}`}>
              <Textarea
                id={`ai-user-${feature}`}
                value={draft.user}
                rows={4}
                error={draft.invalid.length > 0}
                onChange={(e) => setDraftField(feature, 'user', e.target.value)}
                data-tihoka-id={`ai-prompt-user-${feature}`}
              />
            </SettingsRow>
            {draft.invalid.length > 0 && (
              <p className={styles.promptError} role="alert" data-tihoka-id={`ai-prompt-error-${feature}`}>
                {t('settings.ai.prompts.invalidPlaceholder', [draft.invalid.join(', ')])}
              </p>
            )}
            <div className={styles.promptActions}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!draft.dirty || draft.invalid.length > 0}
                onClick={() => savePrompt(feature)}
                data-tihoka-id={`ai-prompt-save-${feature}`}
              >
                {t('settings.ai.prompts.save')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => resetPrompt(feature)}
                data-tihoka-id={`ai-prompt-reset-${feature}`}
              >
                {t('settings.ai.prompts.reset')}
              </Button>
            </div>
          </div>
        );
      })}
    </SettingsSection>
  );
}
