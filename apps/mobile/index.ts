import App from '@/../App';
import { registerRootComponent } from 'expo';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

registerRootComponent(() =>
  React.createElement(SafeAreaProvider, null, React.createElement(App))
);
