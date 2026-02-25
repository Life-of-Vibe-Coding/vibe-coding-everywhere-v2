import React from "react";
import type { FlatList } from "react-native";
import type { PermissionModeUI } from "@/utils/permission";
import type { BrandProvider } from "@/theme/index";
import type { Message, PermissionDenial, PendingAskUserQuestion } from "@/services/sse/hooks";
import type { CodeRefPayload } from "@/components/file/FileViewerModal";
import type { createAppStyles } from "@/components/styles/appStyles";
import type { getTheme } from "@/theme/index";
import { ChatModalsSection } from "@/components/components/ChatModalsSection";
import { ChatPageShell } from "@/components/pages/ChatPageShell";

type ModelOption = {
  value: string;
  label: string;
};

type ModalSessionItem = {
  id: string;
  provider?: string | null;
  model?: string | null;
  running?: boolean;
  sseConnected?: boolean;
  messages?: Message[];
  cwd?: string | null;
};

type ProviderModelOptions = {
  claude: ModelOption[];
  gemini: ModelOption[];
  codex: ModelOption[];
};

export type ChatPageContext = {
  theme: ReturnType<typeof getTheme>;
  themeMode: "light" | "dark";
  styles: ReturnType<typeof createAppStyles>;
  provider: BrandProvider;
  model: string;
  modelOptions: ModelOption[];
  providerModelOptions: ProviderModelOptions;
  permissionModeUI: PermissionModeUI;
};

export type ChatPageRuntime = {
  connected: boolean;
  permissionDenials: PermissionDenial[];
  lastSessionTerminated: boolean;
  tailBoxMaxHeight: number;
  sessionRunning: boolean;
  waitingForUserInput: boolean;
};

export type ChatPageHeader = {
  workspaceName: string;
  sessionIdLabel: string;
  onOpenExplorer: () => void;
  sidebarVisible: boolean;
};

export type ChatPageConversation = {
  messages: Message[];
  provider: BrandProvider;
  sessionId: string | null;
  permissionDenials: PermissionDenial[];
  lastSessionTerminated: boolean;
  tailBoxMaxHeight: number;
  flatListRef: React.RefObject<FlatList<Message>>;
  onContentSizeChange: () => void;
  onOpenUrl: (url: string) => void;
  onFileSelect: (path: string) => void;
  onRetryPermission: () => void;
  onDismissPermission: () => void;
};

export type ChatPageFileViewer = {
  selectedFilePath: string | null;
  fileContent: string | null;
  fileIsImage: boolean;
  fileLoading: boolean;
  fileError: string | null;
  onCloseFileViewer: () => void;
  onAddCodeReference: (ref: CodeRefPayload) => void;
};

export type ChatPageSidebar = {
  visible: boolean;
  activeTab: "files" | "changes" | "commits";
  onCloseSidebar: () => void;
  onFileSelectFromSidebar: (path: string) => void;
  onCommitByAI: (userRequest: string) => void;
  onSidebarTabChange: (tab: "files" | "changes" | "commits") => void;
};

export type ChatPageInputDock = {
  visible: boolean;
  pendingCodeRefs: CodeRefPayload[];
  onSubmitPrompt: (prompt: string) => void;
  onRemoveCodeRef: (index: number) => void;
  onTerminateAgent: () => void;
  onOpenWebPreview: () => void;
  onProviderChange: (provider: BrandProvider) => void;
  onModelChange: (model: string) => void;
};

export type ChatPageAskQuestion = {
  pendingAskQuestion: PendingAskUserQuestion | null;
  onSubmitAskQuestion: (answers: Array<{ header: string; selected: string[] }>) => void;
  onCancelAskQuestion: () => void;
};

type ChatPageSkillsConfig = {
  serverBaseUrl: string;
};

type ChatPageWorkspacePicker = {
  workspacePath: string | null;
  onRefreshWorkspace: () => void;
  onWorkspaceSelected: (path?: string) => void;
};

type ChatPageDocker = {
  serverBaseUrl: string;
};

type ChatPageModelPicker = {
  currentServerUrl: string;
  surfaceColor: string;
  onModelProviderChange: (provider: BrandProvider) => void;
  onModelChange: (model: string) => void;
};

type ChatPageProcesses = {
  serverBaseUrl: string;
};

type ChatPageSessionManagement = {
  onRefreshSessionManagementWorkspace: () => void;
  workspacePathForSessionManagement: string | null;
  serverBaseUrl: string;
  onSelectSession: (session: ModalSessionItem | null) => Promise<void> | void;
  onNewSession: () => void;
  currentSessionId: string | null;
  workspaceLoading: boolean;
  sessionRunning: boolean;
  onSelectActiveChat: () => void;
  currentMessages: Message[];
  showActiveChat: boolean;
};

type ChatPagePreview = {
  previewVisible: boolean;
  previewUrl: string;
  onClosePreview: () => void;
  resolvePreviewUrl: (url: string) => string;
};

export type ChatPageModals = {
  askQuestion: ChatPageAskQuestion;
  skills: ChatPageSkillsConfig;
  workspacePicker: ChatPageWorkspacePicker;
  docker: ChatPageDocker;
  modelPicker: ChatPageModelPicker;
  processes: ChatPageProcesses;
  sessionManagement: ChatPageSessionManagement;
  preview: ChatPagePreview;
};

export type ChatPageProps = {
  context: ChatPageContext;
  runtime: ChatPageRuntime;
  header: ChatPageHeader;
  conversation: ChatPageConversation;
  fileViewer: ChatPageFileViewer;
  sidebar: ChatPageSidebar;
  inputDock: ChatPageInputDock;
  modals: ChatPageModals;
};

export function ChatPage({
  context,
  runtime,
  header,
  conversation,
  fileViewer,
  sidebar,
  inputDock,
  modals,
}: ChatPageProps) {
  return (
    <ChatModalsSection
      context={context}
      modals={modals}
      currentMessages={conversation.messages}
      onSelectActiveChat={modals.sessionManagement.onSelectActiveChat}
    >
      {(modalHandlers) => (
        <ChatPageShell
          context={context}
          runtime={runtime}
          header={header}
          conversation={conversation}
          fileViewer={fileViewer}
          sidebar={sidebar}
          inputDock={inputDock}
          modalHandlers={modalHandlers}
        />
      )}
    </ChatModalsSection>
  );
}
