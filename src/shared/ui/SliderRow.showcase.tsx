import { useState, type CSSProperties, type ReactElement } from 'react';
import { SliderRow } from './SliderRow';
import { Icon } from './Icon';
import { Text } from './Text';
import { VStack } from './Stack';

const wrapperStyle: CSSProperties = {
  width: '100%',
  maxWidth: 'min(100%, calc(var(--space-5) * 16))',
};

export function Showcase(): ReactElement {
  const [volume, setVolume] = useState(75);
  const [speed, setSpeed] = useState(1.2);

  return (
    <VStack gap="5" style={wrapperStyle}>
      <Text as="h3" variant="heading-3" color="secondary">Slider row variants</Text>
      <SliderRow
        icon={<Icon name="volumeHigh" size="sm" />}
        label="Âm lượng"
        hint="Điều chỉnh âm lượng phát lại mặc định."
        value={volume}
        min={0}
        max={100}
        step={1}
        onChange={setVolume}
        aria-label="Volume slider"
      />
      <SliderRow
        icon={<Icon name="gauge" size="sm" />}
        label="Tốc độ phát"
        value={speed}
        min={0.5}
        max={2}
        step={0.1}
        onChange={setSpeed}
        formatValue={(v) => `${v.toFixed(1)}x`}
        aria-label="Playback speed slider"
        variant="bubble"
        divider
      />
      <SliderRow
        icon={<Icon name="volumeMute" size="sm" />}
        label="Âm lượng tắt"
        hint="Slider bị vô hiệu hóa khi chưa có media."
        value={0}
        min={0}
        max={100}
        step={1}
        onChange={() => {}}
        aria-label="Disabled volume slider"
        disabled
        disabledNote="Mở video để bật điều khiển này."
      />
    </VStack>
  );
}

export const showcaseMeta = {
  title: 'Slider Row',
  description: 'Label group + slider with end/bubble value display, icon, hint tooltip, divider, and disabled note.',
  level: 'molecules',
  category: 'Input',
  group: 'Shared UI — Input',
  status: 'stable' as const,
  order: 85,
};
