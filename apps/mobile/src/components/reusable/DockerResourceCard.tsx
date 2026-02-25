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
  row: {
    flexDirection: "row",
    gap: 8,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
    paddingTop: 12,
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
    <ListSectionCard title={title} className={className} action={action}>
      <Box className="gap-2">
        {rows.map((row) => (
          <Box key={row.label} className="flex-row gap-2">
            <Text size="xs" className="text-typography-500 shrink-0">
              {row.label}
            </Text>
            <Box className="flex-1 min-w-0">{row.value}</Box>
          </Box>
        ))}
        {actions ? (
          <Box className="flex-row flex-wrap gap-2 border-t border-outline-200" style={actionRowStyle ?? styles.actions}>
            {actions}
          </Box>
        ) : null}
      </Box>
      </ListSectionCard>
  );
}

export const DockerResourceCard = memo(DockerResourceCardInner);
