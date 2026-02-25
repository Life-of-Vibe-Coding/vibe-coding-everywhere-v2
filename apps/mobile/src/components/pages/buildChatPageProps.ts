import { basename } from "../../utils/path";
import type { IServerConfig } from "../../core/types";
import type { ChatPageProps } from "./ChatPage";
import type { ChatActionControllerState } from "../controllers/ChatActionController";
import type { ThemeSessionStateState } from "../controllers/ThemeSessionState";
import type { SseSessionControllerState } from "../controllers/SseSessionController";
import type { WorkspaceFileControllerState } from "../controllers/WorkspaceFileController";
import type { SidebarTab } from "../hooks/useSidebarState";

export type BuildChatPagePropsInput = {
  themeState: ThemeSessionStateState;
  sseState: SseSessionControllerState;
  workspaceState: WorkspaceFileControllerState;
  chatActionState: ChatActionControllerState;
  sidebarVisible: boolean;
  sidebarActiveTab: SidebarTab;
  setSidebarActiveTab: (tab: SidebarTab) => void;
  openSidebar: () => void;
  closeSidebar: () => void;
  onWorkspaceSelectedFromPicker: (path?: string) => void;
  serverConfig: Pick<IServerConfig, "getBaseUrl" | "resolvePreviewUrl">;
};

export function buildChatPageProps({
  themeState,
  sseState,
  workspaceState,
  chatActionState,
  sidebarVisible,
  sidebarActiveTab,
  setSidebarActiveTab,
  openSidebar,
  closeSidebar,
  onWorkspaceSelectedFromPicker,
  serverConfig,
}: BuildChatPagePropsInput): ChatPageProps {
  const currentSessionLabel = (sseState.sessionId ?? "").split("-")[0] || "—";

  return {
    context: {
      theme: themeState.theme,
      themeMode: themeState.themeMode,
      styles: themeState.styles,
      provider: themeState.provider,
      model: themeState.model,
      modelOptions: themeState.modelOptions,
      providerModelOptions: themeState.providerModelOptions,
      permissionModeUI: themeState.permissionModeUI,
    },
    runtime: {
      connected: sseState.connected,
      typingIndicator: sseState.typingIndicator,
      permissionDenials: sseState.permissionDenials ?? [],
      lastSessionTerminated: sseState.lastSessionTerminated,
      tailBoxMaxHeight: sseState.tailBoxMaxHeight,
      agentRunning: sseState.agentRunning,
      waitingForUserInput: sseState.waitingForUserInput,
    },
    header: {
      workspaceName: workspaceState.workspacePath ? basename(workspaceState.workspacePath) : "—",
      sessionIdLabel: currentSessionLabel,
      onOpenExplorer: openSidebar,
      sidebarVisible,
    },
    conversation: {
      messages: sseState.messages,
      provider: themeState.provider,
      typingIndicator: sseState.typingIndicator,
      currentActivity: sseState.currentActivity,
      permissionDenials: sseState.permissionDenials ?? [],
      lastSessionTerminated: sseState.lastSessionTerminated,
      tailBoxMaxHeight: sseState.tailBoxMaxHeight,
      flatListRef: sseState.flatListRef,
      onContentSizeChange: sseState.onContentSizeChange,
      onOpenUrl: chatActionState.onOpenPreviewInApp,
      onFileSelect: (path: string) => {
        openSidebar();
        workspaceState.onFileSelectFromChat(path);
      },
      onRetryPermission: chatActionState.onRetryPermission,
      onDismissPermission: sseState.dismissPermission,
    },
    fileViewer: {
      selectedFilePath: workspaceState.selectedFilePath,
      fileContent: workspaceState.fileContent,
      fileIsImage: workspaceState.fileIsImage,
      fileLoading: workspaceState.fileLoading,
      fileError: workspaceState.fileError,
      onCloseFileViewer: workspaceState.onCloseFileViewer,
      onAddCodeReference: chatActionState.onAddCodeReference,
    },
    sidebar: {
      visible: sidebarVisible,
      activeTab: sidebarActiveTab,
      onCloseSidebar: closeSidebar,
      onFileSelectFromSidebar: workspaceState.onFileSelectFromSidebar,
      onCommitByAI: chatActionState.onCommitByAI,
      onSidebarTabChange: setSidebarActiveTab,
    },
    inputDock: {
      visible: !sidebarVisible || sidebarActiveTab === "files",
      pendingCodeRefs: chatActionState.pendingCodeRefs,
      onSubmitPrompt: chatActionState.onSubmitPrompt,
      onRemoveCodeRef: chatActionState.onRemoveCodeRef,
      onTerminateAgent: sseState.terminateAgent,
      onOpenWebPreview: chatActionState.onOpenWebPreview,
      onProviderChange: sseState.handleProviderChange,
      onModelChange: sseState.handleModelChange,
    },
    modals: {
      askQuestion: {
        pendingAskQuestion: sseState.pendingAskQuestion,
        onSubmitAskQuestion: chatActionState.onAskQuestionSubmit,
        onCancelAskQuestion: chatActionState.onAskQuestionCancel,
      },
      skills: {
        serverBaseUrl: serverConfig.getBaseUrl(),
      },
      workspacePicker: {
        workspacePath: workspaceState.workspacePath,
        onRefreshWorkspace: workspaceState.fetchWorkspacePath,
        onWorkspaceSelected: onWorkspaceSelectedFromPicker,
      },
      docker: {
        serverBaseUrl: serverConfig.getBaseUrl(),
      },
      modelPicker: {
        currentServerUrl: serverConfig.getBaseUrl(),
        surfaceColor: themeState.theme.colors.surface,
        onModelProviderChange: sseState.handleProviderChange,
        onModelChange: sseState.handleModelChange,
      },
      processes: {
        serverBaseUrl: serverConfig.getBaseUrl(),
      },
      sessionManagement: {
        onRefreshSessionManagementWorkspace: workspaceState.fetchWorkspacePath,
        workspacePathForSessionManagement: workspaceState.workspacePath,
        onSelectSession: sseState.handleSelectSession,
        onNewSession: sseState.handleNewSession,
        currentSessionId: sseState.sessionId,
        workspaceLoading: workspaceState.workspacePathLoading,
        sessionRunning: sseState.agentRunning || sseState.typingIndicator,
        onSelectActiveChat: sseState.handleSelectActiveChat,
        currentMessages: sseState.messages,
        showActiveChat: false,
      },
      preview: {
        previewVisible: chatActionState.previewUrl != null,
        previewUrl: chatActionState.previewUrl ?? "",
        onClosePreview: chatActionState.onClosePreview,
        resolvePreviewUrl: serverConfig.resolvePreviewUrl,
      },
    },
  };
}
