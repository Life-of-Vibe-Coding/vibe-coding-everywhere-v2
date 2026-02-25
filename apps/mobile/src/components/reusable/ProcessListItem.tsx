import React, { memo, useMemo } from "react";
import { Platform } from "react-native";
import { Pressable } from "@/components/ui/pressable";
import { Box } from "@/components/ui/box";
import { Button, ButtonIcon, ButtonText } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { EntranceAnimation } from "@/design-system";
import { useTheme } from "@/theme";
import { StopCircleIcon } from "@/components/icons/ChatActionIcons";

type ProcessListItemProps = {
  pid: number;
  port: number;
  command: string;
  logPaths?: string[];
  accentColor: string;
  isKilling?: boolean;
  onViewLog: (logPath: string) => void;
  onKill: () => void;
};

function getLogLabel(logPath: string) {
  return logPath.includes("/") ? logPath.split("/").pop() ?? logPath : logPath;
}

function getTerminalFont() {
  return Platform.OS === "ios" ? "Menlo" : "monospace";
}

type ProcessMetaPillProps = {
  label: string;
  accentColor: string;
};

function ProcessMetaPill({ label, accentColor }: ProcessMetaPillProps) {
  return (
    <Box
      className="px-2 py-0.5 rounded-sm border"
      style={{
        backgroundColor: `${accentColor}12`,
        borderColor: `${accentColor}30`,
      }}
    >
      <Text size="xs" bold style={{ color: accentColor }}>
        {label}
      </Text>
    </Box>
  );
}

function ProcessListItem({
  pid,
  port,
  command,
  logPaths,
  accentColor,
  isKilling,
  onViewLog,
  onKill,
}: ProcessListItemProps) {
  const theme = useTheme();
  const normalizedLogPaths = useMemo(() => logPaths ?? [], [logPaths]);
  const commandFont = useMemo(getTerminalFont, []);
  const shellHint = useMemo(() => command.split(" ")[0] || "process", [command]);
  const cardStyle = useMemo(
    () => ({
      backgroundColor: theme.colors.surface,
      borderColor: `${accentColor}45`,
      shadowColor: theme.colors.shadow,
      shadowOpacity: 0.18,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 3,
    }),
    [accentColor, theme.colors.shadow, theme.colors.surface]
  );
  const commandBlockStyle = useMemo(
    () => ({
      backgroundColor: theme.colors.surfaceAlt,
      borderColor: `${accentColor}33`,
    }),
    [accentColor, theme.colors.surfaceAlt]
  );
  const labelMutedStyle = useMemo(
    () => ({ color: theme.colors.textMuted }),
    [theme.colors.textMuted]
  );

  return (
    <EntranceAnimation variant="slideUp" delay={0}>
      <Box
        className="flex-col rounded-2xl border gap-3 overflow-hidden p-4"
        style={cardStyle}
      >
        <Box className="min-w-0">
          <HStack className="flex-wrap items-center gap-2 mb-3">
            <ProcessMetaPill label={`PID ${pid}`} accentColor={accentColor} />
            <ProcessMetaPill label={`Port ${port}`} accentColor={accentColor} />
            <Text size="xs" className="uppercase tracking-wide" style={labelMutedStyle}>
              {shellHint}
            </Text>
          </HStack>
          <Box className="rounded-xl border px-3 py-2" style={commandBlockStyle}>
            <Text
              size="xs"
              numberOfLines={4}
              selectable
              className="font-semibold text-typography-900 font-mono"
              style={{ fontFamily: commandFont }}
            >
              {command}
            </Text>
          </Box>
        </Box>
        <HStack className="flex-row flex-wrap items-center gap-2 justify-between">
          {normalizedLogPaths.map((logPath) => {
            const label = getLogLabel(logPath);
            return (
              <Pressable
                key={logPath}
                onPress={() => onViewLog(logPath)}
                accessibilityLabel={`View log ${label}`}
                className="rounded-lg border px-3 py-2 min-h-11 justify-center"
                hitSlop={8}
                style={{
                  backgroundColor: `${accentColor}14`,
                  borderColor: `${accentColor}40`,
                  minWidth: 84,
                }}
              >
                <Text size="xs" bold style={{ color: accentColor }}>
                  Log: {label}
                </Text>
              </Pressable>
            );
          })}
          <Box className="min-h-11 justify-center">
            <Button
              action="negative"
              variant="solid"
              size="sm"
              onPress={onKill}
              isDisabled={isKilling}
              className="rounded-lg min-h-11"
            >
              <ButtonIcon as={StopCircleIcon} size="sm" />
              <ButtonText>{isKilling ? "Stopping" : "Kill"}</ButtonText>
            </Button>
          </Box>
        </HStack>
      </Box>
    </EntranceAnimation>
  );
}

export const ProcessListItemCard = memo(ProcessListItem);
