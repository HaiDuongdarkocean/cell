import type { Settings } from '@/entities/media';
import { Dialog } from '@/shared/ui/Dialog';
import { SettingsDialogContent } from './SettingsDialogContent';

interface SettingsDialogProps {
  isOpen: boolean;
  settings: Settings;
  onChange: (settings: Settings) => void;
  onClose: () => void;
}


export function SettingsDialog({ isOpen, settings, onChange, onClose }: SettingsDialogProps): React.JSX.Element {
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
      />
    </Dialog>
  );
}
