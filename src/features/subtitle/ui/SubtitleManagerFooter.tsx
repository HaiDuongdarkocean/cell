import type { Ref } from 'react';
import { FooterBar, type FooterBarSlot } from '@/shared/ui';
import { Icon } from '@/shared/icons/Icon';

export interface SubtitleManagerFooterProps {
  readonly onSearch: () => void;
  readonly searchBtnRef?: Ref<HTMLButtonElement>;
  readonly onCustomize?: () => void;
  readonly customizeBtnRef?: Ref<HTMLButtonElement>;
  readonly onHideBoth?: () => void;
  readonly bothHidden?: boolean;
  readonly onGenerateNative?: () => void;
  readonly generateNativeDisabled?: boolean;
}

export function SubtitleManagerFooter({
  onSearch,
  searchBtnRef,
  onCustomize,
  customizeBtnRef,
  onHideBoth,
  bothHidden = false,
  onGenerateNative,
  generateNativeDisabled = false,
}: SubtitleManagerFooterProps): React.JSX.Element {
  const slots: FooterBarSlot[] = [
    {
      key: 'search',
      icon: <Icon name="search" size={20} />,
      label: 'Search',
      onClick: onSearch,
      ref: searchBtnRef,
      buttonProps: { title: 'Search subtitles', 'data-cell-id': 'manager-search-subtitles' },
    },
    ...(onCustomize
      ? [{
          key: 'customize',
          icon: <Icon name="slidersHorizontal" size={20} />,
          label: 'Customize',
          onClick: onCustomize,
          ref: customizeBtnRef,
          buttonProps: { title: 'Customize appearance', 'data-cell-id': 'manager-customize-appearance' },
        }]
      : []),
    ...(onHideBoth
      ? [{
          key: 'hide',
          icon: <Icon name="eyeOff" size={20} />,
          label: bothHidden ? 'Show' : 'Hide',
          active: bothHidden,
          onClick: onHideBoth,
          buttonProps: { title: bothHidden ? 'Show both' : 'Hide both', 'data-cell-id': 'manager-hide-both' },
        }]
      : []),
    ...(onGenerateNative
      ? [{
          key: 'generate',
          icon: <Icon name="languages" size={20} />,
          label: 'Generate',
          disabled: generateNativeDisabled,
          onClick: onGenerateNative,
          buttonProps: { title: 'Generate native', 'data-cell-id': 'manager-generate-native' },
        }]
      : []),
  ];

  return <FooterBar slots={slots} />;
}
