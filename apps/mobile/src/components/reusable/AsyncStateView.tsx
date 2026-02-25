import React from "react";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

type AsyncStateViewProps = {
  isLoading?: boolean;
  isEmpty?: boolean;
  error?: string | null;
  loadingText?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  retryLabel?: string;
  onRetry?: () => void;
  children?: React.ReactNode;
  className?: string;
};

export function AsyncStateView({
  isLoading,
  isEmpty,
  error,
  loadingText = "Loading...",
  emptyTitle = "Nothing to show",
  emptyDescription,
  retryLabel = "Retry",
  onRetry,
  children,
  className,
}: AsyncStateViewProps) {
  if (isLoading) {
    return (
      <Box className={className}>
        <VStack space="sm" className="items-center justify-center py-8">
          <Spinner size="small" />
          <Text size="sm" className="text-typography-500">
            {loadingText}
          </Text>
        </VStack>
      </Box>
    );
  }

  if (error) {
    return (
      <Box className={className}>
        <VStack space="sm" className="items-center justify-center py-8">
          <Text size="sm" className="text-error-600 text-center">
            {error}
          </Text>
          {onRetry ? (
            <Button size="sm" variant="outline" action="primary" onPress={onRetry}>
              <ButtonText>{retryLabel}</ButtonText>
            </Button>
          ) : null}
        </VStack>
      </Box>
    );
  }

  if (isEmpty) {
    return (
      <Box className={className}>
        <VStack space="sm" className="items-center justify-center py-8">
          <Text size="md" bold className="text-typography-700 text-center">
            {emptyTitle}
          </Text>
          {emptyDescription ? (
            <Text size="sm" className="text-typography-500 text-center">
              {emptyDescription}
            </Text>
          ) : null}
        </VStack>
      </Box>
    );
  }

  return <Box className={className}>{children}</Box>;
}

