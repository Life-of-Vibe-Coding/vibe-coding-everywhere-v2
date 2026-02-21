import type { Provider as BrandProvider } from "../theme/index";

export type PermissionModeUI = "always_ask" | "ask_once_per_session" | "yolo";

export type BackendPermissionResult = {
  permissionMode?: string;
  approvalMode?: string;
  askForApproval?: string;
  fullAuto?: boolean;
  yolo?: boolean;
};

/**
 * Maps UI permission mode to backend-specific config for each provider.
 */
export function getBackendPermissionMode(
  ui: PermissionModeUI,
  provider: BrandProvider
): BackendPermissionResult {
  if (provider === "pi" || provider === "codex") {
    if (ui === "yolo") return { yolo: true };
    if (ui === "always_ask") return { askForApproval: "untrusted" };
    return { askForApproval: "on-request" };
  }
  if (ui === "yolo") {
    return provider === "claude"
      ? { permissionMode: "bypassPermissions" }
      : { approvalMode: "auto_edit" };
  }
  if (ui === "always_ask") {
    return provider === "claude"
      ? { permissionMode: "acceptEdits" }
      : { approvalMode: "plan" };
  }
  // ask_once_per_session: Claude "default" = prompts on first use of each tool per session
  return provider === "claude"
    ? { permissionMode: "default" }
    : { approvalMode: "default" };
}
