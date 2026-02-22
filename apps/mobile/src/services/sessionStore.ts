/**
 * Session Store - Persist provider/model preference only.
 *
 * Sessions come from the server (.pi/sessions on disk). We only persist
 * the last used provider and model for UX.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const LAST_USED_PROVIDER_MODEL_KEY = "@vibe_last_used_provider_model";

export interface LastUsedProviderModel {
  provider: string;
  model: string;
}

/**
 * Load the last used provider and model (for new sessions).
 */
export async function loadLastUsedProviderModel(): Promise<LastUsedProviderModel | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_USED_PROVIDER_MODEL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { provider?: string; model?: string };
    if (typeof parsed?.provider === "string" && typeof parsed?.model === "string") {
      return { provider: parsed.provider, model: parsed.model };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Persist the last used provider and model.
 */
export async function setLastUsedProviderModel(provider: string, model: string): Promise<void> {
  try {
    await AsyncStorage.setItem(
      LAST_USED_PROVIDER_MODEL_KEY,
      JSON.stringify({ provider, model })
    );
  } catch {
    // Ignore persistence errors
  }
}
