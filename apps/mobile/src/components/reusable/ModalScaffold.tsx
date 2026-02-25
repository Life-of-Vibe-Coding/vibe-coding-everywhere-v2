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
import { useColorMode } from "@/theme/index";
type ModalBodyProps = React.ComponentProps<typeof ModalBody>;

type ModalScaffoldProps = {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
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
  const isDark = useColorMode() === "dark";

  return (
    <Modal isOpen={isOpen} onClose={onClose} size={size}>
      <ModalBackdrop />
      <ModalContent className={contentClassName}>
        {showHeader ? (
          <ModalHeader
            className="gap-3"
            style={{
              paddingTop: Math.max(insets.top, 0),
              backgroundColor: isDark ? "rgba(10, 15, 30, 0.8)" : undefined,
            }}
          >
            <Box className="flex-1 min-w-0 pr-2">
              {typeof title === "string" ? (
                <Text
                  size="lg"
                  bold
                  numberOfLines={1}
                  style={isDark ? { color: "#ffffff" } : undefined}
                  className={isDark ? undefined : "text-text-primary"}
                >
                  {title}
                </Text>
              ) : (
                title
              )}
              {subtitle ? (
                <Text
                  size="sm"
                  numberOfLines={2}
                  style={isDark ? { color: "rgba(0, 229, 255, 0.6)", marginTop: 4 } : { marginTop: 4 }}
                  className={isDark ? undefined : "text-text-secondary"}
                >
                  {subtitle}
                </Text>
              ) : null}
            </Box>
            <HStack space="sm" className="items-center">
              {headerRight}
              {showCloseButton ? (
                <ModalCloseButton
                  accessibilityLabel={closeLabel}
                  style={isDark ? {
                    height: 44,
                    width: 44,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: "rgba(0, 229, 255, 0.85)",
                    backgroundColor: "rgba(0, 24, 46, 0.9)",
                  } : undefined}
                  className={isDark ? undefined : "h-11 w-11 items-center justify-center rounded-md bg-background-100 active:bg-background-200"}
                >
                  <Text
                    size="lg"
                    style={isDark ? { color: "#00e5ff" } : undefined}
                    className={isDark ? undefined : "text-text-primary"}
                  >
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

