import React from "react";
import { View } from "react-native";
import { AppHeaderBar } from "../components/AppHeaderBar";
import { ChatInputDock } from "../components/ChatInputDock";
import { ChatMessageList } from "../components/ChatMessageList";
import { FileViewerOverlay } from "../components/FileViewerOverlay";
import { WorkspaceSidebarOverlay } from "../components/WorkspaceSidebarOverlay";
import { Box } from "../ui/box";
import type { ChatPageContext, ChatPageConversation, ChatPageFileViewer, ChatPageInputDock, ChatPageRuntime, ChatPageSidebar } from "./ChatPage";
import type { createAppStyles } from "../styles/appStyles";
import type { getTheme } from "../../theme/index";

export type ChatHeaderSectionProps = {
  theme: ReturnType<typeof getTheme>;
  styles: ReturnType<typeof createAppStyles>;
  workspaceName: string;
  sessionIdLabel: string;
  typingIndicator: boolean;
  agentRunning: boolean;
  waitingForUserInput: boolean;
  onOpenExplorer: () => void;
  onOpenSessionManagement: () => void;
  sidebarVisible: boolean;
};

export function ChatHeaderSection({
  theme,
  styles,
  workspaceName,
  sessionIdLabel,
  typingIndicator,
  agentRunning,
  waitingForUserInput,
  onOpenExplorer,
  onOpenSessionManagement,
  sidebarVisible,
}: ChatHeaderSectionProps) {
  return (
    <AppHeaderBar
      visible={!sidebarVisible}
      theme={theme}
      styles={{
        menuButtonOverlay: styles.menuButtonOverlay,
        sessionIdCenter: styles.sessionIdCenter,
        headerStatusStack: styles.headerStatusStack,
        headerStatusRow: styles.headerStatusRow,
        runningDot: styles.runningDot,
      }}
      workspaceName={workspaceName}
      typingIndicator={typingIndicator}
      agentRunning={agentRunning}
      waitingForUserInput={waitingForUserInput}
      sessionIdLabel={sessionIdLabel}
      onOpenExplorer={onOpenExplorer}
      onOpenSessionManagement={onOpenSessionManagement}
    />
  );
}

export type ChatConversationSectionProps = {
  styles: ReturnType<typeof createAppStyles>;
  conversation: ChatPageConversation;
  fileViewer: ChatPageFileViewer;
  sidebar: ChatPageSidebar;
};

export function ChatConversationSection({ styles, conversation, fileViewer, sidebar }: ChatConversationSectionProps) {
  return (
    <Box style={styles.chatShell}>
      <ChatMessageList
        messages={conversation.messages}
        provider={conversation.provider}
        typingIndicator={conversation.typingIndicator}
        currentActivity={conversation.currentActivity}
        permissionDenials={conversation.permissionDenials}
        lastSessionTerminated={conversation.lastSessionTerminated}
        onOpenUrl={conversation.onOpenUrl}
        onFileSelect={conversation.onFileSelect}
        onRetryPermission={conversation.onRetryPermission}
        onDismissPermission={conversation.onDismissPermission}
        tailBoxMaxHeight={conversation.tailBoxMaxHeight}
        flatListRef={conversation.flatListRef}
        onContentSizeChange={conversation.onContentSizeChange}
        style={styles.chatArea}
        contentContainerStyle={styles.chatMessages}
      />

      <FileViewerOverlay
        visible={fileViewer.selectedFilePath != null}
        style={styles.fileViewerOverlay}
        path={fileViewer.selectedFilePath ?? ""}
        content={fileViewer.fileContent}
        isImage={fileViewer.fileIsImage}
        loading={fileViewer.fileLoading}
        error={fileViewer.fileError}
        onClose={fileViewer.onCloseFileViewer}
        onAddCodeReference={fileViewer.onAddCodeReference}
      />

      <WorkspaceSidebarOverlay
        visible={sidebar.visible}
        style={styles.sidebarOverlay}
        pointerEvents={sidebar.visible ? "auto" : "none"}
        onClose={sidebar.onCloseSidebar}
        onFileSelect={sidebar.onFileSelectFromSidebar}
        onCommitByAI={sidebar.onCommitByAI}
        onActiveTabChange={sidebar.onSidebarTabChange}
        sidebarActiveTab={sidebar.activeTab}
      />
    </Box>
  );
}

export type ChatInputDockSectionProps = {
  styles: ReturnType<typeof createAppStyles>;
  runtime: ChatPageRuntime;
  context: ChatPageContext;
  input: ChatPageInputDock;
  onOpenSkillsConfig: () => void;
  onOpenProcesses: () => void;
  onOpenDocker: () => void;
  onOpenModelPicker: () => void;
};

export function ChatInputDockSection({
  styles,
  runtime,
  context,
  input,
  onOpenSkillsConfig,
  onOpenProcesses,
  onOpenDocker,
  onOpenModelPicker,
}: ChatInputDockSectionProps) {
  if (!input.visible) {
    return null;
  }

  return (
    <View style={styles.inputBar}>
      <ChatInputDock
        connected={runtime.connected}
        agentRunning={runtime.agentRunning}
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
    </View>
  );
}
