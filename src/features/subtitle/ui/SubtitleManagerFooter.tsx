import type { Ref } from 'react';
import { t } from '@/shared/i18n';
import { FooterBar } from '@/shared/ui/FooterBar';
import type { FooterBarSlot } from '@/shared/ui/FooterBar';
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
  readonly onOcr?: () => void;
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
  onOcr,
}: SubtitleManagerFooterProps): React.JSX.Element {
  const slots: FooterBarSlot[] = [
    {
      key: 'search',
      icon: <Icon name="search"  />,
      label: t('subtitle.search.title'),
      onClick: onSearch,
      ref: searchBtnRef,
      buttonProps: { title: t('subtitle.search.submit'), 'data-cell-id': 'manager-search-subtitles' },
    },
    ...(onOcr
      ? [{
          key: 'ocr',
          icon: <Icon name="captions"  />,
          label: t('subtitle.ocr.label'),
          onClick: onOcr,
          buttonProps: { title: t('subtitle.ocr.settingsTitle'), 'data-cell-id': 'manager-ocr-settings' },
        }]
      : []),
    ...(onCustomize
      ? [{
          key: 'customize',
          icon: <Icon name="slidersHorizontal"  />,
          label: t('subtitle.customize.title'),
          onClick: onCustomize,
          ref: customizeBtnRef,
          buttonProps: { title: t('subtitle.customize.buttonTitle'), 'data-cell-id': 'manager-customize-appearance' },
        }]
      : []),
    ...(onHideBoth
      ? [{
          key: 'hide',
          icon: <Icon name="eyeOff"  />,
          label: bothHidden ? t('subtitle.action.show') : t('subtitle.action.hide'),
          active: bothHidden,
          onClick: onHideBoth,
          buttonProps: { title: bothHidden ? t('subtitle.manager.showBoth') : t('subtitle.manager.hideBoth'), 'data-cell-id': 'manager-hide-both' },
        }]
      : []),
    ...(onGenerateNative
      ? [{
          key: 'generate',
          icon: <Icon name="languages"  />,
          label: t('subtitle.generate.label'),
          ripplePulse: true,
          disabled: generateNativeDisabled,
          onClick: onGenerateNative,
          buttonProps: { title: t('subtitle.generate.buttonTitle'), 'data-cell-id': 'manager-generate-native' },
        }]
      : []),
  ];

  return <FooterBar slots={slots} />;
}
