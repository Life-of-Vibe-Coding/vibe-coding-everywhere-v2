import React from 'react';
import { registerRootComponent } from 'expo';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import App from './App';

registerRootComponent(() =>
  React.createElement(SafeAreaProvider, null, React.createElement(App))
);
