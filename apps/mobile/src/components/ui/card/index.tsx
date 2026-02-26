import React from 'react';
import { View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { cn } from '@/utils/cn';


type CardVariant = 'elevated' | 'outline' | 'filled' | 'ghost';
type CardSize = 'sm' | 'md' | 'lg';

const sizeClass: Record<CardSize, string> = {
  sm: 'p-3 rounded-lg',
  md: 'p-4 rounded-xl',
  lg: 'p-5 rounded-2xl',
};

const variantClass: Record<CardVariant, string> = {
  elevated: 'bg-background-0 border border-outline-100',
  outline: 'bg-transparent border border-outline-200',
  filled: 'bg-background-50 border border-outline-100',
  ghost: 'bg-transparent border-0 rounded-none',
};

type ICardProps = ViewProps & {
  className?: string;
  size?: CardSize;
  variant?: CardVariant;
};

const Card = React.forwardRef<React.ComponentRef<typeof View>, ICardProps>(function Card(
  { className, size = 'md', variant = 'elevated', style, ...props },
  ref
) {
  return (
    <View
      ref={ref}
      {...props}
      style={style as StyleProp<ViewStyle>}
      className={cn(sizeClass[size], variantClass[variant], className)}
    />
  );
});

Card.displayName = 'Card';

export { Card };
