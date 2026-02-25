import { getBackendPermissionMode, type PermissionModeUI } from "../../utils/permission";
import type { Provider as BrandProvider } from "../../theme/index";
import {
  DEFAULT_CLAUDE_MODEL,
  DEFAULT_CODEX_MODEL,
  DEFAULT_GEMINI_MODEL,
  CLAUDE_MODELS,
  GEMINI_MODELS,
  CODEX_MODELS,
} from "../../constants/modelOptions";
import type { Message } from "../../core";

export type ModalSessionItem = {
  id: string;
  provider?: string | null;
  model?: string | null;
  running?: boolean;
  sseConnected?: boolean;
  messages?: Message[];
  cwd?: string | null;
};

export const EMPTY_SESSION_CLEANUP_MS = 3 * 60 * 1000;
export const SESSION_CLEANUP_INTERVAL_MS = 60_000;
export const SESSION_STATUS_POLL_INTERVAL_MS = 3_000;
export const SESSION_STORE_PAYLOAD_THROTTLE_MS = 30_000;

export function getThemeModeForProvider(_provider: BrandProvider): "light" | "dark" {
  return "light";
}

export function getDefaultPermissionModeUI(): PermissionModeUI {
  return typeof process !== "undefined" &&
    (process.env?.EXPO_PUBLIC_DEFAULT_PERMISSION_MODE === "always_ask" ||
      process.env?.EXPO_PUBLIC_DEFAULT_PERMISSION_MODE === "acceptEdits" ||
      process.env?.EXPO_PUBLIC_DEFAULT_PERMISSION_MODE === "acceptPermissions")
    ? "always_ask"
    : "yolo";
}

export function getModelForProvider(provider: BrandProvider): string {
  return provider === "claude"
    ? DEFAULT_CLAUDE_MODEL
    : provider === "gemini"
      ? DEFAULT_GEMINI_MODEL
      : DEFAULT_CODEX_MODEL;
}

export function getModelOptionsForProvider(provider: BrandProvider) {
  return provider === "claude" ? CLAUDE_MODELS : provider === "codex" ? CODEX_MODELS : GEMINI_MODELS;
}

export function getSubmitPermissionConfig(permissionModeUI: PermissionModeUI, provider: BrandProvider) {
  const backend = getBackendPermissionMode(permissionModeUI, provider);
  const codexOptions =
    provider === "codex"
      ? {
          askForApproval: backend.askForApproval,
          fullAuto: backend.fullAuto,
          yolo: backend.yolo,
        }
      : undefined;

  return {
    backend,
    codexOptions,
  };
}
