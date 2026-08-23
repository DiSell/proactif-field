import { create } from "zustand";
import { UserDTO } from "@proactif-field/shared";

interface AuthState {
  token: string | null;
  user: UserDTO | null;
  setAuth: (token: string, user: UserDTO) => void;
  clearAuth: () => void;
}

const STORAGE_KEY = "proactif-field-auth";

function loadInitial(): { token: string | null; user: UserDTO | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { token: null, user: null };
    return JSON.parse(raw);
  } catch {
    return { token: null, user: null };
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  ...loadInitial(),
  setAuth: (token, user) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user }));
    set({ token, user });
  },
  clearAuth: () => {
    const userId = useAuthStore.getState().user?.id;
    if (userId) {
      void import("../offline/db").then(({ clearOfflineData }) => clearOfflineData(userId));
      void import("../offline/cache").then(({ clearPrivateCache }) => clearPrivateCache(userId));
    }
    localStorage.removeItem(STORAGE_KEY);
    set({ token: null, user: null });
  },
}));
