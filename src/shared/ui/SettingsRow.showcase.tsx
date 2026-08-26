import { useState, type CSSProperties, type ReactElement } from 'react';
import { Icon } from './Icon';
import { Input } from './Input';
import { LabelGroup } from './LabelGroup';
import { SettingsRow } from './SettingsRow';
import { Text } from './Text';
import { Toggle } from './Toggle';
import { VStack } from './Stack';

const wrapperStyle: CSSProperties = {
  width: '100%',
  maxWidth: 'min(100%, calc(var(--space-5) * 20))',
};

export function Showcase(): ReactElement {
  const [darkMode, setDarkMode] = useState(false);
  const [autoplay, setAutoplay] = useState(true);

  return (
    <VStack gap="4" style={wrapperStyle}>
      <Text as="h3" variant="heading-3" color="secondary">Horizontal rows</Text>
      <VStack gap="0">
        <SettingsRow>
          <LabelGroup icon={<Icon name="moon" size="sm" />} label="Dark mode" />
          <Toggle checked={darkMode} onChange={setDarkMode} ariaLabel="Toggle dark mode" />
        </SettingsRow>
        <SettingsRow divider>
          <LabelGroup icon={<Icon name="play" size="sm" />} label="Tự động phát" />
          <Toggle checked={autoplay} onChange={setAutoplay} ariaLabel="Toggle autoplay" />
        </SettingsRow>
      </VStack>
      <Text as="h3" variant="heading-3" color="secondary">Stacked row</Text>
      <SettingsRow stacked>
        <LabelGroup
          icon={<Icon name="messageSquare" size="sm" />}
          label="Nhãn dán"
          sublabel="Hiển thị dịch nghĩa bên dưới phụ đề."
        />
        <Input value="" placeholder="Nhập mẫu nhãn" onChange={() => {}} />
      </SettingsRow>
      <Text as="h3" variant="heading-3" color="secondary">Compact row</Text>
      <SettingsRow compact>
        <LabelGroup icon={<Icon name="zap" size="sm" />} label="Tải nhanh" />
        <Toggle checked={autoplay} onChange={setAutoplay} ariaLabel="Toggle quick download" size="sm" />
      </SettingsRow>
    </VStack>
  );
}

export const showcaseMeta = {
  title: 'Settings Row',
  description: 'Horizontal settings row with space-between parts, stacked, divider, and compact variants.',
  level: 'molecules',
  category: 'Input',
  group: 'Shared UI — Input',
  status: 'stable' as const,
  order: 89,
};
