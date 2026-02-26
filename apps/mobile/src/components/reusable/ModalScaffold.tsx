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
import { useTheme } from "@/theme/index";
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
  headerClassName?: string;
  headerStyle?: any;
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
  headerClassName,
  headerStyle,
  showHeader = true,
  showCloseButton = true,
  closeLabel = "Close",
  bodyProps,
}: ModalScaffoldProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  return (
    <Modal isOpen={isOpen} onClose={onClose} size={size}>
      <ModalBackdrop />
      <ModalContent className={contentClassName}>
        {showHeader ? (
          <ModalHeader
            className={`gap-3 ${headerClassName || ""}`}
            style={[
              {
                paddingTop: Math.max(insets.top, 0),
                backgroundColor: theme.mode === "dark" ? "rgba(10, 15, 30, 0.8)" : theme.colors.surfaceMuted,
              },
              headerStyle,
            ]}
          >
            <Box className="flex-1 min-w-0 pr-2">
              {typeof title === "string" ? (
                <Text
                  size="lg"
                  bold
                  numberOfLines={1}
                  style={{ color: theme.colors.textPrimary }}
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
                  style={{ color: theme.mode === "dark" ? "rgba(0, 229, 255, 0.6)" : theme.colors.textSecondary, marginTop: 4 }}
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
                  style={{
                    height: 44,
                    width: 44,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: theme.mode === "dark" ? 12 : 9999,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    backgroundColor: theme.colors.surfaceAlt,
                  }}
                  className="active:opacity-80"
                >
                  <Text
                    size="lg"
                    style={{ color: theme.colors.textPrimary }}
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
            { flexGrow: 1, paddingBottom: Math.max(insets.bottom, 8) },
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

