import React from 'react';
import { render } from '@testing-library/react-native';

import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';

describe('ui/stacks', () => {
  it('maps HStack space/reversed props', () => {
    const { getByTestId } = render(
      <HStack testID="hstack" space="lg" reversed />
    );

    const className = getByTestId('hstack').props.className as string;
    expect(className).toContain('gap-4');
    expect(className).toContain('flex-row-reverse');
  });

  it('maps VStack space/reversed props', () => {
    const { getByTestId } = render(
      <VStack testID="vstack" space="sm" reversed />
    );

    const className = getByTestId('vstack').props.className as string;
    expect(className).toContain('gap-2');
    expect(className).toContain('flex-col-reverse');
  });
});
