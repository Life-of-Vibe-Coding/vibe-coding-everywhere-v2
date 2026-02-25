import React from "react";
import {
  ActionsheetItem,
  ActionsheetItemText,
} from "@/components/ui/actionsheet";

type ActionsheetOptionRowProps = {
  label: string;
  onPress: () => void;
  selected?: boolean;
  minHeight?: number;
  hitSlop?: { top?: number; bottom?: number; left?: number; right?: number };
};

export function ActionsheetOptionRow({
  label,
  onPress,
  selected = false,
  minHeight = 48,
  hitSlop = { top: 8, bottom: 8, left: 8, right: 8 },
}: ActionsheetOptionRowProps) {
  return (
    <ActionsheetItem
      onPress={onPress}
      hitSlop={hitSlop}
      style={{ minHeight }}
    >
      <ActionsheetItemText bold={selected}>{label}</ActionsheetItemText>
    </ActionsheetItem>
  );
}
