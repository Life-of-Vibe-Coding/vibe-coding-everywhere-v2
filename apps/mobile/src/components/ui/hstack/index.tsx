import React from 'react';
import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils';
import { View } from 'react-native';
import type { StyleProp, ViewProps, ViewStyle } from 'react-native';
import { hstackStyle } from '@/components/ui/hstack/styles';
import { resolveLegacyStyle, warnLegacyProp } from '@/components/ui/_migration/legacyAdapter';

type StackSpace = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';

type IHStackProps = ViewProps &
  VariantProps<typeof hstackStyle> & {
    spacing?: StackSpace;
    reverse?: boolean;
    legacyStyle?: StyleProp<ViewStyle>;
  };

const HStack = React.forwardRef<React.ComponentRef<typeof View>, IHStackProps>(
  function HStack(
    { className, space, spacing, reversed, reverse, legacyStyle, style, ...props },
    ref
  ) {
    const finalSpace = space ?? spacing;
    const finalReversed = reversed ?? reverse;

    if (spacing !== undefined) {
      warnLegacyProp('HStack', 'spacing', 'space');
    }
    if (reverse !== undefined) {
      warnLegacyProp('HStack', 'reverse', 'reversed');
    }

    return (
      <View
        className={hstackStyle({
          space: finalSpace,
          reversed: finalReversed as boolean,
          class: className,
        })}
        style={resolveLegacyStyle('HStack', style as StyleProp<ViewStyle>, legacyStyle)}
        {...props}
        ref={ref}
      />
    );
  }
);

HStack.displayName = 'HStack';

export { HStack };
