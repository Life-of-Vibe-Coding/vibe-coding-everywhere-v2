import type { ImageStyle, StyleProp, TextStyle, ViewStyle } from "react-native";

type LegacyStyle = StyleProp<ViewStyle | TextStyle | ImageStyle>;

const warnedKeys = new Set<string>();

function warnOnce(key: string, message: string) {
  if (!__DEV__) return;
  if (warnedKeys.has(key)) return;
  warnedKeys.add(key);
  console.warn(message);
}

export function warnLegacyProp(
  componentName: string,
  propName: string,
  replacement?: string
) {
  const key = `${componentName}.${propName}`;
  const replacementText = replacement ? ` Use \`${replacement}\` instead.` : "";
  warnOnce(
    key,
    `[ui-migration] \`${componentName}\` prop \`${propName}\` is deprecated.${replacementText}`
  );
}

export function resolveLegacyStyle(
  componentName: string,
  style: LegacyStyle,
  legacyStyle?: LegacyStyle
): LegacyStyle {
  if (!legacyStyle) {
    return style;
  }

  warnLegacyProp(componentName, "legacyStyle", "className or style");

  if (!style) {
    return legacyStyle;
  }

  return [style, legacyStyle];
}

export function normalizeLegacyBoolean(
  componentName: string,
  legacyPropName: string,
  legacyValue: boolean | undefined,
  nextValue: boolean | undefined
): boolean | undefined {
  if (nextValue !== undefined) {
    return nextValue;
  }

  if (legacyValue !== undefined) {
    warnLegacyProp(componentName, legacyPropName);
    return legacyValue;
  }

  return undefined;
}
