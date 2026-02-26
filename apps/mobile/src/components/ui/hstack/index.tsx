import React from 'react';
import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils';
import { View } from 'react-native';
import type { StyleProp, ViewProps, ViewStyle } from 'react-native';
import { hstackStyle } from '@/components/ui/hstack/styles';


type StackSpace = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';

type IHStackProps = ViewProps &
  VariantProps<typeof hstackStyle> & {
    className?: string; // hstackStyle variant props includes space and reversed
  };

const HStack = React.forwardRef<React.ComponentRef<typeof View>, IHStackProps>(
  function HStack(
    { className, space, reversed, style, ...props },
    ref
  ) {
    return (
      <View
        className={hstackStyle({
          space,
          reversed,
          class: className,
        })}
        style={style as StyleProp<ViewStyle>}
        {...props}
        ref={ref}
      />
    );
  }
);

HStack.displayName = 'HStack';

export { HStack };
