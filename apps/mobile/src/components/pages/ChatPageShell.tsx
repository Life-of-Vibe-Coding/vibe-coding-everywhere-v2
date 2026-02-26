import React, { useCallback, useState } from "react";
import { StyleSheet, Platform, ImageBackground } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Box } from "@/components/ui/box";
import { KeyboardAvoidingView } from "@/components/ui/keyboard-avoiding-view";
import type { ChatPageContext, ChatPageConversation, ChatPageFileViewer, ChatPageHeader, ChatPageInputDock, ChatPageRuntime, ChatPageSidebar } from "@/components/pages/ChatPage";
import { ChatConversationSection, ChatHeaderSection, ChatInputDockSection } from "@/components/pages/ChatPageSections";
import type { ChatModalOpenHandlers } from "@/components/types/chatModalTypes";
import { layoutOuterStyle } from "@/components/styles/appStyles";

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
  const isAnyOverlayOpen = modalHandlers.isAnyModalOpen || sidebar.visible || fileViewer.selectedFilePath != null;
  const shouldShowInputDock = inputDock.visible && !isAnyOverlayOpen;

  const handleInputDockLayout = useCallback((height: number) => {
    setInputDockHeight(height);
  }, []);

  const isDark = context.theme.mode === "dark";

  return (
    <Box className="flex-1" style={layoutOuterStyle}>
      <SafeAreaView style={{ flex: 1 }} edges={["left", "right", "bottom"]}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
        >
          <Box className="flex-1 flex-col px-6 pt-0" style={{ paddingTop: insets.top }}>
            <Box className="relative flex-1 min-h-0" style={{ overflow: Platform.OS === "ios" ? "visible" : "hidden" }}>
              <Box className="flex-1 min-h-0" style={{ overflow: Platform.OS === "ios" ? "visible" : "hidden" }}>
                {!isAnyOverlayOpen && (
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
                )}
                <ChatConversationSection
                  conversation={conversation}
                  fileViewer={fileViewer}
                  sidebar={sidebar}
                  inputDockHeight={shouldShowInputDock ? inputDockHeight : 0}
                  isHidden={isAnyOverlayOpen}
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
