import React from "react";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme/index";

export type TabBarPillItem<T extends string> = {
  key: T;
  label: string;
  disabled?: boolean;
  badge?: string | number;
};

type TabBarPillsProps<T extends string> = {
  tabs: Array<TabBarPillItem<T>>;
  value: T;
  onChange: (next: T) => void;
  className?: string;
  variant?: "pill" | "segment";
};

export function TabBarPills<T extends string>({
  tabs,
  value,
  onChange,
  className,
  variant = "pill",
}: TabBarPillsProps<T>) {
  const theme = useTheme();
  const isSegment = variant === "segment";
  const segmentRailStyle = isSegment
    ? {
      backgroundColor:
        theme.mode === "dark" ? "rgba(6, 10, 20, 0.84)" : "rgba(255, 255, 255, 0.94)",
      borderColor: theme.mode === "dark" ? "rgba(150, 199, 242, 0.38)" : "rgba(15, 23, 42, 0.12)",
    }
    : undefined;

  return (
    <HStack
      space={isSegment ? undefined : "sm"}
      style={segmentRailStyle}
      className={[
        isSegment
          ? "rounded-xl border border-outline-200 bg-background-100 p-1 gap-1"
          : "",
        className ?? "",
      ].join(" ")}
    >
      {tabs.map((tab) => {
        const active = tab.key === value;
        return (
          <Pressable
            key={tab.key}
            disabled={tab.disabled}
            onPress={() => onChange(tab.key)}
            style={({ pressed }) => {
              if (!isSegment) return undefined;
              return [
                {
                  borderColor: "transparent",
                  backgroundColor: "transparent",
                },
                active && {
                  backgroundColor: theme.mode === "dark" ? "rgba(160, 209, 255, 0.16)" : "rgba(15, 23, 42, 0.08)",
                  borderColor: theme.mode === "dark" ? "rgba(179, 223, 255, 0.36)" : "rgba(15, 23, 42, 0.12)",
                },
                pressed && !active && {
                  backgroundColor: theme.mode === "dark" ? "rgba(160, 209, 255, 0.12)" : "rgba(15, 23, 42, 0.06)",
                },
              ];
            }}
            className={[
              isSegment
                ? "min-h-11 px-4 rounded-lg border flex-1 flex-row items-center justify-center gap-1.5"
                : "min-h-11 px-4 rounded-full border flex-row items-center justify-center gap-1.5",
              isSegment
                ? active
                  ? "bg-background-0 border-outline-300"
                  : "bg-transparent border-transparent active:bg-background-200"
                : active
                  ? "bg-primary-500 border-primary-500"
                  : "bg-background-0 border-outline-200 active:bg-background-100",
              tab.disabled ? "opacity-40" : "",
            ].join(" ")}
            accessibilityRole="tab"
            accessibilityState={{ selected: active, disabled: tab.disabled }}
          >
            <Text
              size="sm"
              bold={active}
              style={{
                color: isSegment
                  ? active
                    ? theme.colors.textPrimary
                    : theme.colors.textSecondary
                  : active
                    ? theme.colors.textInverse
                    : theme.colors.textPrimary,
              }}
            >
              {tab.label}
            </Text>
            {tab.badge !== undefined ? (
              <Box
                style={
                  isSegment
                    ? {
                      backgroundColor: active
                        ? theme.mode === "dark"
                          ? "rgba(173, 222, 255, 0.2)"
                          : "rgba(15, 23, 42, 0.1)"
                        : theme.mode === "dark"
                          ? "rgba(255, 255, 255, 0.12)"
                          : "rgba(15, 23, 42, 0.08)",
                    }
                    : undefined
                }
                className={[
                  "min-w-5 h-5 rounded-full px-1.5 items-center justify-center",
                  isSegment
                    ? active
                      ? "bg-primary-100"
                      : "bg-background-200"
                    : active
                      ? "bg-primary-700"
                      : "bg-background-200",
                ].join(" ")}
              >
                <Text
                  size="2xs"
                  bold
                  style={{
                    color: isSegment
                      ? active
                        ? theme.colors.accent
                        : theme.colors.textSecondary
                      : active
                        ? theme.colors.textInverse
                        : theme.colors.textPrimary,
                  }}
                >
                  {String(tab.badge)}
                </Text>
              </Box>
            ) : null}
          </Pressable>
        );
      })}
    </HStack>
  );
}
