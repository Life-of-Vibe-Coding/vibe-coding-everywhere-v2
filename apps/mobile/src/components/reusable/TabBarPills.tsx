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
};

export function TabBarPills<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: TabBarPillsProps<T>) {
  return (
    <HStack space="sm" className={className}>
      {tabs.map((tab) => {
        const active = tab.key === value;
        return (
          <Pressable
            key={tab.key}
            disabled={tab.disabled}
            onPress={() => onChange(tab.key)}
            className={[
              "min-h-11 px-4 rounded-full border flex-row items-center justify-center gap-1.5",
              active
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
              className={active ? "text-typography-0" : "text-typography-700"}
            >
              {tab.label}
            </Text>
            {tab.badge !== undefined ? (
              <Box
                className={[
                  "min-w-5 h-5 rounded-full px-1.5 items-center justify-center",
                  active ? "bg-primary-700" : "bg-background-200",
                ].join(" ")}
              >
                <Text
                  size="2xs"
                  bold
                  className={active ? "text-typography-0" : "text-typography-700"}
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

