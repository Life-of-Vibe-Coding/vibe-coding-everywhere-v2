import React from 'react';
import { View, ViewProps, type StyleProp, type ViewStyle } from 'react-native';

import { boxStyle } from '@/components/ui/box/styles';
import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils';


type IBoxProps = ViewProps &
  VariantProps<typeof boxStyle> & {
    className?: string;
  };

const Box = React.forwardRef<React.ComponentRef<typeof View>, IBoxProps>(
  function Box({ className, style, ...props }, ref) {
    return (
      <View
        ref={ref}
        {...props}
        style={style as StyleProp<ViewStyle>}
        className={boxStyle({ class: className })}
      />
    );
  }
);

Box.displayName = 'Box';
export { Box };
