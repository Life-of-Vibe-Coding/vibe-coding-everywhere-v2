import React from 'react';
import { render } from '@testing-library/react-native';

import { Card } from '@/components/ui/card';

describe('ui/card', () => {
  it('applies variant and size classes', () => {
    const { getByTestId } = render(
      <Card testID="card" variant="outline" size="lg" />
    );

    const className = getByTestId('card').props.className as string;
    expect(className).toContain('border-outline-200');
    expect(className).toContain('p-5');
  });

  it('supports ghost variant for parity with web wrapper', () => {
    const { getByTestId } = render(<Card testID="card" variant="ghost" />);
    const className = getByTestId('card').props.className as string;
    expect(className).toContain('border-0');
    expect(className).toContain('rounded-none');
  });
});
