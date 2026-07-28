import { useState, useEffect, type ChangeEvent, type ReactNode } from 'react';
import {
  Accordion,
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Dialog,
  Drawer,
  EmptyState,
  FormGroup,
  IconButton,
  Input,
  InputField,
  Label,
  ListItem,
  NavItem,
  Progress,
  RadioGroup,
  SearchField,
  Select,
  Skeleton,
  Spinner,
  Tabs,
  Textarea,
  Toggle,
  Tooltip,
} from '@/shared/ui';
import { Icon } from '@/shared/icons/Icon';
import { ICON_CATALOG } from '@/shared/icons';
import tokens from '@/shared/styles/tokens.json';
import { UniversalPanel } from '@/features/universalPanel/UniversalPanel';
import styles from './App.module.css';

type ThemeMode = 'light' | 'dark';

function ThemeToggle({ mode, onToggle }: { mode: ThemeMode; onToggle: () => void }) {
  return (
    <button
      type="button"
      className={styles.themeToggle}
      onClick={onToggle}
      aria-label={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`}
    >
      <Icon name={mode === 'light' ? 'moon' : 'sun'} size={18} />
      <span>{mode === 'light' ? 'Dark' : 'Light'}</span>
    </button>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}

function getContrastColor(hex: string) {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#0f172a' : '#ffffff';
}

function TokenSwatches({ mode }: { mode: ThemeMode }) {
  const core = mode === 'dark' ? tokens.core.dark : tokens.core.light;
  return (
    <div className={styles.tokenGrid}>
      {(Object.keys(core) as Array<keyof typeof core>).map((key) => (
        <div key={String(key)} className={styles.tokenSwatch}>
          <div
            className={styles.swatchColor}
            style={{
              background: core[key],
              color: getContrastColor(core[key]),
            }}
          >
            {String(key)}
          </div>
          <code className={styles.swatchValue}>{core[key]}</code>
        </div>
      ))}
    </div>
  );
}

function SpacingScale() {
  const spacing = tokens.static.spacing;
  return (
    <div className={styles.scaleGrid}>
      {(Object.keys(spacing) as Array<keyof typeof spacing>).map((key) => (
        <div key={String(key)} className={styles.scaleItem}>
          <div
            className={styles.scaleBar}
            style={{ width: spacing[key], minWidth: '4px' }}
          />
          <span className={styles.scaleLabel}>--space-{String(key)}</span>
          <span className={styles.scaleValue}>{spacing[key]}</span>
        </div>
      ))}
    </div>
  );
}

function TypographyScale() {
  const sizes = tokens.static.font.sizes;
  const weights = tokens.static.font.weights;
  return (
    <div className={styles.typeStack}>
      {(Object.keys(sizes) as Array<keyof typeof sizes>).map((key) => (
        <div key={String(key)} className={styles.typeRow}>
          <span className={styles.typeName}>--font-size-{String(key)}</span>
          <span className={styles.typeValue} style={{ fontSize: sizes[key] }}>{sizes[key]}</span>
        </div>
      ))}
      <div className={styles.typeWeights}>
        {(Object.keys(weights) as Array<keyof typeof weights>).map((key) => (
          <span key={String(key)} style={{ fontWeight: weights[key] }}>
            {String(key)} ({weights[key]})
          </span>
        ))}
      </div>
    </div>
  );
}

function IconGrid() {
  const iconNames = Object.keys(ICON_CATALOG) as Array<keyof typeof ICON_CATALOG>;
  return (
    <div className={styles.iconGrid}>
      {iconNames.map((name) => (
        <div key={name} className={styles.iconItem}>
          <Icon name={name} size={24} />
          <span className={styles.iconName}>{name}</span>
        </div>
      ))}
    </div>
  );
}

function ComponentShowcase() {
  const [toggleOn, setToggleOn] = useState(false);
  const [checkboxOn, setCheckboxOn] = useState(false);
  const [radio, setRadio] = useState('a');
  const [tab, setTab] = useState('tab1');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const buttonVariants = ['primary', 'secondary', 'outline', 'ghost', 'destructive', 'link'] as const;
  const buttonSizes = ['sm', 'md', 'lg'] as const;
  const badgeVariants = ['default', 'secondary', 'outline', 'destructive', 'success', 'warning'] as const;
  const alertVariants = ['default', 'success', 'warning', 'error'] as const;
  const cardVariants = ['default', 'interactive', 'selected'] as const;

  return (
    <div className={styles.componentStack}>
      <div className={styles.componentGroup}>
        <h3>Button</h3>
        <div className={styles.variantRow}>
          {buttonVariants.map((variant) => (
            <Button key={variant} variant={variant}>{variant}</Button>
          ))}
        </div>
        <div className={styles.variantRow}>
          {buttonSizes.map((size) => (
            <Button key={size} size={size}>{size}</Button>
          ))}
        </div>
        <div className={styles.variantRow}>
          <Button loading>Loading</Button>
          <Button disabled>Disabled</Button>
          <Button leadingIcon={<Icon name="download" size={16} />}>Icon</Button>
        </div>
      </div>

      <div className={styles.componentGroup}>
        <h3>Card</h3>
        <div className={styles.variantRow}>
          {cardVariants.map((variant) => (
            <Card key={variant} variant={variant} style={{ padding: 'var(--space-4)', minWidth: '140px' }}>
              {variant}
            </Card>
          ))}
        </div>
      </div>

      <div className={styles.componentGroup}>
        <h3>Input</h3>
        <div className={styles.variantRow}>
          <Input placeholder="Default" />
          <Input defaultValue="With value" readOnly />
          <Input error errorMessage="This field is required" placeholder="Error" />
        </div>
      </div>

      <div className={styles.componentGroup}>
        <h3>Badge</h3>
        <div className={styles.variantRow}>
          {badgeVariants.map((variant) => (
            <Badge key={variant} variant={variant}>{variant}</Badge>
          ))}
        </div>
      </div>

      <div className={styles.componentGroup}>
        <h3>Toggle / Checkbox / Radio</h3>
        <div className={styles.variantRow}>
          <Toggle checked={toggleOn} onChange={setToggleOn} ariaLabel="Demo toggle" />
          <Checkbox
            checked={checkboxOn}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setCheckboxOn(e.target.checked)}
            label="Check me"
          />
          <RadioGroup
            name="demo"
            value={radio}
            onChange={setRadio}
            options={[
              { value: 'a', label: 'A' },
              { value: 'b', label: 'B' },
            ]}
          />
        </div>
      </div>

      <div className={styles.componentGroup}>
        <h3>Alert</h3>
        <div className={styles.stack}>
          {alertVariants.map((variant) => (
            <Alert
              key={variant}
              variant={variant}
              title={variant}
              description={`This is a ${variant} alert.`}
            />
          ))}
        </div>
      </div>

      <div className={styles.componentGroup}>
        <h3>Dialog & Drawer</h3>
        <div className={styles.variantRow}>
          <Button onClick={() => setDialogOpen(true)}>Open Dialog</Button>
          <Button onClick={() => setDrawerOpen(true)} variant="secondary">Open Drawer</Button>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen} title="Demo Dialog" showCloseButton>
          <p>Dialog content goes here.</p>
          <Button onClick={() => setDialogOpen(false)}>Close</Button>
        </Dialog>
        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} title="Demo Drawer">
          <p>Drawer content goes here.</p>
        </Drawer>
      </div>

      <div className={styles.componentGroup}>
        <h3>Tabs</h3>
        <Tabs value={tab} onValueChange={setTab}>
          <Tabs.List>
            <Tabs.Trigger value="tab1">Tab 1</Tabs.Trigger>
            <Tabs.Trigger value="tab2">Tab 2</Tabs.Trigger>
            <Tabs.Trigger value="tab3">Tab 3</Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value="tab1">Content 1</Tabs.Content>
          <Tabs.Content value="tab2">Content 2</Tabs.Content>
          <Tabs.Content value="tab3">Content 3</Tabs.Content>
        </Tabs>
      </div>

      <div className={styles.componentGroup}>
        <h3>Form Group / Input Field</h3>
        <FormGroup label="Form group">
          <Input placeholder="Inside form" />
        </FormGroup>
        <InputField label="Input field" helperText="With helper text" placeholder="Type here" />
      </div>

      <div className={styles.componentGroup}>
        <h3>Progress / Spinner / Skeleton</h3>
        <div className={styles.variantRow}>
          <Progress value={60} max={100} />
          <Spinner size="md" />
          <Skeleton width={120} height={16} />
        </div>
      </div>

      <div className={styles.componentGroup}>
        <h3>List / Nav / Select / SearchField</h3>
        <ListItem trailing={<Badge>3</Badge>}>List item</ListItem>
        <NavItem active icon={<Icon name="bookOpen" size={18} />} label="Active nav" />
        <NavItem icon={<Icon name="settings" size={18} />} label="Inactive nav" />
        <Select
          value="one"
          onChange={() => {}}
          options={[
            { value: 'one', label: 'One' },
            { value: 'two', label: 'Two' },
          ]}
        />
        <SearchField placeholder="Search..." value="" onChange={() => {}} />
      </div>

      <div className={styles.componentGroup}>
        <h3>IconButton / Tooltip / Textarea</h3>
        <div className={styles.variantRow}>
          <IconButton variant="ghost" aria-label="Settings">
            <Icon name="settings" size={20} />
          </IconButton>
          <Tooltip content="Tooltip text">
            <span>Hover me</span>
          </Tooltip>
        </div>
        <Textarea placeholder="Textarea" />
      </div>

      <div className={styles.componentGroup}>
        <h3>Empty State</h3>
        <EmptyState
          title="Nothing here"
          description="This is an empty state."
          action={<Button>Action</Button>}
        />
      </div>

      <div className={styles.componentGroup}>
        <h3>Accordion</h3>
        <Accordion defaultValue="a">
          <Accordion.Item value="a">
            <Accordion.Trigger>Section 1</Accordion.Trigger>
            <Accordion.Content>Content 1</Accordion.Content>
          </Accordion.Item>
          <Accordion.Item value="b">
            <Accordion.Trigger>Section 2</Accordion.Trigger>
            <Accordion.Content>Content 2</Accordion.Content>
          </Accordion.Item>
        </Accordion>
      </div>

      <div className={styles.componentGroup}>
        <h3>Label</h3>
        <Label required>Required label</Label>
        <Label disabled>Disabled label</Label>
      </div>
    </div>
  );
}

function UniversalPanelPreview() {
  const [isOpen, setIsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'dictionary' | 'settings'>('dictionary');
  const [tokenize, setTokenize] = useState({ enabled: true, showStatus: true, showFrequency: false });

  return (
    <div className={styles.panelPreview}>
      <Button onClick={() => setIsOpen(true)}>Open Universal Panel</Button>
      <UniversalPanel
        isOpen={isOpen}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onClose={() => setIsOpen(false)}
        tokenizeState={tokenize}
        onToggleTokenize={(key) => setTokenize((s) => ({ ...s, [key]: !s[key] }))}
        dictionaryPanel={
          <Card style={{ padding: 'var(--space-4)' }}>
            <h4>Dictionary</h4>
            <p>Dictionary tab content preview.</p>
            <Input placeholder="Search word" />
          </Card>
        }
        settingsPanel={
          <Card style={{ padding: 'var(--space-4)' }}>
            <h4>Settings</h4>
            <Toggle
              checked={tokenize.enabled}
              onChange={(v) => setTokenize((s) => ({ ...s, enabled: v }))}
              ariaLabel="Enable tokenize"
            />
            <Label>Enable tokenize</Label>
          </Card>
        }
      />
    </div>
  );
}

export function App() {
  const [mode, setMode] = useState<ThemeMode>('light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode);
  }, [mode]);

  const toggleMode = () => setMode((m) => (m === 'light' ? 'dark' : 'light'));

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Cell Design System</h1>
          <p className={styles.subtitle}>Single source of truth for components, tokens, and patterns.</p>
        </div>
        <ThemeToggle mode={mode} onToggle={toggleMode} />
      </header>

      <main className={styles.main}>
        <Section title="Color Tokens">
          <TokenSwatches mode={mode} />
        </Section>

        <Section title="Spacing Scale">
          <SpacingScale />
        </Section>

        <Section title="Typography">
          <TypographyScale />
        </Section>

        <Section title="Icons">
          <IconGrid />
        </Section>

        <Section title="Components">
          <ComponentShowcase />
        </Section>

        <Section title="Universal Panel">
          <UniversalPanelPreview />
        </Section>
      </main>
    </div>
  );
}
