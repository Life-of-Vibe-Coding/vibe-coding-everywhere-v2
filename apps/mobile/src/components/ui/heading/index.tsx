import React from 'react';
import { Text, type TextProps } from 'react-native';

import { cn } from '@/utils/cn';

type HeadingSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';

const headingSizeClass: Record<HeadingSize, string> = {
  xs: 'text-xs',
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
  '2xl': 'text-2xl',
  '3xl': 'text-3xl',
  '4xl': 'text-4xl',
  '5xl': 'text-5xl',
};

type HeadingProps = TextProps & {
  className?: string;
  as?: React.ElementType;
  size?: HeadingSize;
  isTruncated?: boolean;
  bold?: boolean;
  underline?: boolean;
  strikeThrough?: boolean;
  sub?: boolean;
  italic?: boolean;
  highlight?: boolean;
};

const Heading = React.forwardRef<React.ComponentRef<typeof Text>, HeadingProps>(function Heading(
  {
    className,
    size = 'lg',
    isTruncated,
    bold = true,
    underline,
    strikeThrough,
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
    <Text
      ref={ref}
      {...props}
      numberOfLines={isTruncated ? 1 : props.numberOfLines}
      className={cn(
        'text-typography-900',
        headingSizeClass[size],
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

Heading.displayName = 'Heading';

export { Heading };
