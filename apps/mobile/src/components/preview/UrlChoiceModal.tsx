import React, { useMemo } from "react";
import { StyleSheet, Modal, TouchableWithoutFeedback } from "react-native";
import { useTheme } from "@/theme/index";
import { EntranceAnimation } from "@/design-system";
import { Box } from "@/components/ui/box";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";

const MIN_TOUCH_TARGET = 44;
const URL_PREVIEW_MAX_LEN = 40;

function truncateUrl(url: string, maxLen: number = URL_PREVIEW_MAX_LEN): string {
  if (url.length <= maxLen) return url;
  return url.slice(0, maxLen - 3) + "…";
}

interface UrlChoiceModalProps {
  visible: boolean;
  title: string;
  description: string;
  originalUrl: string;
  vpnUrl: string;
  onChooseOriginal: () => void;
  onChooseVpn: () => void;
  onCancel?: () => void;
}

/**
 * Modal for choosing between original (localhost) URL and tunnel URL.
 * Follows UI/UX Pro Max: 44px touch targets, WCAG contrast, clear hierarchy, accessibility.
 */
export function UrlChoiceModal({
  visible,
  title,
  description,
  originalUrl,
  vpnUrl,
  onChooseOriginal,
  onChooseVpn,
  onCancel,
}: UrlChoiceModalProps) {
  const theme = useTheme();
  const styles = useMemo(() => createModalStyles(theme), [theme]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={onCancel}>
        <Box style={styles.backdrop} className="flex-1 justify-center items-center p-8">
          <TouchableWithoutFeedback onPress={() => {}}>
            <EntranceAnimation variant="scale" duration={280}>
            <Box style={styles.card} className="w-full max-w-90 rounded-xl p-8 bg-background-0">
              <Text size="lg" bold className="text-typography-900 mb-4">{title}</Text>
              <Text size="md" className="text-typography-600 mb-6 leading-5">{description}</Text>

              <Box style={styles.options} className="gap-4">
                <Pressable
                  onPress={onChooseVpn}
                  accessibilityRole="button"
                  accessibilityLabel={`Use VPN URL: ${truncateUrl(vpnUrl)}`}
                  accessibilityHint="Loads the page via tunnel so this device can reach it"
                  className="min-h-11 py-4 px-6 rounded-lg border border-primary-500 bg-primary-500/10"
                >
                  <Text size="sm" bold className="text-primary-500 mb-0.5">Use VPN URL</Text>
                  <Text size="xs" numberOfLines={1} className="text-typography-500">{truncateUrl(vpnUrl)}</Text>
                </Pressable>

                <Pressable
                  onPress={onChooseOriginal}
                  accessibilityRole="button"
                  accessibilityLabel={`Keep original URL: ${truncateUrl(originalUrl)}`}
                  accessibilityHint="Keeps localhost; may not work on this device"
                  className="min-h-11 py-4 px-6 rounded-lg border border-outline-400 bg-background-50"
                >
                  <Text size="sm" bold className="text-typography-900 mb-0.5">Keep original</Text>
                  <Text size="xs" numberOfLines={1} className="text-typography-500">{truncateUrl(originalUrl)}</Text>
                </Pressable>
              </Box>

              {onCancel && (
                <Pressable
                  onPress={onCancel}
                  className="min-h-11 mt-6 py-2 items-center justify-center"
                  accessibilityRole="button"
                  accessibilityLabel="Cancel"
                >
                  <Text size="sm" className="text-typography-500">Cancel</Text>
                </Pressable>
              )}
            </Box>
            </EntranceAnimation>
          </TouchableWithoutFeedback>
        </Box>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

function createModalStyles(theme: ReturnType<typeof useTheme>) {
  const { typography, spacing, radii, colors } = theme;
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: "center",
      alignItems: "center",
      padding: spacing.lg,
    },
    card: {
      width: "100%",
      maxWidth: 360,
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: spacing.lg,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 24,
      elevation: 12,
    },
    title: {
      fontSize: typography.title3.fontSize,
      lineHeight: typography.title3.lineHeight,
      fontWeight: typography.title3.fontWeight,
      color: colors.textPrimary,
      marginBottom: spacing.sm,
    },
    description: {
      fontSize: typography.body.fontSize,
      lineHeight: typography.body.lineHeight * 1.25,
      color: colors.textSecondary,
      marginBottom: spacing.lg,
    },
    options: {
      gap: spacing.sm,
    },
    optionPrimary: {
      minHeight: MIN_TOUCH_TARGET,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.accentSubtle,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.accent,
    },
    optionSecondary: {
      minHeight: MIN_TOUCH_TARGET,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.surfaceAlt,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    optionPressed: {
      opacity: 0.85,
    },
    optionPrimaryLabel: {
      fontSize: typography.callout.fontSize,
      fontWeight: "600",
      color: colors.accent,
      marginBottom: 2,
    },
    optionSecondaryLabel: {
      fontSize: typography.callout.fontSize,
      fontWeight: "600",
      color: colors.textPrimary,
      marginBottom: 2,
    },
    optionUrl: {
      fontSize: typography.caption.fontSize,
      color: colors.textMuted,
    },
    cancelBtn: {
      minHeight: MIN_TOUCH_TARGET,
      marginTop: spacing.md,
      paddingVertical: spacing.sm,
      alignItems: "center",
      justifyContent: "center",
    },
    cancelText: {
      fontSize: typography.callout.fontSize,
      color: colors.textMuted,
    },
  });
}
