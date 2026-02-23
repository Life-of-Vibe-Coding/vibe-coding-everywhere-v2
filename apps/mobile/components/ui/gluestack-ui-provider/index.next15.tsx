// Next.js 15 compatible GluestackUIProvider with Uniwind
'use client';

import React, { useEffect } from 'react';
import { OverlayProvider } from '@gluestack-ui/core/overlay/creator';
import { ToastProvider } from '@gluestack-ui/core/toast/creator';
import { Uniwind } from 'uniwind';

export type ModeType = 'light' | 'dark' | 'system';

export function GluestackUIProvider({
  mode = 'system',
  ...props
}: {
  mode?: ModeType;
  children?: React.ReactNode;
}) {
  useEffect(() => {
    Uniwind.setTheme(mode);
  }, [mode]);

  return (
    <OverlayProvider>
      <ToastProvider>{props.children}</ToastProvider>
    </OverlayProvider>
  );
}
