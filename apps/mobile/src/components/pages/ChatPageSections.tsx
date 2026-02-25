import React from "react";
import type { LayoutChangeEvent } from "react-native";
import { View } from "react-native";
import { AppHeaderBar } from "@/components/components/AppHeaderBar";
import { ChatInputDock } from "@/components/components/ChatInputDock";
import { ChatMessageList } from "@/components/components/ChatMessageList";
import { FileViewerPage } from "@/components/pages/FileViewerPage";
import { WorkspaceSidebarPage } from "@/components/pages/WorkspaceSidebarPage";
import { Box } from "@/components/ui/box";
import type { ChatPageContext, ChatPageConversation, ChatPageFileViewer, ChatPageInputDock, ChatPageRuntime, ChatPageSidebar } from "@/components/pages/ChatPage";
import type { createAppStyles } from "@/components/styles/appStyles";
import type { getTheme } from "@/theme/index";

export type ChatHeaderSectionProps = {
  theme: ReturnType<typeof getTheme>;
  styles: ReturnType<typeof createAppStyles>;
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
  styles,
  workspaceName,
  sessionIdLabel,
  sessionRunning,
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
      }}
      workspaceName={workspaceName}
      sessionRunning={sessionRunning}
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
  inputDockHeight: number;
};

export function ChatConversationSection({ styles, conversation, fileViewer, sidebar, inputDockHeight }: ChatConversationSectionProps) {
  return (
    <Box style={[styles.chatShell, {  }]}>
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
        style={styles.chatArea}
        contentContainerStyle={styles.chatMessages}
      />

      <FileViewerPage
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

      <WorkspaceSidebarPage
        visible={sidebar.visible}
        style={styles.sidebarOverlay}
        pointerEvents={sidebar.visible ? "auto" : "none"}
        onClose={sidebar.onCloseSidebar}
        onFileSelect={sidebar.onFileSelectFromSidebar}
        onCommitByAI={sidebar.onCommitByAI}
        onActiveTabChange={sidebar.onSidebarTabChange}
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
  onInputDockLayout: (height: number) => void;
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
  onInputDockLayout,
}: ChatInputDockSectionProps) {
  if (!input.visible) {
    return null;
  }

  return (
    <View
      style={styles.inputBar}
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
    </View>
  );
}
