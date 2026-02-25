import React from "react";

import { AskQuestionModal } from "@/components/chat/AskQuestionModal";
import { SkillConfigurationView } from "@/components/settings/SkillConfigurationView";
import { WorkspacePickerModal } from "@/components/settings/WorkspacePickerModal";
import { DockerManagerModal } from "@/components/docker/DockerManagerModal";
import { ProcessDashboardModal } from "@/components/processes/ProcessDashboardModal";
import { SessionManagementModal } from "@/components/chat/SessionManagementModal";
import { PreviewWebViewModal } from "@/components/preview/PreviewWebViewModal";
import { ModelPickerSheet } from "@/components/components/ModelPickerSheet";
import { Box } from "@/components/ui/box";
import type { ChatPageContext, ChatPageModals } from "@/components/pages/ChatPage";
import type { ChatModalOpenHandlers } from "@/components/types/chatModalTypes";
import { useChatModalsController } from "@/components/hooks/useChatModalsController";

type ChatModalsSectionProps = {
  context: ChatPageContext;
  modals: ChatPageModals;
  onSelectActiveChat: () => void;
  children: (open: ChatModalOpenHandlers) => React.ReactNode;
};

export function ChatModalsSection({
  context,
  modals,
  onSelectActiveChat,
  children,
}: ChatModalsSectionProps) {
  const {
    openHandlers,
    modalStates,
    selectedSkillId,
    handleSessionSelect,
    handleNewSession,
    handleSelectActiveChat,
    handleWorkspacePickerFromSession,
    handleWorkspaceSelected,
    handleModelChange,
    handleSelectSkill,
    closeSkillsConfig,
    closeSkillDetail,
    handleModelProviderChange,
  } = useChatModalsController({
    onRefreshSessionManagementWorkspace: modals.sessionManagement.onRefreshSessionManagementWorkspace,
    onSessionManagementSelect: modals.sessionManagement.onSelectSession,
    onSessionManagementNewSession: modals.sessionManagement.onNewSession,
    onSessionManagementActiveChat: onSelectActiveChat,
    onWorkspaceSelected: modals.workspacePicker.onWorkspaceSelected,
    onModelProviderChange: modals.modelPicker.onModelProviderChange,
    onModelChange: modals.modelPicker.onModelChange,
  });
  const isAnyModalOpen =
    openHandlers.isAnyModalOpen ||
    modals.askQuestion.pendingAskQuestion != null ||
    modals.preview.previewVisible;
  const isSkillsConfigOpen = modalStates.skillsConfig.isOpen;

  return (
    <>
      {isSkillsConfigOpen ? (
        <Box className="flex-1">
          <SkillConfigurationView
            isOpen
            presentation="inline"
            onClose={closeSkillsConfig}
            onSelectSkill={handleSelectSkill}
            selectedSkillId={selectedSkillId}
            onCloseSkillDetail={closeSkillDetail}
            serverBaseUrl={modals.skills.serverBaseUrl}
          />
        </Box>
      ) : (
        children({ ...openHandlers, isAnyModalOpen })
      )}
      <WorkspacePickerModal
        isOpen={modalStates.workspacePicker.isOpen}
        onClose={modalStates.workspacePicker.close}
        serverBaseUrl={modals.modelPicker.currentServerUrl}
        workspacePath={modals.workspacePicker.workspacePath}
        onRefreshWorkspace={modals.workspacePicker.onRefreshWorkspace}
        onWorkspaceSelected={handleWorkspaceSelected}
      />
      <SessionManagementModal
        isOpen={modalStates.sessionManagement.isOpen}
        onClose={modalStates.sessionManagement.close}
        currentSessionId={modals.sessionManagement.currentSessionId}
        workspacePath={modals.sessionManagement.workspacePathForSessionManagement}
        serverBaseUrl={modals.sessionManagement.serverBaseUrl}
        workspaceLoading={modals.sessionManagement.workspaceLoading}
        onOpenWorkspacePicker={handleWorkspacePickerFromSession}
        onSelectSession={handleSessionSelect}
        onNewSession={handleNewSession}
        showActiveChat={modals.sessionManagement.showActiveChat}
        sessionRunning={modals.sessionManagement.sessionRunning}
        onSelectActiveChat={handleSelectActiveChat}
      />
      <ProcessDashboardModal isOpen={modalStates.processes.isOpen} onClose={modalStates.processes.close} serverBaseUrl={modals.processes.serverBaseUrl} />
      <DockerManagerModal isOpen={modalStates.docker.isOpen} onClose={modalStates.docker.close} serverBaseUrl={modals.docker.serverBaseUrl} />
      <ModelPickerSheet
        isOpen={modalStates.modelPicker.isOpen}
        onClose={modalStates.modelPicker.close}
        provider={context.provider}
        model={context.model}
        themeMode={context.themeMode}
        surfaceColor={modals.modelPicker.surfaceColor}
        providerModelOptions={context.providerModelOptions}
        onProviderChange={handleModelProviderChange}
        onModelChange={handleModelChange}
      />
      <AskQuestionModal
        pending={modals.askQuestion.pendingAskQuestion}
        onSubmit={modals.askQuestion.onSubmitAskQuestion}
        onCancel={modals.askQuestion.onCancelAskQuestion}
      />
      <PreviewWebViewModal
        isOpen={modals.preview.previewVisible}
        url={modals.preview.previewUrl}
        title="Preview"
        onClose={modals.preview.onClosePreview}
        resolvePreviewUrl={modals.preview.resolvePreviewUrl}
      />
    </>
  );
}
