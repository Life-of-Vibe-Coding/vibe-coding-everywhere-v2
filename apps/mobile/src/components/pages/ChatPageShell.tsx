import React, { useState } from "react";
import { KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Box } from "@/components/ui/box";
import type { ChatPageContext, ChatPageConversation, ChatPageFileViewer, ChatPageHeader, ChatPageInputDock, ChatPageRuntime, ChatPageSidebar } from "@/components/pages/ChatPage";
import { ChatConversationSection, ChatHeaderSection, ChatInputDockSection } from "@/components/pages/ChatPageSections";
import type { ChatModalOpenHandlers } from "@/components/types/chatModalTypes";

export type ChatPageShellProps = {
  context: ChatPageContext;
  runtime: ChatPageRuntime;
  header: ChatPageHeader;
  conversation: ChatPageConversation;
  fileViewer: ChatPageFileViewer;
  sidebar: ChatPageSidebar;
  inputDock: ChatPageInputDock;
  modalHandlers: ChatModalOpenHandlers;
};

export function ChatPageShell({
  context,
  runtime,
  header,
  conversation,
  fileViewer,
  sidebar,
  inputDock,
  modalHandlers,
}: ChatPageShellProps) {
  const insets = useSafeAreaInsets();
  const [inputDockHeight, setInputDockHeight] = useState(0);

  return (
    <SafeAreaView style={context.styles.safeArea} edges={["left", "right", "bottom"]}>
      <StatusBar style={context.theme.mode === "dark" ? "light" : "dark"} />
      <KeyboardAvoidingView
        style={context.styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <Box style={[context.styles.page, { paddingTop: insets.top }]}>
          <Box style={context.styles.providerTintOverlay} pointerEvents="none" />
            <Box style={context.styles.topSection}>
            <Box style={context.styles.contentArea}>
              <ChatHeaderSection
                theme={context.theme}
                styles={context.styles}
                workspaceName={header.workspaceName}
                sessionIdLabel={header.sessionIdLabel}
                typingIndicator={runtime.typingIndicator}
                agentRunning={runtime.agentRunning}
                waitingForUserInput={runtime.waitingForUserInput}
                onOpenExplorer={header.onOpenExplorer}
                onOpenSessionManagement={modalHandlers.onOpenSessionManagement}
                sidebarVisible={header.sidebarVisible}
              />
              <ChatConversationSection
                styles={context.styles}
                conversation={conversation}
                fileViewer={fileViewer}
                sidebar={sidebar}
                inputDockHeight={inputDock.visible ? inputDockHeight : 0}
              />
            </Box>
            <ChatInputDockSection
              styles={context.styles}
              runtime={runtime}
              context={context}
              input={inputDock}
              onOpenSkillsConfig={modalHandlers.onOpenSkillsConfig}
              onOpenProcesses={modalHandlers.onOpenProcesses}
              onOpenDocker={modalHandlers.onOpenDocker}
              onOpenModelPicker={modalHandlers.onOpenModelPicker}
              onInputDockLayout={(height) => setInputDockHeight(height)}
            />
          </Box>
        </Box>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
