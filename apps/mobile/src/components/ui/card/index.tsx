import React from 'react';
import { View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { cn } from '@/utils/cn';
import { resolveLegacyStyle } from '@/components/ui/_migration/legacyAdapter';

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
  legacyStyle?: StyleProp<ViewStyle>;
};

const Card = React.forwardRef<React.ComponentRef<typeof View>, ICardProps>(function Card(
  { className, size = 'md', variant = 'elevated', legacyStyle, style, ...props },
  ref
) {
  return (
    <View
      ref={ref}
      {...props}
      style={resolveLegacyStyle('Card', style as StyleProp<ViewStyle>, legacyStyle)}
      className={cn(sizeClass[size], variantClass[variant], className)}
    />
  );
});

Card.displayName = 'Card';

export { Card };
