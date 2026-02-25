import React, { memo } from "react";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Box } from "@/components/ui/box";
import { Button, ButtonIcon } from "@/components/ui/button";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import type { ApiSession } from "@/components/chat/SessionManagementModal";
import { TrashIcon } from "@/components/icons/ChatActionIcons";

type SessionListItemProps = {
  item: ApiSession;
  isActive: boolean;
  isLoading: boolean;
  relativeDisplayPath: string;
  modelLabel: string;
  dateText: string;
  accentColor: string;
  borderColor: string;
  textSecondary: string;
  textTertiary: string;
  surfaceColor: string;
  activeSurfaceColor: string;
  dangerColor: string;
  onOpenSession: (item: ApiSession) => void;
  onDeleteSession: (item: ApiSession) => void;
};

function getSessionStatusLabel(item: ApiSession, hasModel: boolean) {
  return {
    isRunning: item.status === "running",
    hasModel,
  };
}

function SessionListItem({
  item,
  isActive,
  isLoading,
  relativeDisplayPath,
  modelLabel,
  dateText,
  accentColor,
  borderColor,
  textSecondary,
  textTertiary,
  surfaceColor,
  activeSurfaceColor,
  dangerColor,
  onOpenSession,
  onDeleteSession,
}: SessionListItemProps) {
  const { isRunning, hasModel } = getSessionStatusLabel(item, !!modelLabel);
  const shortId = item.id.length > 8 ? item.id.slice(0, 8) : item.id;
  return (
    <Pressable
      onPress={() => onOpenSession(item)}
      disabled={isLoading}
      className="rounded-xl overflow-hidden border"
      style={[
        {
          marginBottom: 8,
          overflow: "hidden",
          borderRadius: 12,
        },
        isActive
          ? {
              borderLeftWidth: 3,
              borderLeftColor: accentColor,
              borderColor: accentColor,
              backgroundColor: activeSurfaceColor,
              borderWidth: 1,
            }
          : {
              borderLeftWidth: 1,
              borderLeftColor: borderColor,
              borderColor,
              backgroundColor: surfaceColor,
            },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Open session ${item.title || "(No Input)"}`}
      accessibilityHint="Loads this session and opens it in the chat view"
    >
      <Box className="flex-row items-center px-3 py-3">
        <Box className="flex-1 min-w-0 pr-2">
          <Text
            size="sm"
            bold
            numberOfLines={1}
            style={{ color: isActive ? accentColor : undefined }}
            className={isActive ? "" : ""}
          >
            {item.title || "(No Input)"}
          </Text>

          <Box className="flex-row items-center mt-1">
            <Text
              size="xs"
              numberOfLines={1}
              ellipsizeMode="tail"
              className="shrink"
              style={{ color: textSecondary }}
            >
              {relativeDisplayPath}
            </Text>
            <Text size="xs" numberOfLines={1} ellipsizeMode="tail" style={{ color: textSecondary }}>
              {"  •  "}
              {shortId}
            </Text>
          </Box>

          <Box className="flex-row items-center mt-1">
            <Text size="xs" numberOfLines={1} style={{ color: textTertiary }}>
              {dateText}
            </Text>
            <Box className="ml-auto flex-row items-center gap-1">
              {isRunning ? (
                <Badge action="success" variant="solid" size="sm">
                  <BadgeText>RUNNING</BadgeText>
                </Badge>
              ) : null}
              {hasModel ? (
                <Badge action="muted" variant="solid" size="sm">
                  <BadgeText style={{ fontSize: 10 }}>{modelLabel}</BadgeText>
                </Badge>
              ) : null}
            </Box>
          </Box>
        </Box>

        <Box className="min-w-11 min-h-11 items-center justify-center">
          <Button
            action="default"
            variant="link"
            size="sm"
            onPress={() => onDeleteSession(item)}
            accessibilityLabel="Delete session"
            className="min-w-11 min-h-11"
          >
            <ButtonIcon as={TrashIcon} size="sm" style={{ color: dangerColor }} />
          </Button>
        </Box>
      </Box>
    </Pressable>
  );
}

export const SessionListItemCard = memo(SessionListItem);
