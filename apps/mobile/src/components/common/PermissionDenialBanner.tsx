import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useTheme } from "../../theme/index";
import type { PermissionDenial } from "../../services/socket/hooks";

interface PermissionDenialBannerProps {
  denials: PermissionDenial[];
  onDismiss: () => void;
  onAccept: () => void;
}

export function PermissionDenialBanner({ denials, onDismiss, onAccept }: PermissionDenialBannerProps) {
  const theme = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          borderWidth: 1,
          borderColor: theme.danger,
          backgroundColor: "#fff3f3",
          borderRadius: 12,
          padding: 14,
        },
        summary: { fontWeight: "600" as const, color: theme.danger, marginBottom: 6 },
        detail: { fontSize: 14, color: theme.textPrimary, marginBottom: 10 },
        actions: { flexDirection: "row" as const, gap: 10, flexWrap: "wrap" as const },
        btnReject: {
          paddingVertical: 6,
          paddingHorizontal: 14,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: theme.danger,
          backgroundColor: theme.surfaceBg,
        },
        btnRejectText: { fontWeight: "500" as const, color: theme.danger },
        btnAccept: {
          paddingVertical: 6,
          paddingHorizontal: 14,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: theme.danger,
          backgroundColor: theme.danger,
        },
        btnAcceptText: { fontWeight: "500" as const, color: "#fff" },
      }),
    [theme]
  );
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
    <View style={styles.container}>
      <Text style={styles.summary}>{summary}</Text>
      <Text style={styles.detail}>{detail}</Text>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.btnReject} onPress={onDismiss} activeOpacity={0.8}>
          <Text style={styles.btnRejectText}>Dismiss</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnAccept} onPress={onAccept} activeOpacity={0.8}>
          <Text style={styles.btnAcceptText}>Accept & retry</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

