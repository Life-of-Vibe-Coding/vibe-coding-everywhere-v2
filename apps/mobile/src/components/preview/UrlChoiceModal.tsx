import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Pressable,
} from "react-native";
import { useTheme } from "../../theme/index";

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
 * Modal for choosing between original (localhost) URL and VPN (Tailscale) URL.
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
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.card}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.description}>{description}</Text>

              <View style={styles.options}>
                <Pressable
                  style={({ pressed }) => [styles.optionPrimary, pressed && styles.optionPressed]}
                  onPress={onChooseVpn}
                  accessibilityRole="button"
                  accessibilityLabel={`Use VPN URL: ${truncateUrl(vpnUrl)}`}
                  accessibilityHint="Loads the page via Tailscale/VPN so this device can reach it"
                >
                  <Text style={styles.optionPrimaryLabel}>Use VPN URL</Text>
                  <Text style={styles.optionUrl} numberOfLines={1}>
                    {truncateUrl(vpnUrl)}
                  </Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [styles.optionSecondary, pressed && styles.optionPressed]}
                  onPress={onChooseOriginal}
                  accessibilityRole="button"
                  accessibilityLabel={`Keep original URL: ${truncateUrl(originalUrl)}`}
                  accessibilityHint="Keeps localhost; may not work on this device"
                >
                  <Text style={styles.optionSecondaryLabel}>Keep original</Text>
                  <Text style={styles.optionUrl} numberOfLines={1}>
                    {truncateUrl(originalUrl)}
                  </Text>
                </Pressable>
              </View>

              {onCancel && (
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={onCancel}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel"
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
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
