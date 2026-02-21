import type { TerminalState } from "../../core/types";

/**
 * Policy for terminal command input visibility (Strategy for complex conditionals).
 * Centralizes "can user type in selected terminal?" so UI just asks the policy.
 */
export type TerminalInputState = "hidden" | "disabled" | "enabled";

export function getTerminalInputState(
  selectedTerminalId: string | null,
  terminals: TerminalState[],
  canRunInSelectedTerminal: boolean
): TerminalInputState {
  if (!selectedTerminalId || terminals.length === 0) return "hidden";
  const term = terminals.find((t) => t.id === selectedTerminalId);
  if (!term?.active) return "hidden";
  if (term.isSingleCommand) return "disabled";
  if (!canRunInSelectedTerminal) return "hidden";
  return "enabled";
}
