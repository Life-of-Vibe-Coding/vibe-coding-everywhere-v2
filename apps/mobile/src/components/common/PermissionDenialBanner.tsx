import React from "react";
import type { PermissionDenial } from "../../services/socket/hooks";
import { Button, ButtonText } from "../../../components/ui/button";
import { Box } from "../../../components/ui/box";
import { Text } from "../../../components/ui/text";
import { VStack } from "../../../components/ui/vstack";
import { HStack } from "../../../components/ui/hstack";
import { EntranceAnimation } from "../../design-system";
interface PermissionDenialBannerProps {
  denials: PermissionDenial[];
  onDismiss: () => void;
  onAccept: () => void;
}

export function PermissionDenialBanner({ denials, onDismiss, onAccept }: PermissionDenialBannerProps) {
  if (!denials || denials.length === 0) return null;

  const summary = denials.length === 1 ? "Permission denied" : "Permissions denied";
  const detail = denials
    .map((d) => {
      const tool = d.tool_name ?? d.tool ?? "?";
      const path = d.tool_input?.file_path ?? d.tool_input?.path ?? "";
      return path ? `${tool}: ${path}` : tool;
    })
    .join("\n");

  return (
    <EntranceAnimation variant="slideUp" duration={280}>
      <Box className="border border-error-500 rounded-xl p-3.5 bg-error-500/10">
      <VStack space="sm" className="gap-2">
        <Text size="sm" bold className="text-error-600">
          {summary}
        </Text>
        <Text size="md" className="text-typography-900">
          {detail}
        </Text>
        <HStack space="sm" className="flex-row flex-wrap gap-2.5">
          <Button
            variant="outline"
            action="negative"
            size="md"
            onPress={onDismiss}
            className="min-h-11"
          >
            <ButtonText>Dismiss</ButtonText>
          </Button>
          <Button
            variant="solid"
            action="negative"
            size="md"
            onPress={onAccept}
            className="min-h-11"
          >
            <ButtonText>Accept & retry</ButtonText>
          </Button>
        </HStack>
      </VStack>
    </Box>
    </EntranceAnimation>
  );
}

