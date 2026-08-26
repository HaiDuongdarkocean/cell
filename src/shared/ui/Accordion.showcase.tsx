import { useState, type ReactElement } from 'react';
import { Accordion } from './Accordion';

const rootStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-6)',
};

const panelStyle: React.CSSProperties = {
  maxWidth: 'calc(var(--space-5) * 20)',
  border: 'var(--border-width-hairline) solid var(--color-border-subtle)',
  borderRadius: 'var(--radius-card)',
  overflow: 'hidden',
  background: 'var(--color-surface)',
};

const labelStyle: React.CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  fontWeight: 'var(--font-weight-medium)',
  color: 'var(--color-text-secondary)',
  letterSpacing: 'var(--tracking-tight)',
  textTransform: 'uppercase',
};

const contentInnerStyle: React.CSSProperties = {
  paddingRight: 'var(--space-4)',
};

export function Showcase(): ReactElement {
  const [value, setValue] = useState<string | string[]>(['a']);

  return (
    <div style={rootStyle}>
      <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <div style={labelStyle}>Single (uncontrolled)</div>
        <div style={panelStyle}>
          <Accordion type="single" defaultValue="general">
            <Accordion.Item value="general">
              <Accordion.Trigger>General questions</Accordion.Trigger>
              <Accordion.Content>
                <div style={contentInnerStyle}>
                  Common questions about the extension and how to get started.
                </div>
              </Accordion.Content>
            </Accordion.Item>

            <Accordion.Item value="billing">
              <Accordion.Trigger>Billing</Accordion.Trigger>
              <Accordion.Content>
                <div style={contentInnerStyle}>
                  Manage payment methods, invoices, and subscription details.
                </div>
              </Accordion.Content>
            </Accordion.Item>

            <Accordion.Item value="support">
              <Accordion.Trigger>Support</Accordion.Trigger>
              <Accordion.Content>
                <div style={contentInnerStyle}>
                  Reach out through the help center or community forums.
                </div>
              </Accordion.Content>
            </Accordion.Item>
          </Accordion>
        </div>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <div style={labelStyle}>Multiple (controlled)</div>
        <div style={panelStyle}>
          <Accordion
            type="multiple"
            value={value}
            onValueChange={setValue}
          >
            <Accordion.Item value="a">
              <Accordion.Trigger>Download settings</Accordion.Trigger>
              <Accordion.Content>
                <div style={contentInnerStyle}>
                  Configure the default download folder, quality, and filename.
                </div>
              </Accordion.Content>
            </Accordion.Item>

            <Accordion.Item value="b">
              <Accordion.Trigger>Subtitle preferences</Accordion.Trigger>
              <Accordion.Content>
                <div style={contentInnerStyle}>
                  Choose native, translated, or dual subtitle rendering.
                </div>
              </Accordion.Content>
            </Accordion.Item>

            <Accordion.Item value="c">
              <Accordion.Trigger>Dictionary sources</Accordion.Trigger>
              <Accordion.Content>
                <div style={contentInnerStyle}>
                  Enable or disable dictionaries for quick word lookups.
                </div>
              </Accordion.Content>
            </Accordion.Item>
          </Accordion>
        </div>
      </section>
    </div>
  );
}

export const showcaseMeta = {
  title: 'Accordion',
  description: 'Collapsible sections that support single or multiple expanded items, with controlled and uncontrolled modes.',
  level: 'molecules',
  category: 'Display',
  status: 'stable' as const,
};
