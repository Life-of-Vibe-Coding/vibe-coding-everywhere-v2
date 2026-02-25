import React, { useCallback, useState } from "react";
import { StyleSheet, Platform } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Box } from "@/components/ui/box";
import { KeyboardAvoidingView } from "@/components/ui/keyboard-avoiding-view";
import type { ChatPageContext, ChatPageConversation, ChatPageFileViewer, ChatPageHeader, ChatPageInputDock, ChatPageRuntime, ChatPageSidebar } from "@/components/pages/ChatPage";
import { ChatConversationSection, ChatHeaderSection, ChatInputDockSection } from "@/components/pages/ChatPageSections";
import type { ChatModalOpenHandlers } from "@/components/types/chatModalTypes";
import { LinearGradient } from "expo-linear-gradient";

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
  const shouldShowInputDock = inputDock.visible && !modalHandlers.isAnyModalOpen;

  const handleInputDockLayout = useCallback((height: number) => {
    setInputDockHeight(height);
  }, []);

  return (
    <Box className="flex-1 bg-white">
      <LinearGradient
        colors={['#5A6978', '#D3B1C2', '#C6B5CD', '#E8E3FA']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={{ flex: 1 }} edges={["left", "right", "bottom"]}>
        <StatusBar style="dark" />
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
        >
          <Box className="flex-1 flex-col px-6 pt-2" style={{ paddingTop: insets.top }}>
            <Box style={context.styles.providerTintOverlay} pointerEvents="none" />
            <Box className="relative flex-1 min-h-0" style={{ overflow: Platform.OS === "ios" ? "visible" : "hidden" }}>
              <Box className="flex-1 min-h-0" style={{ overflow: Platform.OS === "ios" ? "visible" : "hidden" }}>
                <ChatHeaderSection
                  theme={context.theme}
                  workspaceName={header.workspaceName}
                  sessionIdLabel={header.sessionIdLabel}
                  sessionRunning={runtime.sessionRunning}
                  waitingForUserInput={runtime.waitingForUserInput}
                  onOpenExplorer={header.onOpenExplorer}
                  onOpenSessionManagement={modalHandlers.onOpenSessionManagement}
                  sidebarVisible={header.sidebarVisible || modalHandlers.isAnyModalOpen}
                />
                <ChatConversationSection
                  conversation={conversation}
                  fileViewer={fileViewer}
                  sidebar={sidebar}
                  inputDockHeight={shouldShowInputDock ? inputDockHeight : 0}
                />
              </Box>
              <ChatInputDockSection
                runtime={runtime}
                context={context}
                input={{ ...inputDock, visible: shouldShowInputDock }}
                onOpenSkillsConfig={modalHandlers.onOpenSkillsConfig}
                onOpenProcesses={modalHandlers.onOpenProcesses}
                onOpenDocker={modalHandlers.onOpenDocker}
                onOpenModelPicker={modalHandlers.onOpenModelPicker}
                onInputDockLayout={handleInputDockLayout}
              />
            </Box>
          </Box>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Box>
  );
}
