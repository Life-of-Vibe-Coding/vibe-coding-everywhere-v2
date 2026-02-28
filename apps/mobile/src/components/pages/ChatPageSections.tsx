import React from "react";
import { type LayoutChangeEvent, ActivityIndicator } from "react-native";
import { AppHeaderBar } from "@/components/components/AppHeaderBar";
import { ChatInputDock } from "@/components/components/ChatInputDock";
import { ChatMessageList } from "@/components/components/ChatMessageList";
import { Box } from "@/components/ui/box";
import type { ChatPageContext, ChatPageConversation, ChatPageFileViewer, ChatPageInputDock, ChatPageRuntime, ChatPageSidebar } from "@/components/pages/ChatPage";
import type { getTheme } from "@/theme/index";

export type ChatHeaderSectionProps = {
  theme: ReturnType<typeof getTheme>;
  onOpenExplorer: () => void;
  onOpenSessionManagement: () => void;
  sidebarVisible: boolean;
};

export function ChatHeaderSection({
  theme,
  onOpenExplorer,
  onOpenSessionManagement,
  sidebarVisible,
}: ChatHeaderSectionProps) {
  return (
    <AppHeaderBar
      visible={!sidebarVisible}
      iconColor={theme.colors.textPrimary}
      onOpenExplorer={onOpenExplorer}
      onOpenSessionManagement={onOpenSessionManagement}
    />
  );
}

export type ChatConversationSectionProps = {
  conversation: ChatPageConversation;
  inputDockHeight: number;
  isHidden?: boolean;
};

function ChatSectionFrame({ children }: { children: React.ReactNode }) {
  return <Box className="flex-1 mt-0">{children}</Box>;
}

export function ChatConversationSection({ conversation, inputDockHeight, isHidden }: ChatConversationSectionProps) {
  return (
    <ChatSectionFrame>
      {!isHidden && (
        <Box className="flex-1 min-h-0 relative">
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
            scrollViewRef={conversation.scrollViewRef}
            onContentSizeChange={conversation.onContentSizeChange}
            style={{ flex: 1, minHeight: 0, opacity: conversation.isSessionLoading ? 0 : 1 }}
            contentContainerStyle={[{ paddingHorizontal: 12 }, { paddingBottom: inputDockHeight + 36 }]}
          />
          {conversation.isSessionLoading && (
            <Box className="absolute inset-0 items-center justify-center pointer-events-none" style={{ backgroundColor: "transparent" }}>
              <ActivityIndicator size="large" />
            </Box>
          )}
        </Box>
      )}
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
        serverBaseUrl={input.serverBaseUrl}
      />
    </Box>
  );
}
