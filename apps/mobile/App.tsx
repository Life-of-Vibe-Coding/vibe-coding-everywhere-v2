import "./global.css";

import React, { useCallback, useMemo } from "react";

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
import { useThemeAssets } from "@/hooks/useThemeAssets";

function AppBackground() {
  const assets = useThemeAssets();
  return (
    <ImageBackground
      source={assets.background}
      style={StyleSheet.absoluteFill}
      resizeMode="stretch"
    />
  );
}

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
              setModel={themeState.setModel}
              setProvider={themeState.setProvider}
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
                    const onChatFileSelect = useCallback((path: string) => {
                      sidebarState.openSidebar();
                      workspaceState.onFileSelectFromChat(path);
                    }, [sidebarState.openSidebar, workspaceState.onFileSelectFromChat]);

                    const onWorkspaceSelected = useCallback((path?: string) => {
                      sseState.resetSession();
                      workspaceState.onWorkspaceSelectedFromPicker(path);
                    }, [sseState.resetSession, workspaceState.onWorkspaceSelectedFromPicker]);

                    const chatPageProps = useMemo(
                      () =>
                        buildChatPageProps({
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
                          onChatFileSelect,
                          onWorkspaceSelectedFromPicker: onWorkspaceSelected,
                          serverConfig,
                        }),
                      [
                        themeState,
                        sseState,
                        sessionRunningFromStore,
                        workspaceState,
                        chatActionState,
                        sidebarState.sidebarVisible,
                        sidebarState.sidebarActiveTab,
                        sidebarState.setSidebarActiveTab,
                        sidebarState.openSidebar,
                        sidebarState.closeSidebar,
                        onChatFileSelect,
                        onWorkspaceSelected,
                        serverConfig,
                      ]
                    );

                    useSessionSideEffects({
                      serverConfig,
                      sseState,
                      themeState,
                      workspacePath: workspaceState.workspacePath,
                    });

                    return (
                      <ThemeProvider mode={themeState.themeMode}>
                        <GluestackUIProvider mode={themeState.themeMode}>
                          <View style={{ flex: 1 }}>
                            <AppBackground />
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
