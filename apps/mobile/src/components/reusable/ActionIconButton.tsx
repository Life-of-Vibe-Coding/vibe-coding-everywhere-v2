import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import React from "react";

type Tone = "default" | "primary" | "danger";

type ActionIconButtonProps = {
  icon: React.ElementType<{ size?: number; color?: string; className?: string }>;
  label?: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: Tone;
  iconSize?: number;
  className?: string;
  accessibilityLabel?: string;
};

function getToneClasses(tone: Tone) {
  if (tone === "primary") {
    return {
      button: "bg-primary-500 border-primary-500 active:bg-primary-600",
      text: "text-typography-0",
      icon: "text-typography-0",
    };
  }
  if (tone === "danger") {
    return {
      button: "bg-error-500 border-error-500 active:bg-error-600",
      text: "text-typography-0",
      icon: "text-typography-0",
    };
  }
  return {
    button: "bg-background-0 border-outline-200 active:bg-background-100",
    text: "text-typography-700",
    icon: "text-typography-700",
  };
}

export function ActionIconButton({
  icon: Icon,
  label,
  onPress,
  disabled,
  tone = "default",
  iconSize = 18,
  className,
  accessibilityLabel,
}: ActionIconButtonProps) {
  const toneClass = getToneClasses(tone);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel ?? label ?? "action"}
      accessibilityRole="button"
      className={[
        "min-h-11 px-3 rounded-lg border items-center justify-center",
        toneClass.button,
        disabled ? "opacity-40" : "",
        className ?? "",
      ].join(" ")}
    >
      <HStack space="xs" className="items-center">
        <Icon size={iconSize} className={toneClass.icon} />
        {label ? (
          <Text size="sm" bold className={toneClass.text}>
            {label}
          </Text>
        ) : null}
      </HStack>
    </Pressable>
  );
}

