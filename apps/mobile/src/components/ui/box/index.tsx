import React from 'react';
import { View, ViewProps, type StyleProp, type ViewStyle } from 'react-native';

import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils';
import { boxStyle } from '@/components/ui/box/styles';
import { resolveLegacyStyle } from '@/components/ui/_migration/legacyAdapter';

type IBoxProps = ViewProps &
  VariantProps<typeof boxStyle> & {
    className?: string;
    legacyStyle?: StyleProp<ViewStyle>;
  };

const Box = React.forwardRef<React.ComponentRef<typeof View>, IBoxProps>(
  function Box({ className, legacyStyle, style, ...props }, ref) {
    return (
      <View
        ref={ref}
        {...props}
        style={resolveLegacyStyle('Box', style as StyleProp<ViewStyle>, legacyStyle)}
        className={boxStyle({ class: className })}
      />
    );
  }
);

Box.displayName = 'Box';
export { Box };
