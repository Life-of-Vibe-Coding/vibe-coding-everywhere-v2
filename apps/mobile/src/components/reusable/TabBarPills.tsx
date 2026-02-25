import React from "react";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";

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
  const isSegment = variant === "segment";

  return (
    <HStack
      space={isSegment ? undefined : "sm"}
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
              className={
                isSegment
                  ? active
                    ? "text-typography-900"
                    : "text-typography-600"
                  : active
                    ? "text-typography-0"
                    : "text-typography-700"
              }
            >
              {tab.label}
            </Text>
            {tab.badge !== undefined ? (
              <Box
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
                  className={
                    isSegment
                      ? active
                        ? "text-primary-700"
                        : "text-typography-700"
                      : active
                        ? "text-typography-0"
                        : "text-typography-700"
                  }
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
