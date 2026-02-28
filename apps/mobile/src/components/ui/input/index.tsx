import React, { createContext, useContext, useMemo, useState } from 'react';
import {
    Pressable,
    TextInput,
    View,
    type StyleProp,
    type TextInputProps,
    type ViewProps,
    type ViewStyle
} from 'react-native';

import { cn } from '@/utils/cn';
type InputVariant = 'underlined' | 'outline' | 'rounded';
type InputSize = 'sm' | 'md' | 'lg' | 'xl';
type IconSize = '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';

type InputContextValue = {
  size: InputSize;
  variant: InputVariant;
  focused: boolean;
  setFocused: (focused: boolean) => void;
  isDisabled: boolean;
};

const InputContext = createContext<InputContextValue>({
  size: 'md',
  variant: 'outline',
  focused: false,
  setFocused: () => undefined,
  isDisabled: false,
});

const rootBase = 'flex-row items-center overflow-hidden border-background-300';

const rootVariantClass: Record<InputVariant, string> = {
  underlined: 'border-b rounded-none',
  outline: 'border rounded',
  rounded: 'border rounded-full',
};

const rootSizeClass: Record<InputSize, string> = {
  sm: 'h-9',
  md: 'h-10',
  lg: 'h-11',
  xl: 'h-12',
};

const fieldSizeClass: Record<InputSize, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
};

const iconSizePx: Record<IconSize, number> = {
  '2xs': 12,
  xs: 14,
  sm: 16,
  md: 18,
  lg: 20,
  xl: 24,
};

export type InputProps = ViewProps & {
  className?: string;
  variant?: InputVariant;
  size?: InputSize;
  isInvalid?: boolean;
  isDisabled?: boolean;
};

const Input = React.forwardRef<React.ComponentRef<typeof View>, InputProps>(function Input(
  {
    className,
    variant = 'outline',
    size = 'md',
    isInvalid,
    isDisabled,
    style,
    ...props
  },
  ref
) {
  const finalDisabled = Boolean(isDisabled);
  const finalInvalid = Boolean(isInvalid);

  const [focused, setFocused] = useState(false);
  const value = useMemo(
    () => ({ size, variant, focused, setFocused, isDisabled: finalDisabled }),
    [size, variant, focused, finalDisabled]
  );

  return (
    <InputContext.Provider value={value}>
      <View
        ref={ref}
        {...props}
        style={style as StyleProp<ViewStyle>}
        className={cn(
          rootBase,
          rootVariantClass[variant],
          rootSizeClass[size],
          focused && !finalInvalid && 'border-primary-700',
          finalInvalid && 'border-error-700',
          finalDisabled && 'opacity-40',
          className
        )}
      />
    </InputContext.Provider>
  );
});

export type InputIconProps = {
  as?: React.ElementType;
  className?: string;
  size?: IconSize | number;
  color?: string;
  height?: number;
  width?: number;
};

const InputIcon = React.forwardRef<React.ComponentRef<typeof View>, InputIconProps>(function InputIcon(
  { as: Icon, className, size = 'md', color, height, width, ...props },
  ref
) {
  if (!Icon) return null;

  const iconSize = typeof size === 'number' ? size : iconSizePx[size];
  return (
    <View ref={ref} className="items-center justify-center">
      <Icon
        {...props}
        className={cn('text-typography-400', className)}
        color={color}
        size={iconSize}
        height={height}
        width={width}
      />
    </View>
  );
});

export type InputSlotProps = React.ComponentProps<typeof Pressable> & {
  className?: string;
};

const InputSlot = React.forwardRef<React.ComponentRef<typeof Pressable>, InputSlotProps>(function InputSlot(
  { className, ...props },
  ref
) {
  return <Pressable ref={ref} {...props} className={cn('items-center justify-center', className)} />;
});

export type InputFieldProps = TextInputProps & {
  className?: string;
};

const InputField = React.forwardRef<React.ComponentRef<typeof TextInput>, InputFieldProps>(function InputField(
  { className, editable, onFocus, onBlur, ...props },
  ref
) {
  const { size, variant, setFocused, isDisabled } = useContext(InputContext);

  return (
    <TextInput
      ref={ref}
      {...props}
      editable={editable ?? !isDisabled}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      className={cn(
        'flex-1 h-full text-typography-900 px-3 py-0',
        variant === 'underlined' && 'px-0',
        variant === 'rounded' && 'px-4',
        fieldSizeClass[size],
        className
      )}
    />
  );
});

Input.displayName = 'Input';
InputIcon.displayName = 'InputIcon';
InputSlot.displayName = 'InputSlot';
InputField.displayName = 'InputField';

export { Input, InputField, InputIcon, InputSlot };
