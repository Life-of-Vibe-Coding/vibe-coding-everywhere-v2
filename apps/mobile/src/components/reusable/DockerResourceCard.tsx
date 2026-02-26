import React, { memo } from "react";
import { StyleSheet, type ViewStyle } from "react-native";
import { Box } from "@/components/ui/box";
import { ListSectionCard } from "@/components/reusable/ListSectionCard";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme/index";

export type DockerResourceRow = {
  label: string;
  value: React.ReactNode;
};

type DockerResourceCardProps = {
  title: string;
  action?: React.ReactNode;
  rows: DockerResourceRow[];
  actions?: React.ReactNode;
  className?: string;
  actionRowStyle?: ViewStyle;
};

const styles = StyleSheet.create({
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14,
    paddingTop: 14,
  },
});

function DockerResourceCardInner({
  title,
  action,
  rows,
  actions,
  className,
  actionRowStyle,
}: DockerResourceCardProps) {
  const theme = useTheme();
  const isDarkMode = theme.mode === "dark";
  const cardStyle: ViewStyle = {
    backgroundColor: isDarkMode ? "rgba(13, 18, 34, 0.94)" : theme.colors.surface,
    borderColor: isDarkMode ? "rgba(138, 148, 170, 0.28)" : theme.colors.border,
    borderRadius: isDarkMode ? 16 : 28,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: isDarkMode ? 0 : 0.04,
    shadowRadius: 12,
  };

  return (
    <ListSectionCard
      title={title}
      className={[className ?? ""].join(" ")}
      style={cardStyle}
      action={action}
    >
      <Box className="gap-2">
        {rows.map((row) => (
          <Box key={row.label} className="flex-row gap-2.5">
            <Text size="xs" className="shrink-0 font-medium" style={{ color: theme.colors.textSecondary }}>
              {row.label}
            </Text>
            <Box className="flex-1 min-w-0">{row.value}</Box>
          </Box>
        ))}
        {actions ? (
          <Box className="flex-row flex-wrap gap-2.5 border-t" style={[{ borderColor: theme.colors.border }, actionRowStyle ?? styles.actions]}>
            {actions}
          </Box>
        ) : null}
      </Box>
    </ListSectionCard>
  );
}

export const DockerResourceCard = memo(DockerResourceCardInner);
