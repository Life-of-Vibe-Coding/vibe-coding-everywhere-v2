import React from 'react';
import { render } from '@testing-library/react-native';

import { Pressable } from '@/components/ui/pressable';

describe('ui/pressable', () => {
  it('maps legacy disabled prop to isDisabled', () => {
    const { getByTestId } = render(
      <Pressable testID="pressable" disabled />
    );

    expect(getByTestId('pressable').props.isDisabled).toBe(true);
  });
});
