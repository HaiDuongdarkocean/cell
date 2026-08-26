import { useState } from 'react';
import type { ReactElement } from 'react';
import { FooterBar, type FooterBarSlot } from '@/shared/ui';
import { Icon } from '@/shared/icons/Icon';

/* ─── Showcase primitives — dùng token, không hardcode ─── */

const sectionStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2)',
};

const labelStyle: React.CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  fontWeight: 'var(--font-weight-medium)',
  color: 'var(--color-text-secondary)',
  letterSpacing: 'var(--tracking-tight)',
  textTransform: 'uppercase',
};

const descStyle: React.CSSProperties = {
  fontSize: 'var(--font-size-sm)',
  color: 'var(--color-text-secondary)',
  lineHeight: 'var(--leading-normal)',
  margin: 0,
};

const codeStyle: React.CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  fontFamily: 'var(--font-family-mono, monospace)',
  background: 'var(--color-surface-hover)',
  color: 'var(--color-text-primary)',
  padding: 'var(--space-2) var(--space-3)',
  borderRadius: 'var(--radius-sm)',
  lineHeight: 'var(--leading-relaxed)',
  overflow: 'auto',
  margin: 0,
  whiteSpace: 'pre',
};

const panelMockStyle: React.CSSProperties = {
  background: 'var(--color-surface)',
  borderRadius: 'var(--radius-card)',
  overflow: 'hidden',
  border: 'var(--border-width-hairline) solid var(--color-border-subtle)',
  boxShadow: 'var(--shadow-popover)',
};

const contentPlaceholderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 'var(--font-size-xs)',
  color: 'var(--color-text-tertiary, var(--color-text-secondary))',
  textAlign: 'center',
};

/* ─── Showcase ─── */

export function Showcase(): ReactElement {
  const [activeIdx, setActiveIdx] = useState(0);

  const navSlots: FooterBarSlot[] = [
    { key: 'home', icon: <Icon name="search" size={20} />, label: 'Home', active: activeIdx === 0, onClick: () => setActiveIdx(0) },
    { key: 'search', icon: <Icon name="slidersHorizontal" size={20} />, label: 'Search', active: activeIdx === 1, onClick: () => setActiveIdx(1) },
    { key: 'settings', icon: <Icon name="eyeOff" size={20} />, label: 'Settings', active: activeIdx === 2, onClick: () => setActiveIdx(2) },
    { key: 'profile', icon: <Icon name="generateNative" size={20} />, label: 'Profile', variant: 'primarySubtle', onClick: () => setActiveIdx(3) },
  ];

  const minimalSlots: FooterBarSlot[] = [
    { key: 'back', icon: <Icon name="search" size={20} />, label: 'Back', onClick: () => {} },
    { key: 'next', icon: <Icon name="generateNative" size={20} />, label: 'Next', variant: 'primarySubtle', onClick: () => {} },
  ];

  const toggleSlots: FooterBarSlot[] = [
    { key: 'show', icon: <Icon name="eyeOff" size={20} />, label: 'Show', active: true, onClick: () => {} },
    { key: 'hide', icon: <Icon name="eyeOff" size={20} />, label: 'Hide', onClick: () => {} },
  ];

  const disabledSlots: FooterBarSlot[] = [
    { key: 'ok', icon: <Icon name="search" size={20} />, label: 'OK', onClick: () => {} },
    { key: 'save', icon: <Icon name="generateNative" size={20} />, label: 'Save', variant: 'primarySubtle', disabled: true, onClick: () => {} },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', maxWidth: 480 }}>
      {/* ── Section 1: Default — 4 slots in context ── */}
      <section style={sectionStyle}>
        <div style={labelStyle}>Default · 4 slots</div>
        <p style={descStyle}>
          Equal-width slots, edge-to-edge. Ghost variant for navigation, primarySubtle for the featured action.
          Click any slot to toggle active state.
        </p>
        <div style={panelMockStyle}>
          <div style={{ ...contentPlaceholderStyle, padding: 'var(--space-8)', minHeight: 120 }}>
            Panel content area
          </div>
          <FooterBar slots={navSlots} />
        </div>
        <pre style={codeStyle}>{`<FooterBar slots={[
  { key: 'home', icon: <Icon name="search" />, label: 'Home', onClick: ... },
  { key: 'profile', icon: <Icon name="user" />, label: 'Profile',
    variant: 'primarySubtle', onClick: ... },
]} />`}</pre>
      </section>

      {/* ── Section 2: Active state — toggle ── */}
      <section style={sectionStyle}>
        <div style={labelStyle}>Active state · toggle</div>
        <p style={descStyle}>
          Active slot gets pale-blue subtle background + primary color.
          Use for persistent toggle states (show/hide, on/off).
        </p>
        <div style={panelMockStyle}>
          <div style={{ ...contentPlaceholderStyle, padding: 'var(--space-6)', minHeight: 80 }}>
            Toggle example
          </div>
          <FooterBar slots={toggleSlots} />
        </div>
      </section>

      {/* ── Section 3: Minimal — 2 slots ── */}
      <section style={sectionStyle}>
        <div style={labelStyle}>Minimal · 2 slots</div>
        <p style={descStyle}>
          FooterBar adapts to any slot count. Two slots for simple back/next or confirm/cancel patterns.
        </p>
        <div style={panelMockStyle}>
          <div style={{ ...contentPlaceholderStyle, padding: 'var(--space-6)', minHeight: 80 }}>
            Minimal footer
          </div>
          <FooterBar slots={minimalSlots} />
        </div>
      </section>

      {/* ── Section 4: Disabled state ── */}
      <section style={sectionStyle}>
        <div style={labelStyle}>Disabled state</div>
        <p style={descStyle}>
          Disabled slots are visually dimmed and non-interactive. Use when an action is unavailable
          (e.g. &quot;Save&quot; when nothing changed).
        </p>
        <div style={panelMockStyle}>
          <div style={{ ...contentPlaceholderStyle, padding: 'var(--space-6)', minHeight: 80 }}>
            Disabled example
          </div>
          <FooterBar slots={disabledSlots} />
        </div>
      </section>

      {/* ── Section 5: Props reference ── */}
      <section style={sectionStyle}>
        <div style={labelStyle}>Props · FooterBarSlot</div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          gap: 'var(--space-1) var(--space-3)',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-text-secondary)',
        }}>
          <code style={{ color: 'var(--color-primary)', fontWeight: 'var(--font-weight-semibold)' }}>key</code>
          <span>Unique string — React list key</span>
          <code style={{ color: 'var(--color-primary)', fontWeight: 'var(--font-weight-semibold)' }}>icon</code>
          <span>ReactNode — icon above label</span>
          <code style={{ color: 'var(--color-primary)', fontWeight: 'var(--font-weight-semibold)' }}>label</code>
          <span>ReactNode — text below icon</span>
          <code style={{ color: 'var(--color-primary)', fontWeight: 'var(--font-weight-semibold)' }}>variant</code>
          <span>&apos;ghost&apos; (default) | &apos;primarySubtle&apos; (featured)</span>
          <code style={{ color: 'var(--color-primary)', fontWeight: 'var(--font-weight-semibold)' }}>active</code>
          <span>boolean — pale-blue bg + primary color</span>
          <code style={{ color: 'var(--color-primary)', fontWeight: 'var(--font-weight-semibold)' }}>disabled</code>
          <span>boolean — dimmed, non-interactive</span>
          <code style={{ color: 'var(--color-primary)', fontWeight: 'var(--font-weight-semibold)' }}>onClick</code>
          <span>() ={'>'} void — click handler</span>
          <code style={{ color: 'var(--color-primary)', fontWeight: 'var(--font-weight-semibold)' }}>ref</code>
          <span>Ref&lt;HTMLButtonElement&gt; — forwarded</span>
          <code style={{ color: 'var(--color-primary)', fontWeight: 'var(--font-weight-semibold)' }}>buttonProps</code>
          <span>title, data-cell-id, aria-* passthrough</span>
        </div>
      </section>

      {/* ── Section 6: Reuse pattern ── */}
      <section style={sectionStyle}>
        <div style={labelStyle}>Reuse · thin wrapper pattern</div>
        <p style={descStyle}>
          For feature-specific footers, create a thin wrapper that maps domain props to FooterBarSlot[].
          This keeps FooterBar generic while the wrapper encodes feature knowledge.
        </p>
        <pre style={codeStyle}>{`// features/settings/ui/SettingsFooter.tsx
import { FooterBar, type FooterBarSlot } from '@/shared/ui';

export function SettingsFooter({ onReset, onSave, isDirty }) {
  const slots: FooterBarSlot[] = [
    { key: 'reset', icon: <Icon name="undo" />, label: 'Reset',
      onClick: onReset, disabled: !isDirty },
    { key: 'save', icon: <Icon name="check" />, label: 'Save',
      variant: 'primarySubtle', onClick: onSave, disabled: !isDirty },
  ];
  return <FooterBar slots={slots} />;
}`}</pre>
      </section>
    </div>
  );
}

export const showcaseMeta = {
  title: 'FooterBar',
  description: 'Generic bottom navigation bar — ZaloPay / iOS tab bar / Material 3 pattern. Equal-width slots, flat (no border-radius), soft shadow separator, height = content. Reusable across any panel needing footer navigation.',
  level: 'atoms',
  category: 'Layout',
  group: 'Navigation',
  order: 15,
};
