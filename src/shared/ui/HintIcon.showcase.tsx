import { type ReactElement } from 'react';
import { HintIcon } from './HintIcon';
import { HStack, VStack } from './Stack';
import { Text } from './Text';

export function Showcase(): ReactElement {
  return (
    <VStack gap="4">
      <Text as="h3" variant="heading-3" color="secondary">Hint icon</Text>
      <Text as="p" variant="supporting" color="secondary">Click the info icon to reveal a floating hint with boundary-aware positioning.</Text>
      <HStack gap="3" align="start" style={{ flexWrap: 'wrap' }}>
        <HintIcon
          hint="Tính năng này cần mở video trước khi dùng."
          ariaLabel="Why video is required"
        />
        <HintIcon
          hint="Phím tắt mặc định có thể thay đổi trong Cài đặt > Phím tắt. Bạn có thể gán tổ hợp Ctrl/Shift/Alt + phím bất kỳ."
          ariaLabel="Shortcut customization info"
        />
      </HStack>
    </VStack>
  );
}

export const showcaseMeta = {
  title: 'Hint Icon',
  description: 'Info button with a floating popover and boundary detection (flip-top, align-right, align-center).',
  level: 'molecules',
  category: 'Feedback',
  group: 'Shared UI — Feedback',
  status: 'stable' as const,
  order: 91,
};
