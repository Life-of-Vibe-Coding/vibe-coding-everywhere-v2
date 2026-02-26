import React, { createContext, useContext } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextProps,
  type ViewStyle,
  type ViewProps,
} from 'react-native';

import { cn } from '@/utils/cn';


type ButtonAction = 'primary' | 'secondary' | 'positive' | 'negative' | 'default';
type ButtonVariant = 'solid' | 'outline' | 'link';
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
type GroupSpace = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
type GroupDirection = 'row' | 'column' | 'row-reverse' | 'column-reverse';

type ButtonContextValue = {
  action: ButtonAction;
  variant: ButtonVariant;
  size: ButtonSize;
  isDisabled: boolean;
};

const ButtonContext = createContext<ButtonContextValue>({
  action: 'primary',
  variant: 'solid',
  size: 'md',
  isDisabled: false,
});

const buttonSizeClass: Record<ButtonSize, string> = {
  xs: 'h-8 px-3.5',
  sm: 'h-9 px-4',
  md: 'h-10 px-5',
  lg: 'h-11 px-6',
  xl: 'h-12 px-7',
};

const buttonStyleClass: Record<ButtonAction, Record<ButtonVariant, string>> = {
  primary: {
    solid: 'bg-primary-500',
    outline: 'border border-primary-500 bg-transparent',
    link: 'bg-transparent px-0',
  },
  secondary: {
    solid: 'bg-secondary-500',
    outline: 'border border-secondary-300 bg-transparent',
    link: 'bg-transparent px-0',
  },
  positive: {
    solid: 'bg-success-500',
    outline: 'border border-success-500 bg-transparent',
    link: 'bg-transparent px-0',
  },
  negative: {
    solid: 'bg-error-500',
    outline: 'border border-error-500 bg-transparent',
    link: 'bg-transparent px-0',
  },
  default: {
    solid: 'bg-transparent',
    outline: 'border border-outline-300 bg-transparent',
    link: 'bg-transparent px-0',
  },
};

const buttonTextClass: Record<ButtonAction, Record<ButtonVariant, string>> = {
  primary: {
    solid: 'text-typography-0',
    outline: 'text-primary-500',
    link: 'text-primary-500',
  },
  secondary: {
    solid: 'text-typography-800',
    outline: 'text-typography-700',
    link: 'text-typography-700',
  },
  positive: {
    solid: 'text-typography-0',
    outline: 'text-success-600',
    link: 'text-success-600',
  },
  negative: {
    solid: 'text-typography-0',
    outline: 'text-error-600',
    link: 'text-error-600',
  },
  default: {
    solid: 'text-typography-900',
    outline: 'text-typography-700',
    link: 'text-typography-700',
  },
};

const buttonTextSizeClass: Record<ButtonSize, string> = {
  xs: 'text-xs',
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
};

const buttonIconSize: Record<ButtonSize, number> = {
  xs: 14,
  sm: 16,
  md: 18,
  lg: 18,
  xl: 20,
};

const groupSpacingClass: Record<GroupSpace, string> = {
  xs: 'gap-1',
  sm: 'gap-2',
  md: 'gap-3',
  lg: 'gap-4',
  xl: 'gap-5',
  '2xl': 'gap-6',
  '3xl': 'gap-7',
  '4xl': 'gap-8',
};

const groupDirectionClass: Record<GroupDirection, string> = {
  row: 'flex-row',
  column: 'flex-col',
  'row-reverse': 'flex-row-reverse',
  'column-reverse': 'flex-col-reverse',
};

export type ButtonProps = PressableProps & {
  className?: string;
  action?: ButtonAction;
  variant?: ButtonVariant;
  size?: ButtonSize;
  isDisabled?: boolean;
  loading?: boolean;
};

const Button = React.forwardRef<React.ComponentRef<typeof Pressable>, ButtonProps>(function Button(
  {
    className,
    action = 'primary',
    variant = 'solid',
    size = 'md',
    isDisabled,
    loading,
    style,
    ...props
  },
  ref
) {
  const finalDisabled = Boolean(isDisabled || props.disabled || loading);

  return (
    <ButtonContext.Provider value={{ action, variant, size, isDisabled: finalDisabled }}>
      <Pressable
        ref={ref}
        {...props}
        disabled={finalDisabled}
        style={style as StyleProp<ViewStyle>}
        className={cn(
          'group/button flex-row items-center justify-center rounded gap-2',
          buttonSizeClass[size],
          buttonStyleClass[action][variant],
          finalDisabled && 'opacity-40',
          className
        )}
      />
    </ButtonContext.Provider>
  );
});

export type ButtonTextProps = TextProps & {
  className?: string;
  action?: ButtonAction;
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const ButtonText = React.forwardRef<React.ComponentRef<typeof Text>, ButtonTextProps>(function ButtonText(
  { className, action, variant, size, ...props },
  ref
) {
  const ctx = useContext(ButtonContext);
  const finalAction = action ?? ctx.action;
  const finalVariant = variant ?? ctx.variant;
  const finalSize = size ?? ctx.size;

  return (
    <Text
      ref={ref}
      {...props}
      className={cn(
        'font-semibold web:select-none',
        buttonTextClass[finalAction][finalVariant],
        buttonTextSizeClass[finalSize],
        className
      )}
    />
  );
});

export type ButtonSpinnerProps = React.ComponentProps<typeof ActivityIndicator>;
const ButtonSpinner = ActivityIndicator;

export type ButtonIconProps = {
  as?: React.ElementType;
  className?: string;
  action?: ButtonAction;
  variant?: ButtonVariant;
  size?: ButtonSize | number;
  color?: string;
  style?: any;
  height?: number;
  width?: number;
};

const ButtonIcon = React.forwardRef<React.ComponentRef<typeof View>, ButtonIconProps>(function ButtonIcon(
  { as: Icon, className, action, variant, size, color, style, height, width, ...props },
  ref
) {
  const ctx = useContext(ButtonContext);
  const finalAction = action ?? ctx.action;
  const finalVariant = variant ?? ctx.variant;
  const inferredSize = typeof size === 'number' ? size : buttonIconSize[size ?? ctx.size];

  if (!Icon) return null;

  const iconColorClass = buttonTextClass[finalAction][finalVariant];

  return (
    <View ref={ref} style={style}>
      <Icon
        {...props}
        className={cn(iconColorClass, className)}
        color={color}
        size={inferredSize}
        height={height}
        width={width}
      />
    </View>
  );
});

export type ButtonGroupProps = ViewProps & {
  className?: string;
  space?: GroupSpace;
  isAttached?: boolean;
  flexDirection?: GroupDirection;
};

const ButtonGroup = React.forwardRef<React.ComponentRef<typeof View>, ButtonGroupProps>(function ButtonGroup(
  { className, space = 'md', isAttached = false, flexDirection = 'column', ...props },
  ref
) {
  return (
    <View
      ref={ref}
      {...props}
      className={cn(
        groupDirectionClass[flexDirection],
        isAttached ? 'gap-0' : groupSpacingClass[space],
        className
      )}
    />
  );
});

Button.displayName = 'Button';
ButtonText.displayName = 'ButtonText';
ButtonIcon.displayName = 'ButtonIcon';
ButtonGroup.displayName = 'ButtonGroup';

export { Button, ButtonText, ButtonSpinner, ButtonIcon, ButtonGroup };
