interface ApiKeys {
  openai: string;
  openrouter: string;
}

const API_KEYS_STORAGE_KEY = "chatapp_api_keys";

/**
 * Load API keys from localStorage
 */
export function loadApiKeysFromStorage(): ApiKeys {
  if (typeof window === "undefined") {
    return { openai: "", openrouter: "" };
  }

  const savedKeys = localStorage.getItem(API_KEYS_STORAGE_KEY);
  if (savedKeys) {
    try {
      return JSON.parse(savedKeys);
    } catch (error) {
      console.error("Failed to parse saved API keys:", error);
      // Clear invalid data
      localStorage.removeItem(API_KEYS_STORAGE_KEY);
    }
  }
  return { openai: "", openrouter: "" };
}

/**
 * Save API keys to localStorage
 */
export function saveApiKeysToStorage(apiKeys: ApiKeys): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    localStorage.setItem(API_KEYS_STORAGE_KEY, JSON.stringify(apiKeys));
    return true;
  } catch (error) {
    console.error("Failed to save API keys:", error);
    return false;
  }
}

/**
 * Clear all API keys from localStorage
 */
export function clearApiKeysFromStorage(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(API_KEYS_STORAGE_KEY);
  }
}

/**
 * Get a specific API key from localStorage
 */
export function getApiKey(provider: keyof ApiKeys): string {
  const keys = loadApiKeysFromStorage();
  return keys[provider] || "";
}

/**
 * Check if any API keys are configured
 */
export function hasApiKeys(): boolean {
  const keys = loadApiKeysFromStorage();
  return Boolean(keys.openai || keys.openrouter);
}

/**
 * Check if a specific provider has an API key configured
 */
export function hasApiKey(provider: keyof ApiKeys): boolean {
  const key = getApiKey(provider);
  return Boolean(key && key.trim().length > 0);
}

export type { ApiKeys };
