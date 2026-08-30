import type { IconProps } from '@phosphor-icons/react';
import {
  ArrowCircleLeftIcon,
  ArrowCircleRightIcon,
  ArrowClockwiseIcon,
  ArrowCounterClockwiseIcon,
  PauseCircleIcon,
  PlayCircleIcon,
  ProhibitIcon,
  RepeatIcon,
  RepeatOnceIcon,
} from '@phosphor-icons/react';

/**
 * Filled Phosphor nav icons for the subtitle overlay cluster.
 *
 * These use Phosphor's `fill` weight so they stay visible on translucent
 * liquid-glass buttons. Source: @phosphor-icons/react (MIT).
 */
type NavIconProps = Omit<IconProps, 'ref' | 'weight'>;

export const NavPrev = (props: NavIconProps) => <ArrowCircleLeftIcon {...props} weight="fill" />;
export const NavNext = (props: NavIconProps) => <ArrowCircleRightIcon {...props} weight="fill" />;
export const NavRepeat = (props: NavIconProps) => <RepeatIcon {...props} weight="fill" />;
export const NavRepeatA = (props: NavIconProps) => <RepeatOnceIcon {...props} weight="fill" />;
export const NavRepeatB = (props: NavIconProps) => <RepeatIcon {...props} weight="fill" />;
export const NavRepeatCancel = (props: NavIconProps) => <ProhibitIcon {...props} weight="fill" />;
export const NavRewind = (props: NavIconProps) => <ArrowCounterClockwiseIcon {...props} weight="fill" />;
export const NavForward = (props: NavIconProps) => <ArrowClockwiseIcon {...props} weight="fill" />;
export const NavPlay = (props: NavIconProps) => <PlayCircleIcon {...props} weight="fill" />;
export const NavPause = (props: NavIconProps) => <PauseCircleIcon {...props} weight="fill" />;
