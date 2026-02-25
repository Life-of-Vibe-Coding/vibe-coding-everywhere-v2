import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('@legendapp/motion', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    Motion: { View },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    createMotionAnimatedComponent: (Component: React.ComponentType<any>) => Component,
  };
});

jest.mock('@gluestack-ui/core/modal/creator', () => {
  const React = require('react');
  const { View, Pressable, ScrollView } = require('react-native');

  const createPart = (Tag: React.ComponentType<any>) =>
    React.forwardRef((props: any, ref) => <Tag ref={ref} {...props} />);

  const ModalRoot = React.forwardRef((props: any, ref) => (
    <View ref={ref} {...props} />
  ));
  ModalRoot.Backdrop = createPart(Pressable);
  ModalRoot.Content = createPart(View);
  ModalRoot.Body = createPart(ScrollView);
  ModalRoot.CloseButton = createPart(Pressable);
  ModalRoot.Footer = createPart(View);
  ModalRoot.Header = createPart(View);

  return {
    createModal: () => ModalRoot,
  };
});

jest.mock('uniwind', () => ({
  withUniwind: (Component: React.ComponentType<any>) => Component,
}));

import { Modal } from '@/components/ui/modal';

describe('ui/modal', () => {
  it('maps legacy visible prop to isOpen', () => {
    const { getByTestId } = render(
      <Modal testID="modal" visible />
    );

    expect(getByTestId('modal').props.isOpen).toBe(true);
  });

  it('maps legacy onRequestClose prop to onClose', () => {
    const onRequestClose = jest.fn();
    const { getByTestId } = render(
      <Modal testID="modal" visible onRequestClose={onRequestClose} />
    );

    expect(getByTestId('modal').props.onClose).toBe(onRequestClose);
  });
});
