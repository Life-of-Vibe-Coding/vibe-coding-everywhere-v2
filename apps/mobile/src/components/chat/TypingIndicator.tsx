import React, { useEffect, useRef, useMemo } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useTheme } from "../../theme/index";
import { Typography } from "../../design-system";
import { GeminiIcon, ClaudeIcon, CodexIcon } from "../icons/ProviderIcons";

interface TypingIndicatorProps {
  visible: boolean;
  /** AI provider; loading is a circular line segment running around the icon. */
  provider?: "claude" | "gemini" | "codex" | "pi";
  /** Current tool/skill activity description (e.g. "Reading file", "Running command") */
  activity?: string | null;
}

const ICON_SIZE = 24;
const WRAP_SIZE = 40;
const RING_RADIUS = 17;
const RING_STROKE = 2;
const C = WRAP_SIZE / 2;

// Arc from top (0°) clockwise ~90° — a single segment that will rotate around the circle
const ARC_ANGLE = Math.PI / 2;
const startX = C + RING_RADIUS * Math.sin(0);
const startY = C - RING_RADIUS * Math.cos(0);
const endX = C + RING_RADIUS * Math.sin(ARC_ANGLE);
const endY = C - RING_RADIUS * Math.cos(ARC_ANGLE);
const RING_ARC_D = `M ${startX} ${startY} A ${RING_RADIUS} ${RING_RADIUS} 0 0 1 ${endX} ${endY}`;

const SPIN_DURATION_MS = 300;
const SPIN_DELAY_MS = 2000;

/** Strip markdown/links for plain display. */
function stripActivityForDisplay(s: string): string {
  return s
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^[📖✏️📝🖥📋❓🔍]\s*/, "")
    .trim();
}

export function TypingIndicator({ visible, provider = "pi", activity }: TypingIndicatorProps) {
  const theme = useTheme();
  const ringSpin = useRef(new Animated.Value(0)).current;
  const iconSpin = useRef(new Animated.Value(0)).current;
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flexDirection: "row" as const,
          alignItems: "center",
          gap: 14,
          paddingVertical: 8,
        },
        iconCell: {
          width: WRAP_SIZE,
          height: WRAP_SIZE,
          alignItems: "center",
          justifyContent: "center",
        },
        iconWrap: { width: ICON_SIZE, height: ICON_SIZE },
        ringOverlay: {
          position: "absolute",
          width: WRAP_SIZE,
          height: WRAP_SIZE,
          alignItems: "center",
          justifyContent: "center",
        },
        activityText: {
          flex: 1,
          fontSize: 13,
          lineHeight: 18,
        },
      }),
    []
  );

  useEffect(() => {
    if (!visible) return;
    ringSpin.setValue(0);
    const ringAnimation = Animated.loop(
      Animated.timing(ringSpin, {
        toValue: 1,
        useNativeDriver: true,
        duration: 1000,
      })
    );
    ringAnimation.start();
    return () => ringAnimation.stop();
  }, [visible, ringSpin]);

  useEffect(() => {
    if (!visible) return;
    iconSpin.setValue(0);
    const iconAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(iconSpin, {
          toValue: 1,
          useNativeDriver: true,
          duration: SPIN_DURATION_MS,
        }),
        Animated.delay(SPIN_DELAY_MS),
        Animated.timing(iconSpin, {
          toValue: 0,
          useNativeDriver: true,
          duration: 0,
        }),
      ])
    );
    iconAnimation.start();
    return () => iconAnimation.stop();
  }, [visible, iconSpin]);

  if (!visible) return null;

  const ringRotate = ringSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });
  const iconRotate = iconSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });
  const Icon = provider === "claude" ? ClaudeIcon : provider === "codex" || provider === "pi" ? CodexIcon : GeminiIcon;
  const ringColor = theme.colors.accent;

  const displayActivity = activity && activity.trim() ? stripActivityForDisplay(activity) : null;

  return (
    <View style={styles.container}>
      <View style={styles.iconCell}>
        <Animated.View style={[styles.iconWrap, { transform: [{ rotate: iconRotate }] }]}>
          <Icon size={ICON_SIZE} />
        </Animated.View>
        <Animated.View style={[styles.ringOverlay, { transform: [{ rotate: ringRotate }] }]}>
          <Svg width={WRAP_SIZE} height={WRAP_SIZE} viewBox={`0 0 ${WRAP_SIZE} ${WRAP_SIZE}`}>
            <Path
              d={RING_ARC_D}
              stroke={ringColor}
              strokeWidth={RING_STROKE}
              strokeLinecap="round"
              fill="none"
            />
          </Svg>
        </Animated.View>
      </View>
      {displayActivity ? (
        <Typography
          variant="caption"
          tone="secondary"
          weight="medium"
          numberOfLines={2}
          style={styles.activityText}
        >
          {displayActivity}
        </Typography>
      ) : null}
    </View>
  );
}
