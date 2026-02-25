import React from 'react';
import { render } from '@testing-library/react-native';

import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';

describe('ui/stacks', () => {
  it('maps HStack legacy spacing/reverse aliases', () => {
    const { getByTestId } = render(
      <HStack testID="hstack" spacing="lg" reverse />
    );

    const className = getByTestId('hstack').props.className as string;
    expect(className).toContain('gap-4');
    expect(className).toContain('flex-row-reverse');
  });

  it('maps VStack legacy spacing/reverse aliases', () => {
    const { getByTestId } = render(
      <VStack testID="vstack" spacing="sm" reverse />
    );

    const className = getByTestId('vstack').props.className as string;
    expect(className).toContain('gap-2');
    expect(className).toContain('flex-col-reverse');
  });
});
