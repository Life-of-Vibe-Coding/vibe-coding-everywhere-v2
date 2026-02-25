import "./global.css";

import React, { useMemo } from "react";

import { getDefaultServerConfig } from "@/core";
import { ThemeProvider } from "@/theme/index";
import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";
import { ImageBackground, StyleSheet, View } from "react-native";

import { ChatPage } from "@/components/pages/ChatPage";
import { ChatActionController } from "@/components/controllers/ChatActionController";
import { SseSessionController } from "@/components/controllers/SseSessionController";
import { useSessionSideEffects } from "@/components/controllers/SessionSideEffectManager";
import { ThemeSessionState } from "@/components/controllers/ThemeSessionState";
import { WorkspaceFileController } from "@/components/controllers/WorkspaceFileController";
import { buildChatPageProps } from "@/components/pages/buildChatPageProps";
import { useSidebarState } from "@/components/hooks/useSidebarState";
import { useSessionManagementStore } from "@/state/sessionManagementStore";

export default function App() {
  const serverConfig = useMemo(() => getDefaultServerConfig(), []);
  const sidebarState = useSidebarState();
  const storeSessionStatuses = useSessionManagementStore((state) => state.sessionStatuses);
  const storeSessionId = useSessionManagementStore((state) => state.sessionId);
  const sessionRunningFromStore = useMemo(
    () => storeSessionStatuses.some((session) => session.id === storeSessionId && session.status === "running"),
    [storeSessionStatuses, storeSessionId]
  );

  return (
    <ThemeSessionState>
      {(themeState) => (
        <WorkspaceFileController
          serverConfig={serverConfig}
        >
          {(workspaceState) => (
            <SseSessionController
              provider={themeState.provider}
              model={themeState.model}
              serverConfig={serverConfig}
              setProvider={themeState.setProvider}
              setModel={themeState.setModel}
              switchWorkspaceForSession={workspaceState.switchWorkspaceForSession}
            >
              {(sseState) => (
                <ChatActionController
                  provider={themeState.provider}
                  permissionModeUI={themeState.permissionModeUI}
                  sessionId={sseState.sessionId}
                  messages={sseState.messages}
                  submitPrompt={sseState.submitPrompt}
                  submitAskQuestionAnswer={sseState.submitAskQuestionAnswer}
                  dismissAskQuestion={sseState.dismissAskQuestion}
                  retryAfterPermission={sseState.retryAfterPermission}
                  closeFileViewer={workspaceState.onCloseFileViewer}
                  resetSession={sseState.resetSession}
                  onSubmitSideEffects={() => {
                    sidebarState.closeSidebar();
                    workspaceState.onCloseFileViewer();
                  }}
                >
                  {(chatActionState) => {
                    const chatPageProps = buildChatPageProps({
                      themeState,
                      sseState,
                      sessionRunningFromStore,
                      workspaceState,
                      chatActionState,
                      sidebarVisible: sidebarState.sidebarVisible,
                      sidebarActiveTab: sidebarState.sidebarActiveTab,
                      setSidebarActiveTab: sidebarState.setSidebarActiveTab,
                      openSidebar: sidebarState.openSidebar,
                      closeSidebar: sidebarState.closeSidebar,
                      onWorkspaceSelectedFromPicker: (path?: string) => {
                        sseState.resetSession();
                        workspaceState.onWorkspaceSelectedFromPicker(path);
                      },
                      serverConfig,
                    });

                    useSessionSideEffects({
                      serverConfig,
                      sseState,
                      themeState,
                      workspacePath: workspaceState.workspacePath,
                    });

                    return (
                      <ThemeProvider provider={themeState.provider} colorMode={themeState.themeMode}>
                        <GluestackUIProvider mode={themeState.themeMode}>
                          <View style={{ flex: 1 }}>
                            <ImageBackground
                              source={require("./assets/chat-bg.png")}
                              style={StyleSheet.absoluteFill}
                              resizeMode="cover"
                            >
                              <View
                                style={[
                                  StyleSheet.absoluteFill,
                                  {
                                    backgroundColor: "rgba(0, 0, 0, 0)",
                                  },
                                ]}
                              />
                            </ImageBackground>
                            <ChatPage {...chatPageProps} />
                          </View>
                        </GluestackUIProvider>
                      </ThemeProvider>
                    );
                  }}
                </ChatActionController>
              )}
            </SseSessionController>
          )}
        </WorkspaceFileController>
      )}
    </ThemeSessionState>
  );
}
