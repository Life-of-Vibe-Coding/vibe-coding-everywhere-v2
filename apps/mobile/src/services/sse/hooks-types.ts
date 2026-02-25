import type { Message, CodeReference, PermissionDenial, PendingAskUserQuestion, LastRunOptions, IServerConfig } from "@/core/types";
import type { Provider } from "@/theme/index";

export interface UseSseOptions {
  serverConfig?: IServerConfig;
  provider?: Provider;
  model?: string;
}

export type EventSourceLike = {
  addEventListener: (event: string, handler: (...args: any[]) => void) => void;
  removeEventListener: (event: string, handler: (...args: any[]) => void) => void;
  close: () => void;
};

export type EventSourceCtor = new (url: string) => EventSourceLike;

export type SessionRuntimeState = "idle" | "running" | "waiting";

export type SessionLiveState = {
  messages: Message[];
  outputBuffer: string;
  currentAssistantContent: string;
  sessionState: SessionRuntimeState;
  typingIndicator: boolean;
  waitingForUserInput: boolean;
  currentActivity: string | null;
  lastSessionTerminated: boolean;
  hasCompletedFirstRun: boolean;
};

export type { Message, CodeReference, PermissionDenial, PendingAskUserQuestion, LastRunOptions };
