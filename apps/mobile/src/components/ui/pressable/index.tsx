'use client';
import React from 'react';
import { createPressable } from '@gluestack-ui/core/pressable/creator';
import {
  Pressable as RNPressable,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { tva } from '@gluestack-ui/utils/nativewind-utils';
import { withStyleContext } from '@gluestack-ui/utils/nativewind-utils';
import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils';
import {
  normalizeLegacyBoolean,
  resolveLegacyStyle,
} from '@/components/ui/_migration/legacyAdapter';

const UIPressable = createPressable({
  Root: withStyleContext(RNPressable),
});

const pressableStyle = tva({
  base: 'data-[focus-visible=true]:outline-none data-[focus-visible=true]:ring-indicator-info data-[focus-visible=true]:ring-2 data-[disabled=true]:opacity-40',
});

type IPressableProps = Omit<
  React.ComponentProps<typeof UIPressable>,
  'context'
> &
  VariantProps<typeof pressableStyle> & {
    disabled?: boolean;
    isDisabled?: boolean;
    legacyStyle?: StyleProp<ViewStyle>;
  };
const Pressable = React.forwardRef<
  React.ComponentRef<typeof UIPressable>,
  IPressableProps
>(function Pressable(
  { className, disabled, isDisabled, legacyStyle, style, ...props },
  ref
) {
  const finalDisabled = Boolean(
    normalizeLegacyBoolean('Pressable', 'isDisabled', isDisabled, disabled)
  );
  const resolvedStyle =
    typeof style === 'function'
      ? style
      : resolveLegacyStyle(
          'Pressable',
          style as StyleProp<ViewStyle>,
          legacyStyle as StyleProp<ViewStyle>
        );

  return (
    <UIPressable
      {...props}
      ref={ref}
      disabled={finalDisabled}
      style={resolvedStyle}
      className={pressableStyle({
        class: className,
      })}
    />
  );
});

Pressable.displayName = 'Pressable';
export { Pressable };
