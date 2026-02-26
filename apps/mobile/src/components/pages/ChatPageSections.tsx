import React from "react";
import { type LayoutChangeEvent } from "react-native";
import { AppHeaderBar } from "@/components/components/AppHeaderBar";
import { ChatInputDock } from "@/components/components/ChatInputDock";
import { ChatMessageList } from "@/components/components/ChatMessageList";
import { FileViewerPage } from "@/components/pages/FileViewerPage";
import { WorkspaceSidebarPage } from "@/components/pages/WorkspaceSidebarPage";
import { Box } from "@/components/ui/box";
import type { ChatPageContext, ChatPageConversation, ChatPageFileViewer, ChatPageInputDock, ChatPageRuntime, ChatPageSidebar } from "@/components/pages/ChatPage";
import type { getTheme } from "@/theme/index";

export type ChatHeaderSectionProps = {
  theme: ReturnType<typeof getTheme>;
  workspaceName: string;
  sessionIdLabel: string;
  sessionRunning: boolean;
  waitingForUserInput: boolean;
  onOpenExplorer: () => void;
  onOpenSessionManagement: () => void;
  sidebarVisible: boolean;
};

export function ChatHeaderSection({
  theme,
  workspaceName,
  sessionIdLabel,
  sessionRunning,
  waitingForUserInput,
  onOpenExplorer,
  onOpenSessionManagement,
  sidebarVisible,
}: ChatHeaderSectionProps) {
  const hasRealSessionId = sessionIdLabel !== "—" && sessionIdLabel.toLowerCase() !== "temp";
  const statusColor = !hasRealSessionId
    ? theme.colors.accent
    : sessionRunning
      ? (waitingForUserInput ? theme.colors.warning : theme.colors.success)
      : theme.colors.info;
  const statusLabel = !hasRealSessionId
    ? "Start"
    : sessionRunning
      ? `Running: ${sessionIdLabel}`
      : `Idling: ${sessionIdLabel}`;

  return (
    <AppHeaderBar
      visible={!sidebarVisible}
      workspaceName={workspaceName}
      iconColor={theme.colors.textPrimary}
      workspaceColor={theme.colors.accent}
      statusColor={statusColor}
      statusLabel={statusLabel}
      onOpenExplorer={onOpenExplorer}
      onOpenSessionManagement={onOpenSessionManagement}
    />
  );
}

export type ChatConversationSectionProps = {
  conversation: ChatPageConversation;
  fileViewer: ChatPageFileViewer;
  sidebar: ChatPageSidebar;
  inputDockHeight: number;
  isHidden?: boolean;
};

const overlayStyles = {
  fileViewer: {
    position: "absolute" as const,
    top: 0,
    // Cancel ChatPageShell horizontal padding (`px-6`) so open file is edge-to-edge.
    left: -24,
    right: -24,
    bottom: 0,
    zIndex: 6,
  },
  sidebar: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    height: "100%" as const,
    zIndex: 5,
  },
} as const;

function ChatSectionFrame({ children }: { children: React.ReactNode }) {
  return <Box className="flex-1 mt-0">{children}</Box>;
}

function OverlayLayer({
  fileViewer,
  sidebar,
}: {
  fileViewer: ChatPageFileViewer;
  sidebar: ChatPageSidebar;
}) {
  return (
    <>
      <FileViewerPage
        isOpen={fileViewer.selectedFilePath != null}
        style={overlayStyles.fileViewer}
        path={fileViewer.selectedFilePath ?? ""}
        content={fileViewer.fileContent}
        isImage={fileViewer.fileIsImage}
        loading={fileViewer.fileLoading}
        error={fileViewer.fileError}
        onClose={fileViewer.onCloseFileViewer}
        onAddCodeReference={fileViewer.onAddCodeReference}
      />
      <WorkspaceSidebarPage
        isOpen={sidebar.visible}
        style={overlayStyles.sidebar}
        pointerEvents={sidebar.visible ? "auto" : "none"}
        onClose={sidebar.onCloseSidebar}
        onFileSelect={sidebar.onFileSelectFromSidebar}
        onCommitByAI={sidebar.onCommitByAI}
        onActiveTabChange={sidebar.onSidebarTabChange}
      />
    </>
  );
}

export function ChatConversationSection({ conversation, fileViewer, sidebar, inputDockHeight, isHidden }: ChatConversationSectionProps) {
  return (
    <ChatSectionFrame>
      {!isHidden && (
        <ChatMessageList
          messages={conversation.messages}
          provider={conversation.provider}
          sessionId={conversation.sessionId}
          permissionDenials={conversation.permissionDenials}
          lastSessionTerminated={conversation.lastSessionTerminated}
          onOpenUrl={conversation.onOpenUrl}
          onFileSelect={conversation.onFileSelect}
          onRetryPermission={conversation.onRetryPermission}
          onDismissPermission={conversation.onDismissPermission}
          tailBoxMaxHeight={conversation.tailBoxMaxHeight}
          flatListRef={conversation.flatListRef}
          onContentSizeChange={conversation.onContentSizeChange}
          style={{ flex: 1, minHeight: 0 }}
          contentContainerStyle={[{ paddingHorizontal: 12 }, { paddingBottom: inputDockHeight + 36 }]}
        />
      )}
      <OverlayLayer fileViewer={fileViewer} sidebar={sidebar} />
    </ChatSectionFrame>
  );
}

export type ChatInputDockSectionProps = {
  runtime: ChatPageRuntime;
  context: ChatPageContext;
  input: ChatPageInputDock;
  onOpenSkillsConfig: () => void;
  onOpenProcesses: () => void;
  onOpenDocker: () => void;
  onOpenModelPicker: () => void;
  onInputDockLayout: (height: number) => void;
};

export function ChatInputDockSection({
  runtime,
  context,
  input,
  onOpenSkillsConfig,
  onOpenProcesses,
  onOpenDocker,
  onOpenModelPicker,
  onInputDockLayout,
}: ChatInputDockSectionProps) {
  if (!input.visible) {
    return null;
  }

  return (
    <Box
      className="pb-2"
      onLayout={(event: LayoutChangeEvent) => {
        const height = event.nativeEvent.layout.height;
        onInputDockLayout(height);
      }}
    >
      <ChatInputDock
        connected={runtime.connected}
        sessionRunning={runtime.sessionRunning}
        waitingForUserInput={runtime.waitingForUserInput}
        permissionModeUI={context.permissionModeUI}
        onSubmit={input.onSubmitPrompt}
        pendingCodeRefs={input.pendingCodeRefs}
        onRemoveCodeRef={input.onRemoveCodeRef}
        onTerminateAgent={input.onTerminateAgent}
        onOpenProcesses={onOpenProcesses}
        onOpenWebPreview={input.onOpenWebPreview}
        provider={context.provider}
        model={context.model}
        modelOptions={context.modelOptions}
        providerModelOptions={context.providerModelOptions}
        onProviderChange={input.onProviderChange}
        onModelChange={input.onModelChange}
        onOpenModelPicker={onOpenModelPicker}
        onOpenSkillsConfig={onOpenSkillsConfig}
        onOpenDocker={onOpenDocker}
      />
    </Box>
  );
}
