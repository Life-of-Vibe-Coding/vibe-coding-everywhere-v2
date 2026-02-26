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
      backgroundColor: theme.mode === "dark" ? "rgba(6, 10, 20, 0.84)" : theme.colors.surfaceMuted,
      borderColor: theme.mode === "dark" ? "rgba(150, 199, 242, 0.38)" : theme.colors.border,
      borderRadius: theme.mode === "dark" ? 12 : 9999, // Pill shaped in light mode
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
              if (isSegment) {
                return [
                  {
                    borderColor: "transparent",
                    backgroundColor: "transparent",
                  },
                  active && {
                    backgroundColor: theme.mode === "dark" ? "rgba(160, 209, 255, 0.16)" : theme.colors.surface,
                    borderColor: theme.mode === "dark" ? "rgba(179, 223, 255, 0.36)" : theme.colors.border,
                    shadowColor: theme.mode === "dark" ? "transparent" : theme.colors.shadow,
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: theme.mode === "dark" ? 0 : 0.05,
                    shadowRadius: theme.mode === "dark" ? 0 : 4,
                  },
                  pressed && !active && {
                    backgroundColor: theme.mode === "dark" ? "rgba(160, 209, 255, 0.12)" : theme.colors.surfaceAlt,
                  },
                ];
              }
              return [
                {
                  backgroundColor: theme.mode === "dark" ? theme.colors.surfaceMuted : theme.colors.surfaceMuted,
                  borderColor: theme.mode === "dark" ? theme.colors.border : theme.colors.border,
                },
                active && {
                  backgroundColor: theme.mode === "dark" ? theme.colors.accent : theme.colors.accent,
                  borderColor: theme.mode === "dark" ? theme.colors.accent : theme.colors.accent,
                  shadowColor: theme.mode === "dark" ? theme.colors.accent : theme.colors.shadow,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: theme.mode === "dark" ? 0.4 : 0.1,
                  shadowRadius: theme.mode === "dark" ? 8 : 4,
                },
                pressed && !active && {
                  backgroundColor: theme.mode === "dark" ? theme.colors.surfaceAlt : theme.colors.surface,
                },
              ];
            }}
            className={[
              isSegment
                ? `min-h-[44px] px-4 border flex-1 flex-row items-center justify-center gap-1.5 ${theme.mode === 'dark' ? 'rounded-lg' : 'rounded-full'}`
                : "min-h-[44px] px-4 rounded-full border flex-row items-center justify-center gap-1.5",
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
                          : theme.colors.surfaceMuted
                        : theme.mode === "dark"
                          ? "rgba(255, 255, 255, 0.12)"
                          : theme.colors.surfaceAlt,
                    }
                    : {
                      backgroundColor: active
                        ? theme.mode === "dark"
                          ? "rgba(255, 255, 255, 0.2)"
                          : theme.colors.textSecondary
                        : theme.mode === "dark"
                          ? "rgba(255, 255, 255, 0.12)"
                          : theme.colors.surfaceAlt,
                    }
                }
                className="min-w-5 h-5 rounded-full px-1.5 items-center justify-center"
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
