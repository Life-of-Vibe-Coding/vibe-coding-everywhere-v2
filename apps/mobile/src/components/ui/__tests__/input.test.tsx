import { render } from '@testing-library/react-native';
import React from 'react';

import { Input, InputField } from '@/components/ui/input';

describe('ui/input', () => {
  it('maps isDisabled prop to InputField editable=false', () => {
    const { getByTestId } = render(
      <Input isDisabled>
        <InputField testID="field" />
      </Input>
    );

    expect(getByTestId('field').props.editable).toBe(false);
  });

  it('maps isInvalid prop to invalid border class', () => {
    const { getByTestId } = render(
      <Input testID="input" isInvalid>
        <InputField />
      </Input>
    );

    const className = getByTestId('input').props.className as string;
    expect(className).toContain('border-error-700');
  });

  it('applies variant and size classes', () => {
    const { getByTestId } = render(
      <Input testID="input" variant="rounded" size="lg">
        <InputField />
      </Input>
    );

    const className = getByTestId('input').props.className as string;
    expect(className).toContain('rounded-full');
    expect(className).toContain('h-11');
  });
});
