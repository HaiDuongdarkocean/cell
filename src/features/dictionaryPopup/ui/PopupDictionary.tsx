import { Dictionary } from './Dictionary';
import type { DictionaryPopupProps } from './Dictionary';

export type PopupDictionaryProps = Omit<DictionaryPopupProps, 'variant'>;

export function PopupDictionary(props: PopupDictionaryProps): React.JSX.Element {
  return <Dictionary variant="popup" {...props} />;
}
