import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// ============================================
// Storage Keys
// ============================================

const STORAGE_KEYS = {
  AUTH_TOKEN: "mycompanion_auth_token",
} as const;

// ============================================
// Web Fallback (SecureStore is mobile-only)
// ============================================

const webStorage = {
  getItem: (key: string) => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(key);
    }
    return null;
  },
  setItem: (key: string, value: string) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(key, value);
    }
  },
  deleteItem: (key: string) => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(key);
    }
  },
};

// ============================================
// Auth Token Storage
// ============================================

/**
 * Saves the auth token securely.
 * Uses SecureStore on native, localStorage on web.
 */
export async function saveAuthToken(token: string): Promise<void> {
  if (Platform.OS === "web") {
    webStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
  } else {
    await SecureStore.setItemAsync(STORAGE_KEYS.AUTH_TOKEN, token);
  }
}

/**
 * Retrieves the stored auth token.
 * Returns null if no token is stored.
 */
export async function getAuthToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    return webStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
  }
  return SecureStore.getItemAsync(STORAGE_KEYS.AUTH_TOKEN);
}

/**
 * Clears the stored auth token (logout).
 */
export async function clearAuthToken(): Promise<void> {
  if (Platform.OS === "web") {
    webStorage.deleteItem(STORAGE_KEYS.AUTH_TOKEN);
  } else {
    await SecureStore.deleteItemAsync(STORAGE_KEYS.AUTH_TOKEN);
  }
}

/**
 * Checks if user is authenticated (has a token).
 */
export async function isAuthenticated(): Promise<boolean> {
  const token = await getAuthToken();
  return token !== null && token.length > 0;
}
