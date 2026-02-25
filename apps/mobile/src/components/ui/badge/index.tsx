import React, { createContext, useContext } from 'react';
import { Text, View, type TextProps, type ViewProps } from 'react-native';

import { cn } from '@/utils/cn';

type BadgeAction = 'error' | 'warning' | 'success' | 'info' | 'muted';
type BadgeVariant = 'solid' | 'outline';
type BadgeSize = 'sm' | 'md' | 'lg';

type BadgeContextValue = {
  action: BadgeAction;
  size: BadgeSize;
};

const BadgeContext = createContext<BadgeContextValue>({ action: 'muted', size: 'md' });

const badgeClassByAction: Record<BadgeAction, Record<BadgeVariant, string>> = {
  error: {
    solid: 'bg-background-error',
    outline: 'bg-background-error border border-error-300',
  },
  warning: {
    solid: 'bg-background-warning',
    outline: 'bg-background-warning border border-warning-300',
  },
  success: {
    solid: 'bg-background-success',
    outline: 'bg-background-success border border-success-300',
  },
  info: {
    solid: 'bg-background-info',
    outline: 'bg-background-info border border-info-300',
  },
  muted: {
    solid: 'bg-background-muted',
    outline: 'bg-background-muted border border-background-300',
  },
};

const badgeTextClassByAction: Record<BadgeAction, string> = {
  error: 'text-error-600',
  warning: 'text-warning-600',
  success: 'text-success-600',
  info: 'text-info-600',
  muted: 'text-background-800',
};

const badgeTextSizeClass: Record<BadgeSize, string> = {
  sm: 'text-2xs',
  md: 'text-xs',
  lg: 'text-sm',
};

const badgeIconSize: Record<BadgeSize, number> = {
  sm: 12,
  md: 14,
  lg: 16,
};

export type BadgeProps = ViewProps & {
  className?: string;
  action?: BadgeAction;
  variant?: BadgeVariant;
  size?: BadgeSize;
};

function Badge({
  children,
  action = 'muted',
  variant = 'solid',
  size = 'md',
  className,
  ...props
}: BadgeProps) {
  return (
    <BadgeContext.Provider value={{ action, size }}>
      <View
        {...props}
        className={cn(
          'flex-row items-center rounded-sm px-2 py-1',
          badgeClassByAction[action][variant],
          className
        )}
      >
        {children}
      </View>
    </BadgeContext.Provider>
  );
}

export type BadgeTextProps = TextProps & {
  className?: string;
  size?: BadgeSize;
  isTruncated?: boolean;
  bold?: boolean;
  underline?: boolean;
  strikeThrough?: boolean;
  sub?: boolean;
  italic?: boolean;
  highlight?: boolean;
};

const BadgeText = React.forwardRef<React.ComponentRef<typeof Text>, BadgeTextProps>(function BadgeText(
  { className, size, isTruncated, bold, underline, strikeThrough, sub, italic, highlight, style, ...props },
  ref
) {
  const ctx = useContext(BadgeContext);
  const finalSize = size ?? ctx.size;
  const textDecorationLine = underline
    ? strikeThrough
      ? 'underline line-through'
      : 'underline'
    : strikeThrough
      ? 'line-through'
      : undefined;

  return (
    <Text
      ref={ref}
      {...props}
      numberOfLines={isTruncated ? 1 : props.numberOfLines}
      className={cn(
        'font-normal uppercase tracking-normal',
        badgeTextClassByAction[ctx.action],
        badgeTextSizeClass[finalSize],
        bold && 'font-bold',
        italic && 'italic',
        sub && 'align-sub',
        highlight && 'bg-yellow-500',
        className
      )}
      style={[textDecorationLine ? { textDecorationLine } : undefined, style]}
    />
  );
});

export type BadgeIconProps = {
  as?: React.ElementType;
  className?: string;
  size?: BadgeSize | number;
  color?: string;
  style?: ViewProps['style'];
  height?: number;
  width?: number;
};

const BadgeIcon = React.forwardRef<React.ComponentRef<typeof View>, BadgeIconProps>(function BadgeIcon(
  { as: Icon, className, size, color, style, height, width, ...props },
  ref
) {
  const ctx = useContext(BadgeContext);
  const iconSize = typeof size === 'number' ? size : badgeIconSize[size ?? ctx.size];

  if (!Icon) return null;

  return (
    <View ref={ref} style={style}>
      <Icon
        {...props}
        className={cn(badgeTextClassByAction[ctx.action], className)}
        size={iconSize}
        color={color}
        height={height}
        width={width}
      />
    </View>
  );
});

Badge.displayName = 'Badge';
BadgeText.displayName = 'BadgeText';
BadgeIcon.displayName = 'BadgeIcon';

export { Badge, BadgeIcon, BadgeText };
