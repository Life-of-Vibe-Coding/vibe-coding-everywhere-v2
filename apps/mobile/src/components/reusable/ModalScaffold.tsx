import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { HStack } from "@/components/ui/hstack";
type ModalBodyProps = React.ComponentProps<typeof ModalBody>;

type ModalScaffoldProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  headerRight?: React.ReactNode;
  size?: "xs" | "sm" | "md" | "lg" | "full";
  contentClassName?: string;
  bodyClassName?: string;
  showHeader?: boolean;
  showCloseButton?: boolean;
  closeLabel?: string;
  bodyProps?: ModalBodyProps;
};

export function ModalScaffold({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  headerRight,
  size = "md",
  contentClassName,
  bodyClassName,
  showHeader = true,
  showCloseButton = true,
  closeLabel = "Close",
  bodyProps,
}: ModalScaffoldProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal isOpen={isOpen} onClose={onClose} size={size}>
      <ModalBackdrop />
      <ModalContent className={contentClassName}>
        {showHeader ? (
          <ModalHeader
            className="gap-3"
            style={{ paddingTop: Math.max(insets.top, 0) }}
          >
            <Box className="flex-1 min-w-0 pr-2">
              <Text size="lg" bold className="text-text-primary" numberOfLines={1}>
                {title}
              </Text>
              {subtitle ? (
                <Text size="sm" className="text-text-secondary mt-1" numberOfLines={2}>
                  {subtitle}
                </Text>
              ) : null}
            </Box>
            <HStack space="sm" className="items-center">
              {headerRight}
              {showCloseButton ? (
                <ModalCloseButton
                  className="h-11 w-11 items-center justify-center rounded-md bg-background-100 active:bg-background-200"
                  accessibilityLabel={closeLabel}
                >
                  <Text size="lg" className="text-text-primary">
                    ×
                  </Text>
                </ModalCloseButton>
              ) : null}
            </HStack>
          </ModalHeader>
        ) : null}
        <ModalBody
          {...bodyProps}
          className={bodyClassName}
          contentContainerStyle={[
            { paddingBottom: Math.max(insets.bottom, 8) },
            bodyProps?.contentContainerStyle,
          ]}
        >
          {children}
        </ModalBody>
        {footer ? <ModalFooter>{footer}</ModalFooter> : null}
      </ModalContent>
    </Modal>
  );
}
