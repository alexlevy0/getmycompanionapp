import { useEffect } from "react";
import { Alert } from "react-native";
import { useAuth } from "@/context/AuthContext";

// Screens
import { LoadingScreen } from "@/components/screens/LoadingScreen";
import { LoginScreen } from "@/components/screens/LoginScreen";
import { DashboardScreen } from "@/components/screens/DashboardScreen";

export default function HomeScreen() {
  const { user, isLoading, login, logout, refreshUser, token } = useAuth();
  
  // Handle Magic Link in URL
  useEffect(() => {
    const handleMagicLink = async () => {
      if (typeof globalThis.window === "undefined") return;

      const params = new URLSearchParams(globalThis.window.location.search);
      const magicToken = params.get("magic_token");

      if (magicToken) {
        try {
          const response = await fetch(`/api/auth/verify-magic-link?token=${magicToken}`);
          const data = await response.json();

          if (response.ok && data.token) {
            await login(data.token);
            globalThis.window.history.replaceState({}, "", globalThis.window.location.pathname);
          } else {
            Alert.alert("Erreur", data.error || "Lien invalide");
          }
        } catch {
          Alert.alert("Erreur", "Impossible de vérifier le lien");
        }
      }
    };

    handleMagicLink();
  }, [login]);

  // Handle Preferences Update
  const handleUpdatePreferences = async (updates: { preferredTime: string }) => {
    try {
      if (!token) return;

      const response = await fetch("/api/update-preferences", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) throw new Error("Erreur mise à jour");
      await refreshUser();
    } catch {
      Alert.alert("Erreur", "Impossible de mettre à jour les réglages.");
    }
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <LoginScreen diplerConfig={null} />;
  }

  return (
    <DashboardScreen 
      userStatus={user}
      onLogout={logout}
      onRefresh={refreshUser}
      onUpdatePreferences={handleUpdatePreferences}
    />
  );
}
