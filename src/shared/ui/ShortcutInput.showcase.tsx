import { useState, type ReactElement } from 'react';
import { ShortcutInput, type ShortcutValue } from './ShortcutInput';
import { HStack, VStack } from './Stack';
import { Text } from './Text';

export function Showcase(): ReactElement {
  const [single, setSingle] = useState<ShortcutValue>({ key: 'r' });
  const [combo, setCombo] = useState<ShortcutValue>({ key: 't', ctrl: true, shift: true });
  const [arrow, setArrow] = useState<ShortcutValue>({ key: 'arrowleft' });
  const [space, setSpace] = useState<ShortcutValue>({ key: 'space' });

  return (
    <VStack gap="4">
      <Text as="h3" variant="heading-3" color="secondary">Shortcut input</Text>
      <Text as="p" variant="supporting" color="secondary">Focus the pill and press a key to capture. Modifiers (Ctrl/Shift/Alt) become part of the combo.</Text>
      <HStack gap="3" align="start" style={{ flexWrap: 'wrap' }}>
        <ShortcutInput value={single} onChange={setSingle} aria-label="Single key shortcut" />
        <ShortcutInput value={combo} onChange={setCombo} aria-label="Combo shortcut" />
        <ShortcutInput value={arrow} onChange={setArrow} aria-label="Arrow shortcut" />
        <ShortcutInput value={space} onChange={setSpace} aria-label="Space shortcut" />
      </HStack>
    </VStack>
  );
}

export const showcaseMeta = {
  title: 'Shortcut Input',
  description: 'Pill-style keyboard shortcut input supporting single keys, arrows, space, and modifier combos.',
  level: 'molecules',
  category: 'Input',
  group: 'Shared UI — Input',
  status: 'stable' as const,
  order: 90,
};
