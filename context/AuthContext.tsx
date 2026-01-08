import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getAuthToken, saveAuthToken, clearAuthToken } from "@/lib/storage";
import { UserStatus as UserStatusType } from "@/lib/schemas"; // Using Zod inferred type if possible, or define interface

// We might need to define a frontend-specific User interface or reuse the one from schemas if exported
// For now, let's assume the API returns what matches our schema roughly
interface User {
  status: string;
  firstName?: string;
  phone: string;
  trialCallsRemaining?: string;
  nextCallScheduled?: string;
  totalCalls?: string;
  paymentLink?: string;
  preferredTime?: string;
  preferredDays?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch user profile from API
  const fetchUser = useCallback(async (authToken: string) => {
    try {
      const res = await fetch("/api/user-status", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      
      if (!res.ok) throw new Error("Failed to fetch user");
      
      const data = await res.json();
      
      // Map API response to User object
      setUser({
        status: data.userStatus,
        firstName: data.firstName,
        phone: data.phone,
        trialCallsRemaining: data.trialCallsRemaining,
        nextCallScheduled: data.nextCallScheduled,
        totalCalls: data.totalCalls,
        paymentLink: data.paymentLink,
        preferredTime: data.preferredTime,
        preferredDays: data.preferredDays,
      });
    } catch (error) {
      console.error("Auth fetch error:", error);
      // If 401, we might want to logout, but let's just clear user for now
      setUser(null);
      if (token) logout();
    }
  }, [token]);

  // Initial load
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = await getAuthToken();
      if (storedToken) {
        setToken(storedToken);
        await fetchUser(storedToken);
      }
      setIsLoading(false);
    };
    initAuth();
  }, [fetchUser]);

  const login = async (newToken: string) => {
    setIsLoading(true);
    await saveAuthToken(newToken);
    setToken(newToken);
    await fetchUser(newToken);
    setIsLoading(false);
  };

  const logout = async () => {
    setIsLoading(true);
    await clearAuthToken();
    setToken(null);
    setUser(null);
    setIsLoading(false);
  };

  const refreshUser = async () => {
    if (token) {
      await fetchUser(token);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
