import "@/../global.css";

import React, { useMemo } from "react";

import { getDefaultServerConfig } from "@/core";
import { ThemeProvider } from "@/theme/index";
import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";

import { ChatPage } from "@/components/pages/ChatPage";
import { ChatActionController } from "@/components/controllers/ChatActionController";
import { SseSessionController } from "@/components/controllers/SseSessionController";
import { useSessionSideEffects } from "@/components/controllers/SessionSideEffectManager";
import { ThemeSessionState } from "@/components/controllers/ThemeSessionState";
import { WorkspaceFileController } from "@/components/controllers/WorkspaceFileController";
import { buildChatPageProps } from "@/components/pages/buildChatPageProps";
import { useSidebarState } from "@/components/hooks/useSidebarState";

export default function App() {
  const serverConfig = useMemo(() => getDefaultServerConfig(), []);
  const sidebarState = useSidebarState();

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
                  switchToLiveSession={sseState.switchToLiveSession}
                  setSelectedSseSessionRunning={sseState.setSelectedSseSessionRunning}
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
                      workspaceState,
                      chatActionState,
                      sidebarVisible: sidebarState.sidebarVisible,
                      sidebarActiveTab: sidebarState.sidebarActiveTab,
                      setSidebarActiveTab: sidebarState.setSidebarActiveTab,
                      openSidebar: sidebarState.openSidebar,
                      closeSidebar: sidebarState.closeSidebar,
                      onWorkspaceSelectedFromPicker: (path?: string) => {
                        sseState.setSelectedSseSessionRunning(false);
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
                          <ChatPage {...chatPageProps} />
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
