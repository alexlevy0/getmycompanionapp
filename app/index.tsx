import { useEffect, useState, useCallback } from "react";
import { Alert } from "react-native";
import { saveAuthToken, getAuthToken, clearAuthToken } from "@/lib/storage";

// Screens
import { LoadingScreen } from "@/components/screens/LoadingScreen";
import { LoginScreen } from "@/components/screens/LoginScreen";
import { DashboardScreen } from "@/components/screens/DashboardScreen";

// Types
import type { UserStatus as UserStatusType } from "@/types";

interface UserData {
  status: UserStatusType;
  firstName?: string;
  phone: string;
  nextCallScheduled?: string;
  totalCalls: number;
  trialCallsRemaining: number;
  preferredTime: string;
  preferredDays: string;
  paymentLink?: string;
}

type AppState = "loading" | "login" | "dashboard";

export default function HomeScreen() {
  const [appState, setAppState] = useState<AppState>("loading");
  const [userStatus, setUserStatus] = useState<UserData | null>(null);
  
  // Check for existing token or magic link on mount
  useEffect(() => {
    checkMagicLink();
    checkAuth();
  }, []);

  const checkMagicLink = async () => {
    if (typeof window === "undefined") return;
    
    const params = new URLSearchParams(window.location.search);
    const magicToken = params.get("magic_token");
    
    if (magicToken) {
      setAppState("loading");
      try {
        const response = await fetch(`/api/auth/verify-magic-link?token=${magicToken}`);
        const data = await response.json();
        
        if (response.ok && data.token) {
          await saveAuthToken(data.token);
          window.history.replaceState({}, "", window.location.pathname);
          await fetchUserStatus(data.token);
        } else {
          setAppState("login");
          window.history.replaceState({}, "", window.location.pathname);
          Alert.alert("Erreur", data.error || "Lien invalide");
        }
      } catch {
        setAppState("login");
      }
    }
  };

  const checkAuth = async () => {
    try {
      const token = await getAuthToken();
      if (token) {
        await fetchUserStatus(token);
      } else {
        // If not verifying magic link, show login
        if (typeof window !== "undefined" && !new URLSearchParams(window.location.search).has("magic_token")) {
          setAppState("login");
        }
      }
    } catch {
      setAppState("login");
    }
  };

  const fetchUserStatus = async (token: string) => {
    try {
      const response = await fetch("/api/user-status", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        await clearAuthToken();
        setAppState("login");
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to fetch status");
      }

      const data = await response.json();
      setUserStatus(data);
      setAppState("dashboard");
    } catch {
      await clearAuthToken();
      setAppState("login");
    }
  };

  const handleLogout = async () => {
    await clearAuthToken();
    setUserStatus(null);
    setAppState("login");
  };

  const handleUpdatePreferences = async (updates: { preferredTime: string }) => {
    try {
      const token = await getAuthToken();
      if (!token) return;

      const response = await fetch("/api/update-preferences", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error("Erreur mise à jour");
      }

      await fetchUserStatus(token);
      
    } catch (error) {
      Alert.alert("Erreur", "Impossible de mettre à jour les réglages.");
    }
  };

  const handleRefresh = useCallback(async () => {
    const token = await getAuthToken();
    if (token) {
      await fetchUserStatus(token);
    }
  }, []);

  // Render
  if (appState === "loading") {
    return <LoadingScreen />;
  }

  if (appState === "login") {
    return (
      // Dipler config is now protected, so we don't pass it to unauth login screen
      // This effectively disables the "Call Now" demo button for unauth users,
      // which aligns with the security requirement to require auth for Dipler config.
      <LoginScreen diplerConfig={null} />
    );
  }

  if (appState === "dashboard" && userStatus) {
    return (
      <DashboardScreen 
        userStatus={userStatus}
        onLogout={handleLogout}
        onRefresh={handleRefresh}
        onUpdatePreferences={handleUpdatePreferences}
      />
    );
  }

  return null;
}
