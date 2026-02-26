import React from 'react';
import { render } from '@testing-library/react-native';

import { Pressable } from '@/components/ui/pressable';

describe('ui/pressable', () => {
  it('maps isDisabled prop to accessibilityState.disabled', () => {
    const { getByTestId } = render(
      <Pressable testID="pressable" isDisabled />
    );

    expect(getByTestId('pressable').props.accessibilityState?.disabled).toBe(true);
  });
});
