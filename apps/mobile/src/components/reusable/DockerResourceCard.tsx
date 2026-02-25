import React, { memo } from "react";
import { StyleSheet, type ViewStyle } from "react-native";
import { Box } from "@/components/ui/box";
import { ListSectionCard } from "@/components/reusable/ListSectionCard";
import { Text } from "@/components/ui/text";

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
  return (
    <ListSectionCard
      title={title}
      className={["border-outline-200 rounded-2xl bg-background-0", className ?? ""].join(" ")}
      action={action}
    >
      <Box className="gap-2">
        {rows.map((row) => (
          <Box key={row.label} className="flex-row gap-2.5">
            <Text size="xs" className="text-typography-500 shrink-0 font-medium">
              {row.label}
            </Text>
            <Box className="flex-1 min-w-0">{row.value}</Box>
          </Box>
        ))}
        {actions ? (
          <Box className="flex-row flex-wrap gap-2.5 border-t border-outline-200" style={actionRowStyle ?? styles.actions}>
            {actions}
          </Box>
        ) : null}
      </Box>
    </ListSectionCard>
  );
}

export const DockerResourceCard = memo(DockerResourceCardInner);
