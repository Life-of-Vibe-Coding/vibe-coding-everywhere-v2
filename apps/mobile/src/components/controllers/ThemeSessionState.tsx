import React, { useMemo, useState } from "react";

import {
  getTheme,
  type Provider as BrandProvider,
} from "@/theme/index";
import { createAppStyles } from "@/components/styles/appStyles";
import {
  getDefaultPermissionModeUI,
  getModelForProvider,
  getModelOptionsForProvider,
  getThemeModeForProvider,
} from "@/features/app/appConfig";
import { MODEL_OPTIONS_BY_PROVIDER } from "@/constants/modelOptions";
import type { PermissionModeUI } from "@/utils/permission";

export type ThemeSessionStateProps = {
  children: (state: ThemeSessionStateState) => React.ReactNode;
};

export type ThemeSessionStateState = {
  provider: BrandProvider;
  model: string;
  setProvider: (provider: BrandProvider) => void;
  setModel: (model: string) => void;
  themeMode: ReturnType<typeof getThemeModeForProvider>;
  theme: ReturnType<typeof getTheme>;
  styles: ReturnType<typeof createAppStyles>;
  modelOptions: ReturnType<typeof getModelOptionsForProvider>;
  providerModelOptions: typeof MODEL_OPTIONS_BY_PROVIDER;
  permissionModeUI: PermissionModeUI;
};

export function ThemeSessionState({ children }: ThemeSessionStateProps) {
  const [provider, setProvider] = useState<BrandProvider>("codex");
  const [model, setModel] = useState<string>(getModelForProvider("codex"));

  const themeMode = useMemo(() => getThemeModeForProvider(provider), [provider]);
  const theme = useMemo(() => getTheme(provider, themeMode), [provider, themeMode]);
  const styles = useMemo(() => createAppStyles(theme), [theme]);
  const modelOptions = useMemo(() => getModelOptionsForProvider(provider), [provider]);
  const permissionModeUI = useMemo(() => getDefaultPermissionModeUI(), []);

  return children({
    provider,
    model,
    setProvider,
    setModel,
    themeMode,
    theme,
    styles,
    modelOptions,
    providerModelOptions: MODEL_OPTIONS_BY_PROVIDER,
    permissionModeUI,
  });
}
