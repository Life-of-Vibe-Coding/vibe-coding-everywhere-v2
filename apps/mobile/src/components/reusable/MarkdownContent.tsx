import React, { useMemo } from "react";
import { Linking, Platform } from "react-native";
import Markdown, { MarkdownProps } from "react-native-markdown-display";

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
  const markdownStyle = useMemo(
    () => ({
      body: {
        color: "#1f2937",
        lineHeight: 22,
        fontSize: 14,
      },
      code_inline: {
        backgroundColor: "#f3f4f6",
        color: "#111827",
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 2,
      },
      code_block: {
        backgroundColor: "#111827",
        color: "#f9fafb",
        borderRadius: 8,
        padding: 12,
        fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      },
      fence: {
        backgroundColor: "#111827",
        color: "#f9fafb",
        borderRadius: 8,
        padding: 12,
        fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      },
      link: {
        color: "#2563eb",
      },
    }),
    []
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
