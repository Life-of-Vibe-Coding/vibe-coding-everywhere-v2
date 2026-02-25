// Event dispatcher (combines Claude + Gemini handlers)
export { createEventDispatcher } from "./eventDispatcher";

// Types
export type { EventContext, EventHandler } from "./types";
export { formatToolUseForDisplay } from "./types";

// Stream utilities (shared by both providers)
export {
  stripAnsi,
  filterBashNoise,
  stripCommandStyleTags,
  stripTrailingIncompleteTag,
  extractRenderCommandAndUrl,
  isAskUserQuestionPayload,
  isProviderStream,
  isProviderSystemNoise,
  deniedToolToAllowedPattern,
  getAllowedToolsFromDenials,
  RENDER_CMD_REGEX,
  RENDER_URL_REGEX,
  NEED_PERMISSION_REGEX,
} from "./stream";
