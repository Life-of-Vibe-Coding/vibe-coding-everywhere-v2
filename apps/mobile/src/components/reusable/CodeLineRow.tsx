import { Box } from "@/components/ui/box";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { Highlight, themes } from "prism-react-renderer";
import React, { memo } from "react";
import { Text as RNText, TextStyle, type ViewStyle } from "react-native";

interface PrismTokenStyle {
  [key: string]: unknown;
}

interface CodeLineRowProps {
  index: number;
  lineContent: string;
  selected: boolean;
  language: string;
  isDarkMode?: boolean;
  onPress: () => void;
  lineBaseStyle: TextStyle;
  lineNumStyle: TextStyle;
  lineNumSelectedStyle: TextStyle;
  lineRowStyle: ViewStyle;
  selectedLineStyle: ViewStyle;
  lineNumSelectedContainerStyle: ViewStyle;
  lineNumContainerStyle: ViewStyle;
  codeContainerStyle: ViewStyle;
  diffStyle?: ViewStyle;
}

function toRNStyle(style: PrismTokenStyle | undefined): TextStyle {
  if (!style || typeof style !== "object") return {};
  const out: TextStyle = {};
  if (typeof style.color === "string") out.color = style.color;
  if (typeof style.backgroundColor === "string") out.backgroundColor = style.backgroundColor;
  if (style.fontStyle === "italic" || style.fontStyle === "normal") out.fontStyle = style.fontStyle;
  if (typeof style.fontWeight === "string" || typeof style.fontWeight === "number")
    out.fontWeight = style.fontWeight as TextStyle["fontWeight"];
  if (typeof style.textDecorationLine === "string") out.textDecorationLine = style.textDecorationLine as TextStyle["textDecorationLine"];
  if (typeof style.opacity === "number") out.opacity = style.opacity;
  return out;
}

function CodeLineRow({
  index,
  lineContent,
  selected,
  language,
  isDarkMode = false,
  onPress,
  lineBaseStyle,
  lineNumStyle,
  lineNumSelectedStyle,
  lineRowStyle,
  selectedLineStyle,
  lineNumSelectedContainerStyle,
  lineNumContainerStyle,
  codeContainerStyle,
  diffStyle,
}: CodeLineRowProps) {
  const lineNum = index + 1;
  return (
    <Pressable
      onPress={onPress}
      style={[lineRowStyle, selected && selectedLineStyle, diffStyle]}
    >
      <Box style={[lineNumContainerStyle, selected && lineNumSelectedContainerStyle]}>
        <Text style={[lineNumStyle, selected && lineNumSelectedStyle]}>
          {lineNum}
        </Text>
      </Box>
      <Box style={codeContainerStyle}>
        <RNText style={lineBaseStyle} selectable>
          <Highlight theme={isDarkMode ? themes.vsDark : themes.vsLight} code={lineContent} language={language}>
            {({ tokens, getTokenProps }) => (
              <>
                {(tokens[0] ?? []).map((token, tokenIndex) => {
                  const tokenProps = getTokenProps({ token });
                  const tokenStyle = toRNStyle(tokenProps.style as PrismTokenStyle);
                  return (
                    <RNText key={tokenIndex} style={tokenStyle}>
                      {tokenProps.children}
                    </RNText>
                  );
                })}
              </>
            )}
          </Highlight>
        </RNText>
      </Box>
    </Pressable>
  );
}

export default memo(CodeLineRow);
