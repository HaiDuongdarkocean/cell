import { useState, type ReactElement } from 'react';
import { Tabs } from './Tabs';

export function Showcase(): ReactElement {
  const [value, setValue] = useState('preview');

  return (
    <Tabs value={value} onValueChange={setValue}>
      <Tabs.List>
        <Tabs.Trigger value="preview">Preview</Tabs.Trigger>
        <Tabs.Trigger value="code">Code</Tabs.Trigger>
        <Tabs.Trigger value="settings">Settings</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="preview">
        <p>Preview panel content.</p>
      </Tabs.Content>
      <Tabs.Content value="code">
        <p>Code panel content.</p>
      </Tabs.Content>
      <Tabs.Content value="settings">
        <p>Settings panel content.</p>
      </Tabs.Content>
    </Tabs>
  );
}

export const showcaseMeta = {
  title: 'Tabs',
  level: 'atoms',
  category: 'Overlay',
  group: 'Shared UI — Overlay',
  order: 52,
};
