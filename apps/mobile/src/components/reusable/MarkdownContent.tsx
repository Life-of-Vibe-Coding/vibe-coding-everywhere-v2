import React, { useMemo } from "react";
import { Linking, Platform } from "react-native";
import Markdown, { MarkdownProps } from "react-native-markdown-display";
import { useTheme } from "@/theme/index";

type MarkdownContentProps = {
  content: string;
  markdownProps?: Partial<MarkdownProps>;
  onLinkPress?: (url: string) => void;
};

export function MarkdownContent({
  content,
  markdownProps,
  onLinkPress,
}: MarkdownContentProps) {
  const theme = useTheme();

  const markdownStyle = useMemo(
    () => ({
      body: {
        color: theme.colors.textPrimary,
        lineHeight: 22,
        fontSize: 14,
      },
      code_inline: {
        backgroundColor: theme.colors.surfaceMuted,
        color: theme.colors.textPrimary,
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 2,
      },
      code_block: {
        backgroundColor: theme.colors.surfaceAlt,
        color: theme.colors.textPrimary,
        borderRadius: 8,
        padding: 12,
        fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      },
      fence: {
        backgroundColor: theme.colors.surfaceAlt,
        color: theme.colors.textPrimary,
        borderRadius: 8,
        padding: 12,
        fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      },
      link: {
        color: theme.colors.accent,
      },
    }),
    [theme.colors]
  );

  return (
    <Markdown
      style={markdownStyle}
      onLinkPress={(url: string) => {
        if (onLinkPress) {
          onLinkPress(url);
          return false;
        }
        Linking.openURL(url).catch(() => undefined);
        return false;
      }}
      {...markdownProps}
    >
      {content}
    </Markdown>
  );
}
