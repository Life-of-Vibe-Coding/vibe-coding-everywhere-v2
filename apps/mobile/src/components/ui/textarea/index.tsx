import React, { createContext, useContext, useMemo, useState } from 'react';
import { TextInput, View, type TextInputProps, type ViewProps } from 'react-native';

import { cn } from '@/utils/cn';

type TextareaVariant = 'default';
type TextareaSize = 'sm' | 'md' | 'lg' | 'xl';

type TextareaContextValue = {
  size: TextareaSize;
  focused: boolean;
  setFocused: (focused: boolean) => void;
  isDisabled: boolean;
};

const TextareaContext = createContext<TextareaContextValue>({
  size: 'md',
  focused: false,
  setFocused: () => undefined,
  isDisabled: false,
});

const sizeClass: Record<TextareaSize, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
};

export type TextareaProps = ViewProps & {
  className?: string;
  variant?: TextareaVariant;
  size?: TextareaSize;
  isInvalid?: boolean;
  isDisabled?: boolean;
};

const Textarea = React.forwardRef<React.ComponentRef<typeof View>, TextareaProps>(function Textarea(
  { className, variant = 'default', size = 'md', isInvalid = false, isDisabled = false, ...props },
  ref
) {
  const [focused, setFocused] = useState(false);
  const value = useMemo(
    () => ({ size, focused, setFocused, isDisabled }),
    [size, focused, isDisabled]
  );

  return (
    <TextareaContext.Provider value={value}>
      <View
        ref={ref}
        {...props}
        className={cn(
          'w-full min-h-[100px] border border-background-300 rounded overflow-hidden',
          variant === 'default' && '',
          focused && !isInvalid && 'border-primary-700',
          isInvalid && 'border-error-700',
          isDisabled && 'opacity-40 bg-background-50',
          className
        )}
      />
    </TextareaContext.Provider>
  );
});

export type TextareaInputProps = TextInputProps & {
  className?: string;
  showsVerticalScrollIndicator?: boolean;
};

const TextareaInput = React.forwardRef<React.ComponentRef<typeof TextInput>, TextareaInputProps>(function TextareaInput(
  { className, editable, onFocus, onBlur, showsVerticalScrollIndicator, ...props },
  ref
) {
  const { size, setFocused, isDisabled } = useContext(TextareaContext);

  return (
    <TextInput
      ref={ref}
      {...props}
      editable={editable ?? !isDisabled}
      textAlignVertical="top"
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      className={cn('flex-1 p-2 text-typography-900', sizeClass[size], className)}
    />
  );
});

Textarea.displayName = 'Textarea';
TextareaInput.displayName = 'TextareaInput';

export { Textarea, TextareaInput };
