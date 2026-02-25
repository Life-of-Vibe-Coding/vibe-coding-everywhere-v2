import React from "react";
import type { StyleProp, TextStyle, ViewStyle } from "react-native";
import {
  ActionsheetItem,
  ActionsheetItemText,
} from "@/components/ui/actionsheet";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";

type ActionsheetOptionRowProps = {
  label: string;
  onPress: () => void;
  selected?: boolean;
  minHeight?: number;
  hitSlop?: { top?: number; bottom?: number; left?: number; right?: number };
  itemStyle?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
  itemClassName?: string;
  labelStyle?: StyleProp<TextStyle>;
  labelClassName?: string;
  selectedIndicatorLabel?: string;
  selectedIndicatorStyle?: StyleProp<TextStyle>;
};

export function ActionsheetOptionRow({
  label,
  onPress,
  selected = false,
  minHeight = 48,
  hitSlop = { top: 8, bottom: 8, left: 8, right: 8 },
  itemStyle,
  itemClassName,
  labelStyle,
  labelClassName,
  selectedIndicatorLabel,
  selectedIndicatorStyle,
}: ActionsheetOptionRowProps) {
  return (
    <ActionsheetItem
      onPress={onPress}
      hitSlop={hitSlop}
      style={
        typeof itemStyle === "function"
          ? (state) => [{ minHeight }, itemStyle(state)]
          : [{ minHeight }, itemStyle]
      }
      className={itemClassName}
    >
      <ActionsheetItemText bold={selected} style={labelStyle} className={labelClassName}>
        {label}
      </ActionsheetItemText>
      {selected && selectedIndicatorLabel ? (
        <Box className="ml-auto pl-2">
          <Text size="xs" bold style={selectedIndicatorStyle}>
            {selectedIndicatorLabel}
          </Text>
        </Box>
      ) : null}
    </ActionsheetItem>
  );
}
