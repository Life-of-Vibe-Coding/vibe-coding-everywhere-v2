import React from 'react';
import { Text as RNText, type StyleProp, type TextProps, type TextStyle } from 'react-native';

import { cn } from '@/utils/cn';


type TextSize =
  | '2xs'
  | 'xs'
  | 'sm'
  | 'md'
  | 'lg'
  | 'xl'
  | '2xl'
  | '3xl'
  | '4xl'
  | '5xl'
  | '6xl';

const sizeClasses: Record<TextSize, string> = {
  '2xs': 'text-[10px]',
  'xs': 'text-xs',
  'sm': 'text-sm',
  'md': 'text-base',
  'lg': 'text-lg',
  'xl': 'text-xl',
  '2xl': 'text-2xl',
  '3xl': 'text-3xl',
  '4xl': 'text-4xl',
  '5xl': 'text-5xl',
  '6xl': 'text-6xl',
};

export type TextPropsCompat = TextProps & {
  className?: string;
  size?: TextSize;
  isTruncated?: boolean;
  bold?: boolean;
  underline?: boolean;
  strikeThrough?: boolean;
  sub?: boolean;
  italic?: boolean;
  highlight?: boolean;
};

const Text = React.forwardRef<React.ComponentRef<typeof RNText>, TextPropsCompat>(function Text(
  {
    className,
    isTruncated,
    bold,
    underline,
    strikeThrough,
    size = 'md',
    sub,
    italic,
    highlight,
    style,
    ...props
  },
  ref
) {
  const textDecorationLine = underline
    ? strikeThrough
      ? 'underline line-through'
      : 'underline'
    : strikeThrough
      ? 'line-through'
      : undefined;

  return (
    <RNText
      ref={ref}
      {...props}
      numberOfLines={isTruncated ? 1 : props.numberOfLines}
      className={cn(
        'text-typography-900',
        sizeClasses[size],
        bold && 'font-bold',
        italic && 'italic',
        highlight && 'bg-yellow-500',
        sub && 'align-sub',
        className
      )}
      style={[
        textDecorationLine ? { textDecorationLine } : undefined,
        style,
      ] as StyleProp<TextStyle>}
    />
  );
});

Text.displayName = 'Text';

export { Text };
