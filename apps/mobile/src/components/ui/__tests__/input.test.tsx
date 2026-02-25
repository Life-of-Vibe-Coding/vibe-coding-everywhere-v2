import React from 'react';
import { render } from '@testing-library/react-native';

import { Input, InputField } from '@/components/ui/input';

describe('ui/input', () => {
  it('maps legacy disabled prop to InputField editable=false', () => {
    const { getByTestId } = render(
      <Input disabled>
        <InputField testID="field" />
      </Input>
    );

    expect(getByTestId('field').props.editable).toBe(false);
  });

  it('maps legacy invalid prop to invalid border class', () => {
    const { getByTestId } = render(
      <Input testID="input" invalid>
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
