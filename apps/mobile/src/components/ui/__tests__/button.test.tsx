import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { Button, ButtonText } from '@/components/ui/button';

describe('ui/button', () => {
  it('maps isDisabled prop and prevents presses', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <Button testID="btn" isDisabled onPress={onPress}>
        <ButtonText>Save</ButtonText>
      </Button>
    );

    fireEvent.press(getByTestId('btn'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('handles loading prop by disabling the button', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <Button testID="btn" loading onPress={onPress}>
        <ButtonText>Submit</ButtonText>
      </Button>
    );

    fireEvent.press(getByTestId('btn'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('applies variant and size classes', () => {
    const { getByTestId } = render(
      <Button testID="btn" action="secondary" variant="outline" size="lg">
        <ButtonText>Open</ButtonText>
      </Button>
    );

    const className = getByTestId('btn').props.className as string;
    expect(className).toContain('border-secondary-300');
    expect(className).toContain('h-11');
  });
});
