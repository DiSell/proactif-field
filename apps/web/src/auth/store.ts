import { create } from "zustand";
import { UserDTO } from "@proactif-field/shared";

interface AuthState {
  token: string | null;
  user: UserDTO | null;
  setAuth: (token: string, user: UserDTO) => void;
  clearAuth: () => void;
}

// Authentication must be scoped to the current browser tab. Using
// localStorage here caused an administrator session and a technician session
// opened in two tabs to overwrite each other.
const SESSION_STORAGE_KEY = "proactif-field-auth-session";
const LEGACY_STORAGE_KEY = "proactif-field-auth";

type StoredAuth = { token: string | null; user: UserDTO | null };

function parseStoredAuth(raw: string | null): StoredAuth | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<StoredAuth>;
    if (typeof value.token !== "string" || !value.user?.id || !value.user.role) return null;
    return { token: value.token, user: value.user };
  } catch {
    return null;
  }
}

function loadInitial(): StoredAuth {
  const currentSession = parseStoredAuth(sessionStorage.getItem(SESSION_STORAGE_KEY));
  if (currentSession) return currentSession;

  // Keep the user connected once when deploying this change, then remove the
  // old shared value so future admin/technician tabs are fully independent.
  const legacySession = parseStoredAuth(localStorage.getItem(LEGACY_STORAGE_KEY));
  localStorage.removeItem(LEGACY_STORAGE_KEY);
  if (legacySession) {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(legacySession));
    return legacySession;
  }
  return { token: null, user: null };
}

export const useAuthStore = create<AuthState>((set) => ({
  ...loadInitial(),
  setAuth: (token, user) => {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ token, user }));
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    set({ token, user });
  },
  clearAuth: () => {
    const userId = useAuthStore.getState().user?.id;
    if (userId) {
      void import("../offline/db").then(({ clearOfflineData }) => clearOfflineData(userId));
      void import("../offline/cache").then(({ clearPrivateCache }) => clearPrivateCache(userId));
    }
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    set({ token: null, user: null });
  },
}));
