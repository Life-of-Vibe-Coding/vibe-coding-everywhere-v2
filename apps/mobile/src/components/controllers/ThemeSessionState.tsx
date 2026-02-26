import React, { useMemo, useState } from "react";

import { getTheme } from "@/theme/index";
import { type Provider as BrandProvider } from "@/constants/modelOptions";
import { createAppStyles } from "@/components/styles/appStyles";
import {
  getDefaultPermissionModeUI,
  getModel,
  getModelOptions,
  getThemeMode,
} from "@/features/app/appConfig";
import { MODEL_OPTIONS_BY_PROVIDER } from "@/constants/modelOptions";
import type { PermissionModeUI } from "@/utils/permission";

export type ThemeSessionStateProps = {
  children: (state: ThemeSessionStateState) => React.ReactNode;
};

export type ThemeSessionStateState = {
  model: string;
  setModel: (model: string) => void;
  themeMode: ReturnType<typeof getThemeMode>;
  theme: ReturnType<typeof getTheme>;
  styles: ReturnType<typeof createAppStyles>;
  modelOptions: ReturnType<typeof getModelOptions>;
  providerModelOptions: typeof MODEL_OPTIONS_BY_PROVIDER;
  permissionModeUI: PermissionModeUI;
  provider: BrandProvider;
  setProvider: (p: BrandProvider) => void;
};

export function ThemeSessionState({ children }: ThemeSessionStateProps) {
  const [provider, setProvider] = useState<BrandProvider>("codex");
  const [model, setModel] = useState<string>(getModel(provider));

  const themeMode = useMemo(() => getThemeMode(provider), [provider]);
  const theme = useMemo(() => getTheme(), []);
  const styles = useMemo(() => createAppStyles(theme), [theme]);
  const modelOptions = useMemo(() => getModelOptions(provider), [provider]);


  const permissionModeUI = useMemo(() => getDefaultPermissionModeUI(), []);

  return children({
    provider,
    setProvider,
    model,
    setModel,
    themeMode,
    theme,
    styles,
    modelOptions,
    providerModelOptions: MODEL_OPTIONS_BY_PROVIDER,
    permissionModeUI,
  });
}
