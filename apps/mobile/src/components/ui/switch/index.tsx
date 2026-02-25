import React from 'react';
import { Switch as RNSwitch, type SwitchProps as RNSwitchProps } from 'react-native';

type SwitchSize = 'sm' | 'md' | 'lg';

type ISwitchProps = RNSwitchProps & {
  className?: string;
  size?: SwitchSize;
};

const scaleForSize: Record<SwitchSize, number> = {
  sm: 0.75,
  md: 1,
  lg: 1.25,
};

const Switch = React.forwardRef<React.ComponentRef<typeof RNSwitch>, ISwitchProps>(function Switch(
  { size = 'md', style, ...props },
  ref
) {
  return <RNSwitch ref={ref} {...props} style={[{ transform: [{ scale: scaleForSize[size] }] }, style]} />;
});

Switch.displayName = 'Switch';

export { Switch };
