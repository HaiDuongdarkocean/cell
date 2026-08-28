import { forwardRef, type ReactNode } from 'react';
import { Button, type ButtonProps } from './Button';

type IconButtonSize = 'xs' | 'sm' | 'md' | 'lg';
type IconButtonVariant = 'solid' | 'outline' | 'ghost' | 'transparent' | 'danger' | 'glass';

interface IconButtonProps extends Omit<ButtonProps, 'variant' | 'size' | 'shape' | 'leadingIcon' | 'trailingIcon' | 'orientation' | 'collapseLabel'> {
  /** Size: xs=28, sm=32, md=40, lg=48. Default 'md'. */
  size?: IconButtonSize;
  /** Visual style. Default 'ghost'. */
  variant?: IconButtonVariant;
  children?: ReactNode;
}

const variantMap: Record<IconButtonVariant, ButtonProps['variant']> = {
  solid: 'primary',
  outline: 'outline',
  ghost: 'ghost',
  transparent: 'transparent',
  danger: 'destructive',
  glass: 'glass',
};

/**
 * IconButton — deprecated thin wrapper around Button.
 *
 * This component is kept for backward compatibility. New code should use
 * `<Button shape="circle">` directly with an icon child.
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton({
  size = 'md',
  variant = 'ghost',
  children,
  ...rest
}: IconButtonProps, ref): React.JSX.Element {
  return (
    <Button ref={ref} variant={variantMap[variant]} size={size} shape="circle" {...rest}>
      {children}
    </Button>
  );
});

export type { IconButtonProps, IconButtonSize, IconButtonVariant };
