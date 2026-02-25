import React from "react";
import type { BrandProvider } from "../../src/theme/index";
import type { Message, PendingAskUserQuestion } from "../../src/services/socket/hooks";
import { AskQuestionModal } from "../../src/components/chat/AskQuestionModal";
import { SkillConfigurationModal } from "../../src/components/settings/SkillConfigurationModal";
import { WorkspacePickerModal } from "../../src/components/settings/WorkspacePickerModal";
import { DockerManagerModal } from "../../src/components/docker/DockerManagerModal";
import { ModelPickerSheet } from "./ModelPickerSheet";
import { ProcessesDashboardModal } from "../../src/components/processes/ProcessesDashboardModal";
import { SessionManagementModal } from "../../src/components/chat/SessionManagementModal";
import { PreviewWebViewModal } from "../../src/components/preview/PreviewWebViewModal";

type ModelOption = {
  value: string;
  label: string;
};

type ModalSession = {
  id: string;
  provider?: string | null;
  model?: string | null;
  running?: boolean;
  sseConnected?: boolean;
  messages?: Message[];
  cwd?: string | null;
};

type SessionModalsProps = {
  pendingAskQuestion: PendingAskUserQuestion | null;
  onSubmitAskQuestion: (answers: Array<{ header: string; selected: string[] }>) => void;
  onCancelAskQuestion: () => void;

  skillsConfigVisible: boolean;
  onCloseSkillsConfig: () => void;
  selectedSkillId: string | null;
  onSelectSkill: (id: string) => void;
  onCloseSkillDetail: () => void;
  serverBaseUrl: string;

  workspacePickerVisible: boolean;
  onCloseWorkspacePicker: () => void;
  workspacePath: string | null;
  onRefreshWorkspace: () => void;
  onWorkspaceSelected: () => void;

  dockerVisible: boolean;
  onCloseDocker: () => void;

  modelPickerVisible: boolean;
  onCloseModelPicker: () => void;
  provider: BrandProvider;
  model: string;
  themeMode: "light" | "dark";
  surfaceColor: string;
  providerModelOptions: {
    claude: ModelOption[];
    gemini: ModelOption[];
    codex: ModelOption[];
  };
  onModelProviderChange: (provider: BrandProvider) => void;
  onModelChange: (nextModel: string) => Promise<void> | void;

  processesVisible: boolean;
  onCloseProcesses: () => void;

  sessionManagementVisible: boolean;
  onCloseSessionManagement: () => void;
  currentMessages: Message[];
  currentSessionId: string | null;
  workspacePathForSessionManagement: string | null;
  sessionProvider: BrandProvider;
  sessionModel: string;
  workspaceLoading: boolean;
  onRefreshSessionManagementWorkspace: () => void;
  onOpenWorkspacePicker: () => void;
  onSelectSession: (session: ModalSession) => Promise<void> | void;
  onNewSession: () => void;
  showActiveChat: boolean;
  sessionRunning: boolean;
  onSelectActiveChat: () => void;

  previewVisible: boolean;
  previewUrl: string;
  onClosePreview: () => void;
  resolvePreviewUrl: (url: string) => string;
};

export function SessionModals({
  pendingAskQuestion,
  onSubmitAskQuestion,
  onCancelAskQuestion,
  skillsConfigVisible,
  onCloseSkillsConfig,
  selectedSkillId,
  onSelectSkill,
  onCloseSkillDetail,
  serverBaseUrl,
  workspacePickerVisible,
  onCloseWorkspacePicker,
  workspacePath,
  onRefreshWorkspace,
  onWorkspaceSelected,
  dockerVisible,
  onCloseDocker,
  modelPickerVisible,
  onCloseModelPicker,
  provider,
  model,
  themeMode,
  surfaceColor,
  providerModelOptions,
  onModelProviderChange,
  onModelChange,
  processesVisible,
  onCloseProcesses,
  sessionManagementVisible,
  onCloseSessionManagement,
  currentMessages,
  currentSessionId,
  workspacePathForSessionManagement,
  sessionProvider,
  sessionModel,
  workspaceLoading,
  onRefreshSessionManagementWorkspace,
  onOpenWorkspacePicker,
  onSelectSession,
  onNewSession,
  showActiveChat,
  sessionRunning,
  onSelectActiveChat,
  previewVisible,
  previewUrl,
  onClosePreview,
  resolvePreviewUrl,
}: SessionModalsProps) {
  return (
    <>
      <AskQuestionModal
        pending={pendingAskQuestion}
        onSubmit={onSubmitAskQuestion}
        onCancel={onCancelAskQuestion}
      />
      <SkillConfigurationModal
        visible={skillsConfigVisible}
        onClose={onCloseSkillsConfig}
        onSelectSkill={onSelectSkill}
        selectedSkillId={selectedSkillId}
        onCloseSkillDetail={onCloseSkillDetail}
        serverBaseUrl={serverBaseUrl}
      />
      <WorkspacePickerModal
        visible={workspacePickerVisible}
        onClose={onCloseWorkspacePicker}
        serverBaseUrl={serverBaseUrl}
        workspacePath={workspacePath}
        onRefreshWorkspace={onRefreshWorkspace}
        onWorkspaceSelected={onWorkspaceSelected}
      />
      <DockerManagerModal
        visible={dockerVisible}
        onClose={onCloseDocker}
        serverBaseUrl={serverBaseUrl}
      />
      <ModelPickerSheet
        isOpen={modelPickerVisible}
        onClose={onCloseModelPicker}
        provider={provider}
        model={model}
        themeMode={themeMode}
        surfaceColor={surfaceColor}
        providerModelOptions={providerModelOptions}
        onProviderChange={onModelProviderChange}
        onModelChange={onModelChange}
      />
      <ProcessesDashboardModal
        visible={processesVisible}
        onClose={onCloseProcesses}
        serverBaseUrl={serverBaseUrl}
      />
      <SessionManagementModal
        visible={sessionManagementVisible}
        onClose={onCloseSessionManagement}
        currentMessages={currentMessages}
        currentSessionId={currentSessionId}
        workspacePath={workspacePathForSessionManagement}
        provider={sessionProvider}
        model={sessionModel}
        serverBaseUrl={serverBaseUrl}
        workspaceLoading={workspaceLoading}
        onRefreshWorkspace={onRefreshSessionManagementWorkspace}
        onOpenWorkspacePicker={onOpenWorkspacePicker}
        onSelectSession={onSelectSession}
        onNewSession={onNewSession}
        showActiveChat={showActiveChat}
        sessionRunning={sessionRunning}
        onSelectActiveChat={onSelectActiveChat}
      />
      <PreviewWebViewModal
        visible={previewVisible}
        url={previewUrl}
        title="Preview"
        onClose={onClosePreview}
        resolvePreviewUrl={resolvePreviewUrl}
      />
    </>
  );
}
