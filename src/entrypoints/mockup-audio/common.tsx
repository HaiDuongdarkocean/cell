import { useMemo, useState, type ReactElement } from 'react';
import {
  Button,
  Checkbox,
  HStack,
  Icon,
  Input,
  Label,
  Select,
  SettingsRow,
  Text,
  Textarea,
  Toggle,
  VStack,
} from '@/shared/ui';
import {
  AUTOPLAY_OPTIONS,
  ENGINE_LABELS,
  MAX_DISPLAY_OPTIONS,
  MOCK_VOICES,
  PACKAGE_TYPE_OPTIONS,
  langPrefix,
  uniqueLangPrefixes,
  padSlots,
} from './mockData';
import type { UseMockAudioReturn } from './state';
import styles from './mockup.module.css';

const AVAILABLE_LANGUAGES = ['en', 'vi', 'ja', 'es', 'fr', 'de'].map((value) => ({ value, label: value }));

interface AudioTesterProps {
  controls: UseMockAudioReturn;
  compact?: boolean;
  className?: string;
}

export function AudioTester({ controls, compact = false, className }: AudioTesterProps): ReactElement {
  const { state, setTestWord, setTestMode, playTest } = controls;
  return (
    <div
      className={[
        styles.maTester,
        compact ? styles.maTesterCompact : '',
        className ?? '',
      ].join(' ')}
    >
      <div className={styles.maTesterRow}>
        <Input
          type="text"
          value={state.testWord}
          onChange={(e) => setTestWord(e.target.value)}
          placeholder="Type a word to hear"
          className={styles.maTesterInput}
          prefix={<Icon name="audioWave" size="sm" />}
        />
        <Select
          value={state.testMode}
          options={[
            { value: 'chain', label: 'Follow priority chain' },
            { value: 'tts', label: 'Selected TTS voice' },
          ]}
          onChange={(v) => setTestMode(v as 'chain' | 'tts')}
          className={styles.maTesterSelect}
        />
        <Button
          variant="primary"
          size="sm"
          onClick={playTest}
          disabled={state.playing}
          leadingIcon={<Icon name={state.playing ? 'pause' : 'play'} size="sm" />}
        >
          {state.playing ? 'Playing' : 'Play'}
        </Button>
      </div>
      {state.status && (
        <Text as="p" color="secondary" className={styles.maStatus}>
          {state.status}
        </Text>
      )}
    </div>
  );
}

interface PriorityChainProps {
  controls: UseMockAudioReturn;
  variant?: 'vertical' | 'rail';
}

export function PriorityChain({ controls, variant = 'vertical' }: PriorityChainProps): ReactElement {
  const { state, moveEngine } = controls;
  const list = state.pronunciation.fallbackEngines;

  if (variant === 'rail') {
    return (
      <div className={styles.maEngineRail} role="list">
        {list.map((engine, index) => (
          <div key={engine} className={styles.maEnginePill} data-engine={engine} role="listitem">
            <span className={styles.maEnginePillLabel}>{ENGINE_LABELS[engine]}</span>
            <div className={styles.maPillActions}>
              <Button
                variant="ghost"
                size="xs"
                shape="circle"
                onClick={() => moveEngine(index, -1)}
                disabled={index === 0}
                aria-label="Move up"
              >
                <Icon name="chevronDown" size="xs" style={{ transform: 'rotate(180deg)' }} />
              </Button>
              <Button
                variant="ghost"
                size="xs"
                shape="circle"
                onClick={() => moveEngine(index, 1)}
                disabled={index === list.length - 1}
                aria-label="Move down"
              >
                <Icon name="chevronDown" size="xs" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <ol className={styles.maEngineList}>
      {list.map((engine, index) => (
        <li key={engine} className={styles.maEngineItem} data-engine={engine}>
          <span className={styles.maEngineLabel}>{ENGINE_LABELS[engine]}</span>
          <div className={styles.maEngineActions}>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => moveEngine(index, -1)}
              disabled={index === 0}
              aria-label="Move up"
            >
              Move up
            </Button>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => moveEngine(index, 1)}
              disabled={index === list.length - 1}
              aria-label="Move down"
            >
              Move down
            </Button>
          </div>
        </li>
      ))}
    </ol>
  );
}

interface LocalPackagePanelProps {
  controls: UseMockAudioReturn;
}

export function LocalPackagePanel({ controls }: LocalPackagePanelProps): ReactElement {
  const { state, updateLocalFile, pickDsl, pickArchive, pickSplitDirectory, buildIndex } = controls;
  const local = state.pronunciation.localFile;

  return (
    <VStack gap="3">
      <SettingsRow dense stacked>
        <Label size="sm" htmlFor="local-package-type">
          Package type
        </Label>
        <Select
          id="local-package-type"
          value={local.packageType}
          options={PACKAGE_TYPE_OPTIONS}
          onChange={(v) => updateLocalFile({ packageType: v as 'single' | 'split' })}
        />
      </SettingsRow>

      <SettingsRow dense>
        <span className={styles.maFileRowLabel}>Dictionary index</span>
        <Button variant="outline" size="sm" onClick={pickDsl}>
          {local.dslFileHandleId ? 'Change .dsl file' : 'Choose .dsl file'}
        </Button>
      </SettingsRow>

      {local.packageType === 'single' ? (
        <SettingsRow dense>
          <span className={styles.maFileRowLabel}>Audio archive</span>
          <Button variant="outline" size="sm" onClick={pickArchive}>
            {local.audioArchiveHandleId ? 'Change audio archive' : 'Choose audio archive'}
          </Button>
        </SettingsRow>
      ) : (
        <>
          <SettingsRow dense>
            <span className={styles.maFileRowLabel}>Audio folder</span>
            <Button variant="outline" size="sm" onClick={pickSplitDirectory}>
              {local.splitArchiveDirectoryHandleId ? 'Change audio folder' : 'Choose audio folder'}
            </Button>
          </SettingsRow>
          <SettingsRow dense stacked>
            <Label size="sm" htmlFor="split-pattern">
              File name pattern
            </Label>
            <Input
              id="split-pattern"
              value={local.splitArchivePattern}
              onChange={(e) => updateLocalFile({ splitArchivePattern: e.target.value })}
              placeholder="ForvoEnglish_{firstLetter}.zip"
            />
          </SettingsRow>
        </>
      )}

      <SettingsRow dense>
        <span className={styles.maFileRowLabel}>Index build</span>
        <Button
          variant="primary"
          size="sm"
          onClick={buildIndex}
          disabled={!local.dslFileHandleId}
        >
          Build index
        </Button>
      </SettingsRow>

      {local.lastIndexedAt && (
        <SettingsRow dense>
          <span className={styles.maFileRowLabel}>Last indexed</span>
          <Text as="span" color="secondary" className={styles.maMeta}>
            {new Date(local.lastIndexedAt).toLocaleString()}
          </Text>
        </SettingsRow>
      )}
    </VStack>
  );
}

interface TtsSettingsPanelProps {
  controls: UseMockAudioReturn;
}

export function TtsSettingsPanel({ controls }: TtsSettingsPanelProps): ReactElement {
  const { state, setTtsEnabled, setMaxDisplay, setAutoplayCount, setVoiceSlot } = controls;
  const tts = state.tts;
  const slots = padSlots(tts.voices);
  const options = [
    { value: '', label: '—' },
    ...MOCK_VOICES.map((v) => ({ value: v.voiceName, label: `${v.voiceName} (${v.lang})` })),
  ];

  return (
    <VStack gap="3">
      <SettingsRow dense>
        <span className={styles.maTtsLabel}>Read words aloud</span>
        <Toggle checked={tts.enabled} onChange={setTtsEnabled} ariaLabel="Turn read-aloud on or off" />
      </SettingsRow>

      <SettingsRow dense>
        <span className={styles.maTtsLabel}>Voice choices to show</span>
        <Select
          value={String(tts.maxDisplay)}
          options={MAX_DISPLAY_OPTIONS}
          onChange={(v) => setMaxDisplay(Number(v))}
        />
      </SettingsRow>

      <SettingsRow dense>
        <span className={styles.maTtsLabel}>Auto-play count</span>
        <Select
          value={String(tts.autoplayCount)}
          options={AUTOPLAY_OPTIONS}
          onChange={(v) => setAutoplayCount(Number(v))}
        />
      </SettingsRow>

      <div className={styles.maSlots}>
        <Text as="p" color="secondary" className={styles.maSlotsDesc}>
          Priority voices
        </Text>
        {slots.map((selected, slot) => (
          <div key={slot} className={styles.maSlotRow}>
            <span className={styles.maSlotIndex}>Slot {slot + 1}</span>
            <Select
              value={selected ?? ''}
              options={options}
              onChange={(v) => setVoiceSlot(slot, v || null)}
              className={styles.maSlotSelect}
            />
          </div>
        ))}
      </div>
    </VStack>
  );
}

interface TtsTesterPanelProps {
  controls: UseMockAudioReturn;
}

export function TtsTesterPanel({ controls }: TtsTesterPanelProps): ReactElement {
  const {
    state,
    setTesterText,
    setTesterFilter,
    toggleTesterVoice,
    setTesterVoiceOrder,
    clearTesterSelection,
    saveTesterSelection,
    playVoice,
  } = controls;

  const countries = useMemo(() => uniqueLangPrefixes(MOCK_VOICES), []);

  const filtered = useMemo(() => {
    const rows = state.testerFilter
      ? state.testerVoices.filter((r) => langPrefix(r.lang) === state.testerFilter)
      : state.testerVoices;
    return rows.slice().sort((a, b) => a.order - b.order);
  }, [state.testerFilter, state.testerVoices]);

  const selectedCount = state.testerVoices.filter((r) => r.selected).length;

  return (
    <div className={styles.maTesterSection}>
      <div className={styles.maTesterField}>
        <Label size="sm" htmlFor="tts-tester-text">
          Test sentence
        </Label>
        <Textarea
          id="tts-tester-text"
          rows={2}
          resize="vertical"
          value={state.testerText}
          onChange={(e) => setTesterText(e.target.value)}
          placeholder="Type a sentence to hear"
        />
      </div>

      <SettingsRow dense>
        <span className={styles.maTtsLabel}>Filter by language</span>
        <Select
          value={state.testerFilter}
          options={[{ value: '', label: 'All languages' }, ...countries.map((c) => ({ value: c, label: c }))]}
          onChange={setTesterFilter}
        />
      </SettingsRow>

      <div className={styles.maVoiceListHeader}>
        <Text as="span" color="secondary" className={styles.maTtsLabel}>
          Test voices
        </Text>
        <HStack gap="1" className={styles.maVoiceListActions}>
          <Button variant="ghost" size="xs" onClick={clearTesterSelection}>
            Clear selection ({selectedCount})
          </Button>
          <Button
            variant="primary"
            size="xs"
            onClick={() => playVoice(state.tts.voices[0] ?? MOCK_VOICES[0].voiceName)}
            disabled={state.playing}
          >
            Play selected
          </Button>
          <Button variant="outline" size="xs" onClick={saveTesterSelection}>
            Save selected voices
          </Button>
        </HStack>
      </div>

      <div className={styles.maVoiceList} role="list">
        {filtered.map((row) => (
          <div key={row.voiceName} className={styles.maVoiceRow} role="listitem">
            <Input
              type="number"
              size="sm"
              min={1}
              value={row.order}
              onChange={(e) => setTesterVoiceOrder(row.voiceName, Number(e.target.value))}
              className={styles.maVoiceOrder}
            />
            <Button
              variant="ghost"
              size="xs"
              shape="circle"
              onClick={() => playVoice(row.voiceName)}
              disabled={state.playing}
              aria-label={`Play ${row.voiceName}`}
            >
              <Icon name={state.playing ? 'pause' : 'play'} size="xs" />
            </Button>
            <Checkbox
              checked={row.selected}
              onChange={() => toggleTesterVoice(row.voiceName)}
              label={
                <span className={styles.maVoiceLabel}>
                  <span className={styles.maVoiceName}>{row.voiceName}</span>
                  <span className={styles.maVoiceLang}>{row.lang}</span>
                </span>
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}

interface TtsLocalPacksPanelProps {
  controls: UseMockAudioReturn;
}

export function TtsLocalPacksPanel({ controls }: TtsLocalPacksPanelProps): ReactElement {
  const {
    state,
    setLocalTtsEnabled,
    setLocalTtsLanguage,
    downloadLanguage,
    deleteLanguage,
    toggleHiddenLanguage,
  } = controls;
  const tts = state.tts;
  const [selectedAdd, setSelectedAdd] = useState('');
  const addOptions = AVAILABLE_LANGUAGES.filter((o) => !tts.downloadedLanguages.includes(o.value));

  return (
    <VStack gap="3">
      <SettingsRow dense>
        <span className={styles.maTtsLabel}>Local speech (Supertonic)</span>
        <Toggle
          checked={tts.localTtsEnabled}
          onChange={setLocalTtsEnabled}
          ariaLabel="Turn local speech on or off"
        />
      </SettingsRow>

      {tts.localTtsEnabled && (
        <>
          {tts.downloadedLanguages.length > 0 && (
            <SettingsRow dense>
              <span className={styles.maTtsLabel}>Default playback language</span>
              <Select
                value={tts.localTtsLanguage}
                options={tts.downloadedLanguages.map((l) => ({ value: l, label: l }))}
                onChange={setLocalTtsLanguage}
                placeholder="Select a language"
              />
            </SettingsRow>
          )}

          <Text as="p" color="secondary" className={styles.maSectionLabel}>
            Downloaded voice packs
          </Text>

          {tts.downloadedLanguages.length === 0 && (
            <Text as="p" color="secondary">
              No voice packs downloaded yet.
            </Text>
          )}

          {tts.downloadedLanguages.map((lang) => {
            const hidden = tts.hiddenLanguages.includes(lang);
            return (
              <SettingsRow key={lang} dense>
                <div className={styles.maPackInfo}>
                  <span className={styles.maPackName}>{lang}</span>
                  {hidden && <span className={styles.maPackBadge}>Hidden</span>}
                </div>
                <HStack gap="1">
                  <Button
                    variant="ghost"
                    size="xs"
                    shape="circle"
                    onClick={() => toggleHiddenLanguage(lang)}
                    aria-label={hidden ? `Show ${lang}` : `Hide ${lang}`}
                  >
                    <Icon name={hidden ? 'eye' : 'eyeOff'} size="xs" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    shape="circle"
                    onClick={() => downloadLanguage(lang)}
                    aria-label={`Re-download ${lang}`}
                  >
                    <Icon name="rotateCcw" size="xs" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    shape="circle"
                    onClick={() => deleteLanguage(lang)}
                    aria-label={`Delete ${lang}`}
                  >
                    <Icon name="trash" size="xs" />
                  </Button>
                </HStack>
              </SettingsRow>
            );
          })}

          <SettingsRow dense>
            <Select
              value={selectedAdd}
              options={[{ value: '', label: 'Add a language' }, ...addOptions]}
              onChange={setSelectedAdd}
              placeholder="Add a language"
              className={styles.maAddSelect}
            />
            <Button
              variant="primary"
              size="sm"
              disabled={!selectedAdd}
              onClick={() => {
                downloadLanguage(selectedAdd);
                setSelectedAdd('');
              }}
            >
              Download
            </Button>
          </SettingsRow>
        </>
      )}
    </VStack>
  );
}
