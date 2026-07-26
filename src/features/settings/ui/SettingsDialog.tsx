import type { Settings } from '@/entities/media';
import { Dialog } from '@/shared/ui/Dialog';
import type { TokenizePanelState } from './TokenizeSettingsPanel';
import { SettingsDialogContent } from './SettingsDialogContent';

interface SettingsDialogProps {
  isOpen: boolean;
  settings: Settings;
  onChange: (settings: Settings) => void;
  onClose: () => void;
  /** ADR-061: Tokenize section — only provided when mounted in the orbital
   *  badge panel (content-script). Popup/sidepanel/options don't have
   *  tokenize runtime state, so these stay undefined there. */
  readonly tokenizeState?: TokenizePanelState;
  readonly onToggleTokenize?: (key: 'enabled' | 'showStatus' | 'showFrequency') => void;
  readonly onOpenDictionary?: () => void;
}


export function SettingsDialog({ isOpen, settings, onChange, onClose, tokenizeState, onToggleTokenize, onOpenDictionary }: SettingsDialogProps): React.JSX.Element {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => { if (!open) onClose(); }}
      title="Settings"
      showCloseButton
    >
      <SettingsDialogContent
        settings={settings}
        onChange={onChange}
        tokenizeState={tokenizeState}
        onToggleTokenize={onToggleTokenize}
        onOpenDictionary={onOpenDictionary}
      />
    </Dialog>
  );
}
