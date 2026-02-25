import React from 'react';
import { render } from '@testing-library/react-native';

import { Text } from '@/components/ui/text';

describe('ui/text', () => {
  it('maps legacy truncate prop to one-line behavior', () => {
    const { getByTestId } = render(
      <Text testID="text" truncate>
        Hello
      </Text>
    );

    expect(getByTestId('text').props.numberOfLines).toBe(1);
  });

  it('applies size class variants', () => {
    const { getByTestId } = render(
      <Text testID="text" size="2xl">
        Heading
      </Text>
    );

    const className = getByTestId('text').props.className as string;
    expect(className).toContain('text-2xl');
  });

  it('composes underline and strikeThrough styles', () => {
    const { getByTestId } = render(
      <Text testID="text" underline strikeThrough>
        Muted
      </Text>
    );

    const style = getByTestId('text').props.style as Array<{ textDecorationLine?: string }>;
    expect(style[0]?.textDecorationLine).toBe('underline line-through');
  });
});
