import { type CSSProperties, type ReactElement } from 'react';
import { Badge } from './Badge';
import { Icon } from './Icon';
import { LabelGroup } from './LabelGroup';
import { Text } from './Text';
import { VStack } from './Stack';

const wrapperStyle: CSSProperties = {
  width: '100%',
  maxWidth: 'min(100%, calc(var(--space-5) * 16))',
};

export function Showcase(): ReactElement {
  return (
    <VStack gap="4" style={wrapperStyle}>
      <Text as="h3" variant="heading-3" color="secondary">Label with icon</Text>
      <LabelGroup icon={<Icon name="languages" size="sm" />} label="Ngôn ngữ" />
      <Text as="h3" variant="heading-3" color="secondary">Label with sublabel</Text>
      <LabelGroup
        icon={<Icon name="sun" size="sm" />}
        label="Giao diện"
        sublabel="Chọn chủ đề sáng hoặc tối cho popup."
      />
      <Text as="h3" variant="heading-3" color="secondary">Label with hint</Text>
      <LabelGroup
        icon={<Icon name="gauge" size="sm" />}
        label="Tốc độ"
        hint="Tốc độ phát mặc định cho video mới."
      />
      <Text as="h3" variant="heading-3" color="secondary">Label with trailing</Text>
      <LabelGroup
        icon={<Icon name="bookOpen" size="sm" />}
        label="Từ điển"
        trailing={<Badge size="sm" variant="success">Đã bật</Badge>}
      />
    </VStack>
  );
}

export const showcaseMeta = {
  title: 'Label Group',
  description: 'Icon + label with optional sublabel, hint tooltip, and trailing element for settings rows.',
  level: 'molecules',
  category: 'Input',
  group: 'Shared UI — Input',
  status: 'stable' as const,
  order: 87,
};
