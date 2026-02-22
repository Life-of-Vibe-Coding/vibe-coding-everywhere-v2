/**
 * Agent notifications - local notifications when the AI agent finishes
 * or needs user approval (human-in-the-loop).
 *
 * Shows notifications when:
 * - Agent finishes its final response
 * - Agent needs user approval (e.g. tool execution, confirm/select dialogs)
 */
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

// Show notifications as banner when app is in foreground (iOS/Android only)
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}
import * as Device from "expo-device";
import { triggerHaptic } from "../design-system";

const AGENT_CHANNEL_ID = "agent-events";

let permissionsEnsured = false;

/** Ensure notification permissions and Android channel. Call once on app init. */
export async function ensureNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  if (permissionsEnsured) return true;

  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync(AGENT_CHANNEL_ID, {
        name: "Agent Events",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        enableVibrate: true,
      });
    }

    if (!Device.isDevice) return false;

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    permissionsEnsured = finalStatus === "granted";
    return permissionsEnsured;
  } catch {
    return false;
  }
}

/** Schedule an immediate local notification. */
async function scheduleNotification(title: string, body: string): Promise<void> {
  if (Platform.OS === "web") return;
  const granted = await ensureNotificationPermissions();
  if (!granted) return;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: {},
        channelId: Platform.OS === "android" ? AGENT_CHANNEL_ID : undefined,
      },
      trigger: null,
    });
  } catch (e) {
    console.warn("[agentNotifications] Failed to schedule:", e);
  }
}

/**
 * Notify when the agent has finished its final response.
 * Triggers haptic (foreground) and local notification (works when app backgrounded).
 */
export async function notifyAgentFinished(): Promise<void> {
  triggerHaptic("success");
  await scheduleNotification(
    "Agent finished",
    "The AI agent has completed its response."
  );
}

/**
 * Notify when the agent needs user approval (human-in-the-loop).
 * Triggers haptic (foreground) and local notification.
 */
export async function notifyApprovalNeeded(title?: string): Promise<void> {
  triggerHaptic("warning");
  await scheduleNotification(
    "Approval needed",
    title ?? "The AI agent is waiting for your approval to continue."
  );
}
