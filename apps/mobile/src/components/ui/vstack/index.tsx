import React from 'react';
import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils';
import { View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { vstackStyle } from '@/components/ui/vstack/styles';
import { resolveLegacyStyle, warnLegacyProp } from '@/components/ui/_migration/legacyAdapter';

type StackSpace = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';

type IVStackProps = React.ComponentProps<typeof View> &
  VariantProps<typeof vstackStyle> & {
    spacing?: StackSpace;
    reverse?: boolean;
    legacyStyle?: StyleProp<ViewStyle>;
  };

const VStack = React.forwardRef<React.ComponentRef<typeof View>, IVStackProps>(
  function VStack(
    { className, space, spacing, reversed, reverse, legacyStyle, style, ...props },
    ref
  ) {
    const finalSpace = space ?? spacing;
    const finalReversed = reversed ?? reverse;

    if (spacing !== undefined) {
      warnLegacyProp('VStack', 'spacing', 'space');
    }
    if (reverse !== undefined) {
      warnLegacyProp('VStack', 'reverse', 'reversed');
    }

    return (
      <View
        className={vstackStyle({
          space: finalSpace,
          reversed: finalReversed as boolean,
          class: className,
        })}
        style={resolveLegacyStyle('VStack', style as StyleProp<ViewStyle>, legacyStyle)}
        {...props}
        ref={ref}
      />
    );
  }
);

VStack.displayName = 'VStack';

export { VStack };
