import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import React from "react";

type AlertTone = "error" | "warning" | "info";

type AlertBannerProps = {
  title: string;
  detail?: string;
  tone?: AlertTone;
  actions?: React.ReactNode;
};

function getToneClasses(tone: AlertTone) {
  if (tone === "warning") {
    return {
      container: "border-warning-500 bg-warning-500/10",
      title: "text-warning-700",
      detail: "text-typography-900",
    };
  }

  if (tone === "info") {
    return {
      container: "border-primary-500 bg-primary-500/10",
      title: "text-primary-700",
      detail: "text-typography-900",
    };
  }

  return {
    container: "border-error-500 bg-error-500/10",
    title: "text-error-600",
    detail: "text-typography-900",
  };
}

export function AlertBanner({
  title,
  detail,
  tone = "error",
  actions,
}: AlertBannerProps) {
  const toneClasses = getToneClasses(tone);

  return (
    <Box className={`rounded-xl border p-3.5 ${toneClasses.container}`}>
      <VStack space="sm" className="gap-2">
        <Text size="sm" bold className={toneClasses.title}>
          {title}
        </Text>
        {detail ? (
          <Text size="md" className={toneClasses.detail}>
            {detail}
          </Text>
        ) : null}
        {actions ? (
          <HStack space="sm" className="flex-row flex-wrap gap-2.5">
            {actions}
          </HStack>
        ) : null}
      </VStack>
    </Box>
  );
}
