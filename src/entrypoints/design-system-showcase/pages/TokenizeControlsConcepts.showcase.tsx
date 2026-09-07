import { useState, type ReactElement } from 'react';
import { HStack, VStack, Toggle, Button, Select, Text } from '@/shared/ui';
import { IconButton } from '@/shared/ui/IconButton';
import { Icon } from '@/shared/icons/Icon';
import styles from './TokenizeControlsConcepts.module.css';

type Variant = 'solid' | 'editorial' | 'industrial';
type TokenizeTarget = 'media' | 'text';

const PROFILES = [
  { value: 'en', label: 'English' },
  { value: 'vi', label: 'Tiếng Việt' },
];

interface TokenizeControlProps {
  readonly variant: Variant;
  readonly enabled: boolean;
  readonly onEnabledChange: (enabled: boolean) => void;
  readonly target: TokenizeTarget;
  readonly onTargetChange: (target: TokenizeTarget) => void;
  readonly disabled?: boolean;
}

function TokenizeControl({
  variant,
  enabled,
  onEnabledChange,
  target,
  onTargetChange,
  disabled = false,
}: TokenizeControlProps): ReactElement {
  const targetDisabled = disabled || !enabled;

  const common = (
    <Toggle
      checked={enabled}
      onChange={onEnabledChange}
      ariaLabel="Enable tokenize"
      title={`Tokenize: ${enabled ? 'ON' : 'OFF'}`}
      disabled={disabled}
      size="sm"
    />
  );

  if (variant === 'solid') {
    return (
      <div className={styles.solidControl} role="group" aria-label="Tokenize environment">
        <HStack align="center" gap="1">
          {common}
          <Text as="span" variant="supporting" color="primary">
            Tokenize
          </Text>
        </HStack>
        <HStack align="center" gap="0-5" role="radiogroup" aria-label="Tokenize target">
          <Button
            size="sm"
            shape="pill"
            variant={target === 'media' ? 'primarySubtle' : 'ghost'}
            disabled={targetDisabled}
            onClick={() => onTargetChange('media')}
            aria-pressed={target === 'media'}
            role="radio"
            aria-checked={target === 'media'}
          >
            Media
          </Button>
          <Button
            size="sm"
            shape="pill"
            variant={target === 'text' ? 'primarySubtle' : 'ghost'}
            disabled={targetDisabled}
            onClick={() => onTargetChange('text')}
            aria-pressed={target === 'text'}
            role="radio"
            aria-checked={target === 'text'}
          >
            Text
          </Button>
        </HStack>
      </div>
    );
  }

  if (variant === 'editorial') {
    const baseStyle = (isActive: boolean) => ({
      color: isActive
        ? 'var(--color-text-primary)'
        : targetDisabled
          ? 'var(--color-text-secondary)'
          : 'var(--color-text-secondary)',
      fontWeight: isActive ? 'var(--font-weight-semibold)' : 'var(--font-weight-normal)',
      textDecoration: isActive ? 'underline' : 'none',
      textUnderlineOffset: '4px',
      padding: 0,
      minWidth: 'auto',
    });

    return (
      <div className={styles.editorialControl} role="group" aria-label="Tokenize environment">
        <HStack align="center" gap="1">
          {common}
          <Text as="span" variant="supporting" color="primary">
            Tokenize
          </Text>
        </HStack>
        <HStack align="center" gap="2" role="radiogroup" aria-label="Tokenize target">
          <Button
            size="sm"
            variant="ghost"
            disabled={targetDisabled}
            onClick={() => onTargetChange('media')}
            aria-pressed={target === 'media'}
            role="radio"
            aria-checked={target === 'media'}
            style={baseStyle(target === 'media')}
          >
            Media
          </Button>
          <Text as="span" variant="supporting" color="secondary">·</Text>
          <Button
            size="sm"
            variant="ghost"
            disabled={targetDisabled}
            onClick={() => onTargetChange('text')}
            aria-pressed={target === 'text'}
            role="radio"
            aria-checked={target === 'text'}
            style={baseStyle(target === 'text')}
          >
            Text
          </Button>
        </HStack>
      </div>
    );
  }

  // industrial
  const industrialStyle = {
    borderRadius: 'var(--radius-sm)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    fontSize: 'var(--font-size-xs)',
  };

  return (
    <div className={styles.industrialControl} role="group" aria-label="Tokenize environment">
      <HStack align="center" gap="1" className={styles.industrialMaster}>
        {common}
        <Text as="span" variant="supporting" color="primary" className={styles.industrialLabel}>
          Tokenize
        </Text>
      </HStack>
      <HStack align="center" gap="0-5" role="radiogroup" aria-label="Tokenize target">
        <Button
          size="sm"
          shape="pill"
          variant={target === 'media' ? 'primary' : 'outline'}
          disabled={targetDisabled}
          onClick={() => onTargetChange('media')}
          aria-pressed={target === 'media'}
          role="radio"
          aria-checked={target === 'media'}
          style={industrialStyle}
        >
          Media
        </Button>
        <Button
          size="sm"
          shape="pill"
          variant={target === 'text' ? 'primary' : 'outline'}
          disabled={targetDisabled}
          onClick={() => onTargetChange('text')}
          aria-pressed={target === 'text'}
          role="radio"
          aria-checked={target === 'text'}
          style={industrialStyle}
        >
          Text
        </Button>
      </HStack>
    </div>
  );
}

interface ConceptPanelProps {
  readonly variant: Variant;
  readonly label: string;
}

function ConceptPanel({ variant, label }: ConceptPanelProps): ReactElement {
  const [profile, setProfile] = useState('en');
  const [status, setStatus] = useState(true);
  const [frequency, setFrequency] = useState(false);
  const [subtitle, setSubtitle] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [target, setTarget] = useState<TokenizeTarget>('media');

  return (
    <section className={styles.concept}>
      <Text as="h2" variant="supporting" color="secondary" className={styles.conceptLabel}>
        {label}
      </Text>
      <div className={styles.panel}>
        <header className={styles.panelHeader} aria-label="Universal panel header">
          <HStack align="center" gap="2" className={styles.panelHeaderLeft}>
            <Select
              className={styles.profileSelect}
              variant="ghost"
              size="sm"
              value={profile}
              options={PROFILES}
              placeholder="Select profile"
              onChange={setProfile}
              aria-label="Switch language profile"
              menuAlign="right"
            />
            <label className={styles.legacyToggle}>
              <span>Status</span>
              <Toggle
                checked={status}
                onChange={setStatus}
                ariaLabel="Toggle status badges"
                title={`Status: ${status ? 'ON' : 'OFF'}`}
                size="sm"
              />
            </label>
            <label className={styles.legacyToggle}>
              <span>Frequency</span>
              <Toggle
                checked={frequency}
                onChange={setFrequency}
                ariaLabel="Toggle frequency bands"
                title={`Frequency: ${frequency ? 'ON' : 'OFF'}`}
                size="sm"
              />
            </label>
            <label className={styles.legacyToggle}>
              <span>Subtitle</span>
              <Toggle
                checked={subtitle}
                onChange={setSubtitle}
                ariaLabel="Toggle subtitle tokenize"
                title={`Subtitle: ${subtitle ? 'ON' : 'OFF'}`}
                size="sm"
              />
            </label>
          </HStack>
          <HStack align="center" gap="2" className={styles.panelHeaderRight}>
            <TokenizeControl
              variant={variant}
              enabled={enabled}
              onEnabledChange={setEnabled}
              target={target}
              onTargetChange={setTarget}
            />
            <IconButton
              size="md"
              variant="ghost"
              aria-label="Close panel"
              onClick={() => {}}
              data-cell-id="universal-panel-close"
            >
              <Icon name="x" />
            </IconButton>
          </HStack>
        </header>
        <div className={styles.panelBody}>
          <Text as="span" variant="supporting" color="secondary">
            [ panel content — {target} page ]
          </Text>
        </div>
      </div>
    </section>
  );
}

export function Showcase(): ReactElement {
  return (
    <VStack gap="5" className={styles.page}>
      <Text as="h1" variant="heading-1" color="primary" className={styles.pageTitle}>
        Tokenize Header Concepts
      </Text>
      <ConceptPanel variant="solid" label="A. Solid Dewdrop" />
      <ConceptPanel variant="editorial" label="B. Minimalist Editorial" />
      <ConceptPanel variant="industrial" label="C. Industrial Brutalist Control Board" />
    </VStack>
  );
}

export const showcaseMeta = {
  title: 'Tokenize Controls Concepts',
  description: 'Three design concepts for the Universal Panel Tokenize environment switch: Solid, Minimalist Editorial, and Industrial Brutalist. Hỗ trợ user bật/tắt tokenize và chọn Media page / Text page.',
  level: 'pages' as const,
  category: 'Universal Panel',
  order: 60,
};
