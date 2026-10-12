import { useRef, useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { Menu, MenuItem } from '@/shared/ui/Menu';
import type { IconCatalogKey } from '@/shared/icons';


export interface ProfileMenuItem {
  readonly key: string;
  readonly label: string;
  readonly icon?: IconCatalogKey;
  readonly danger?: boolean;
  readonly disabled?: boolean;
  readonly onSelect: () => void;
}

export function ProfileMenu({ label, items }: { label: string; items: ProfileMenuItem[] }): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <div>
      <Button
        ref={triggerRef}
        shape="circle"
        type="button"
        size="sm"
        variant="ghost"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name="ellipsisVertical" size="xs" />
      </Button>
      <Menu
        open={open}
        onClose={() => setOpen(false)}
        triggerRef={triggerRef}
        ariaLabel={label}
        align="right"
      >
        {items.map((item) => (
          <MenuItem
            key={item.key}
            destructive={item.danger}
            disabled={item.disabled}
            icon={item.icon ? <Icon name={item.icon} size="xs" /> : undefined}
            onSelect={() => {
              setOpen(false);
              item.onSelect();
            }}
          >
            {item.label}
          </MenuItem>
        ))}
      </Menu>
    </div>
  );
}
