import React from "react";

import type { Message } from "../../services/sse/hooks";
import { AskQuestionModal } from "../chat/AskQuestionModal";
import { SkillConfigurationModal } from "../settings/SkillConfigurationModal";
import { WorkspacePickerModal } from "../settings/WorkspacePickerModal";
import { DockerManagerModal } from "../docker/DockerManagerModal";
import { ProcessesDashboardModal } from "../processes/ProcessesDashboardModal";
import { SessionManagementModal } from "../chat/SessionManagementModal";
import { PreviewWebViewModal } from "../preview/PreviewWebViewModal";
import { ModelPickerSheet } from "./ModelPickerSheet";
import type { ChatPageContext, ChatPageModals } from "../pages/ChatPage";
import type { ChatModalOpenHandlers } from "../types/chatModalTypes";
import { useChatModalsController } from "../hooks/useChatModalsController";

type ChatModalsSectionProps = {
  context: ChatPageContext;
  modals: ChatPageModals;
  currentMessages: Message[];
  onSelectActiveChat: () => void;
  children: (open: ChatModalOpenHandlers) => React.ReactNode;
};

export function ChatModalsSection({
  context,
  modals,
  currentMessages,
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

  return (
    <>
      {children(openHandlers)}
      <WorkspacePickerModal
        visible={modalStates.workspacePicker.isOpen}
        onClose={modalStates.workspacePicker.close}
        serverBaseUrl={modals.modelPicker.currentServerUrl}
        workspacePath={modals.workspacePicker.workspacePath}
        onRefreshWorkspace={modals.workspacePicker.onRefreshWorkspace}
        onWorkspaceSelected={handleWorkspaceSelected}
      />
      <SessionManagementModal
        visible={modalStates.sessionManagement.isOpen}
        onClose={modalStates.sessionManagement.close}
        currentMessages={currentMessages}
        currentSessionId={modals.sessionManagement.currentSessionId}
        workspacePath={modals.sessionManagement.workspacePathForSessionManagement}
        provider={context.provider}
        model={context.model}
        workspaceLoading={modals.sessionManagement.workspaceLoading}
        onRefreshWorkspace={modals.sessionManagement.onRefreshSessionManagementWorkspace}
        onOpenWorkspacePicker={handleWorkspacePickerFromSession}
        onSelectSession={handleSessionSelect}
        onNewSession={handleNewSession}
        showActiveChat={modals.sessionManagement.showActiveChat}
        sessionRunning={modals.sessionManagement.sessionRunning}
        onSelectActiveChat={handleSelectActiveChat}
      />
      <SkillConfigurationModal
        visible={modalStates.skillsConfig.isOpen}
        onClose={closeSkillsConfig}
        onSelectSkill={handleSelectSkill}
        selectedSkillId={selectedSkillId}
        onCloseSkillDetail={closeSkillDetail}
        serverBaseUrl={modals.skills.serverBaseUrl}
      />
      <ProcessesDashboardModal visible={modalStates.processes.isOpen} onClose={modalStates.processes.close} serverBaseUrl={modals.processes.serverBaseUrl} />
      <DockerManagerModal visible={modalStates.docker.isOpen} onClose={modalStates.docker.close} serverBaseUrl={modals.docker.serverBaseUrl} />
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
        visible={modals.preview.previewVisible}
        url={modals.preview.previewUrl}
        title="Preview"
        onClose={modals.preview.onClosePreview}
        resolvePreviewUrl={modals.preview.resolvePreviewUrl}
      />
    </>
  );
}
