import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Alert,
} from "react-native";
import { saveAuthToken, getAuthToken, clearAuthToken } from "@/lib/storage";
import { SettingsModal } from "@/components/SettingsModal";
import { StatusCard } from "@/components/dashboard/StatusCard";
import { NextCallCard } from "@/components/dashboard/NextCallCard";
import { StatsRow } from "@/components/dashboard/StatsRow";
import { PersonaCard } from "@/components/dashboard/PersonaCard";
import type { UserStatus as UserStatusType, Persona } from "@/types";

// ============================================
// Types
// ============================================

interface UserData {
  status: UserStatusType;
  persona?: Persona;
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

// ============================================
// Status Display Config
// ============================================

const STATUS_CONFIG: Record<string, { emoji: string; label: string; color: string }> = {
  onboarding: { emoji: "📞", label: "Configuration en cours", color: "#3b82f6" },
  trial: { emoji: "🎁", label: "Période d'essai", color: "#8b5cf6" },
  active: { emoji: "✅", label: "Abonnement actif", color: "#22c55e" },
  awaiting_payment: { emoji: "💳", label: "Paiement requis", color: "#f59e0b" },
  paused: { emoji: "⏸️", label: "En pause", color: "#6b7280" },
  churned: { emoji: "👋", label: "Abonnement terminé", color: "#ef4444" },
};

// ============================================
// Main Component
// ============================================

export default function HomeScreen() {
  const [appState, setAppState] = useState<AppState>("loading");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [userStatus, setUserStatus] = useState<UserData | null>(null);
  
  // Login / OTP State
  const [authMode, setAuthMode] = useState<"signup" | "signin">("signup");
  const [otpCode, setOtpCode] = useState("");
  const [showOtpInput, setShowOtpInput] = useState(false);
  
  // Settings Modal State
  const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false);

  // Check for existing token on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = await getAuthToken();
      if (token) {
        await fetchUserStatus(token);
      } else {
        setAppState("login");
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
        // Token invalid, clear and show login
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
      // On error, clear token and show login
      await clearAuthToken();
      setAppState("login");
    }
  };

  const handleStartTrial = async () => {
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/start-trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Une erreur est survenue");
      }

      // Save the auth token
      if (data.token) {
        await saveAuthToken(data.token);
        
        // Anti-Race Condition:
        // Use user data returned directly by verify-code if available.
        // Falls back to fetchUserStatus if not (backward compatibility)
        if (data.user) {
          setUserStatus(data.user);
          setAppState("dashboard");
        } else {
           await fetchUserStatus(data.token);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOtp = async () => {
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erreur de connexion");
      }

      setShowOtpInput(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code: otpCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Code invalide");
      }

      if (data.token) {
        await saveAuthToken(data.token);
        
        // Anti-Race Condition:
        if (data.user) {
          setUserStatus(data.user);
          setAppState("dashboard");
        } else {
          await fetchUserStatus(data.token);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await clearAuthToken();
    setUserStatus(null);
    setAppState("login");
    setAuthMode("signup");
    setShowOtpInput(false);
    setPhone("");
    setOtpCode("");
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    const token = await getAuthToken();
    if (token) {
      await fetchUserStatus(token);
    }
    setRefreshing(false);
  }, []);

  const handleUpdatePreferences = async (updates: { preferredTime: string; persona: string }) => {
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

      // Refresh status to show new data
      await fetchUserStatus(token);
      
    } catch (error) {
      Alert.alert("Erreur", "Impossible de mettre à jour les réglages.");
    }
  };

  // ========================================
  // Loading State
  // ========================================
  if (appState === "loading") {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  // ========================================
  // Login State
  // ========================================
  // ========================================
  // Login State
  // ========================================
  if (appState === "login") {
    const isValidPhone = phone.replace(/\s/g, "").length >= 10;
    const isValidOtp = otpCode.length === 6;

    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Text style={styles.emoji}>📞</Text>
        <Text style={styles.title}>MyCompanion</Text>
        <Text style={styles.subtitle}>
          {authMode === "signup" 
            ? "L'IA qui t'appelle.\nChaque jour, à l'heure qui te convient."
            : "Bon retour !\nConnectez-vous pour retrouver votre compte."}
        </Text>

        {!showOtpInput ? (
          <>
            <TextInput
              style={styles.input}
              placeholder="Ton numéro de téléphone"
              placeholderTextColor="#999"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              autoFocus
            />

            <Pressable
              style={[styles.button, (!isValidPhone || loading) && styles.buttonDisabled]}
              onPress={authMode === "signup" ? handleStartTrial : handleRequestOtp}
              disabled={!isValidPhone || loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>
                  {authMode === "signup" ? "M'appeler" : "Recevoir mon code"}
                </Text>
              )}
            </Pressable>

            <Pressable 
              style={styles.switchModeButton}
              onPress={() => {
                 setAuthMode(authMode === "signup" ? "signin" : "signup");
                 setError("");
              }}
            >
              <Text style={styles.switchModeText}>
                {authMode === "signup" 
                  ? "Déjà un compte ? Se connecter" 
                  : "Nouveau ? S'inscrire"}
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <TextInput
              style={styles.input}
              placeholder="Code reçu par SMS (6 chiffres)"
              placeholderTextColor="#999"
              keyboardType="number-pad"
              value={otpCode}
              onChangeText={setOtpCode}
              maxLength={6}
              autoFocus
            />

            <Pressable
              style={[styles.button, (!isValidOtp || loading) && styles.buttonDisabled]}
              onPress={handleVerifyOtp}
              disabled={!isValidOtp || loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Valider le code</Text>
              )}
            </Pressable>
            
            <Pressable 
              style={styles.switchModeButton}
              onPress={() => setShowOtpInput(false)}
            >
              <Text style={styles.switchModeText}>Modifier mon numéro</Text>
            </Pressable>
          </>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.legal}>
          {authMode === "signup" 
            ? "3 appels gratuits, sans engagement.\nEn continuant, vous acceptez nos CGU."
            : "Nous vous enverrons un code temporaire par SMS."}
        </Text>
      </KeyboardAvoidingView>
    );
  }

  // ========================================
  // Dashboard State
  // ========================================
  if (!userStatus) return null;

  const statusConfig = STATUS_CONFIG[userStatus.status] || STATUS_CONFIG.trial;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={styles.dashboardContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>
            Bonjour{userStatus.firstName ? `, ${userStatus.firstName}` : ""} 👋
          </Text>
          <View style={styles.headerActions}>
            <Pressable 
              onPress={() => setIsSettingsModalVisible(true)} 
              style={styles.settingsButton}
            >
              <Text style={styles.settingsButtonText}>⚙️ Réglages</Text>
            </Pressable>
            <Pressable onPress={handleLogout} style={styles.logoutButton}>
              <Text style={styles.logoutText}>Déconnexion</Text>
            </Pressable>
          </View>
        </View>

        {/* Status Card */}
        <StatusCard 
          status={userStatus.status} 
          trialCallsRemaining={userStatus.trialCallsRemaining} 
          paymentLink={userStatus.paymentLink}
          onOpenPaymentLink={(url) => {
            if (typeof window !== "undefined") window.open(url, "_blank");
          }}
        />

        {/* Next Call Card */}
        <NextCallCard scheduledDate={userStatus.nextCallScheduled || ""} />

        {/* Stats */}
        <StatsRow 
          totalCalls={userStatus.totalCalls} 
          preferredTime={userStatus.preferredTime} 
        />

        {/* Persona */}
        <PersonaCard 
          persona={userStatus.persona} 
          onModify={() => setIsSettingsModalVisible(true)} 
        />

      </ScrollView>

      {/* Settings Modal */}
      <SettingsModal
        visible={isSettingsModalVisible}
        onClose={() => setIsSettingsModalVisible(false)}
        currentSettings={{
          preferredTime: userStatus.preferredTime,
          persona: userStatus.persona,
        }}
        onUpdate={handleUpdatePreferences}
      />
    </View>
  );
}

// ============================================
// Styles
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#fff",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
  },
  emoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    marginBottom: 8,
    color: "#1a1a1a",
  },
  subtitle: {
    fontSize: 18,
    color: "#666",
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 26,
  },
  input: {
    width: "100%",
    maxWidth: 320,
    height: 56,
    borderWidth: 2,
    borderColor: "#e0e0e0",
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 18,
    marginBottom: 16,
  },
  button: {
    width: "100%",
    maxWidth: 320,
    height: 56,
    backgroundColor: "#2563eb",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonDisabled: {
    backgroundColor: "#93c5fd",
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  error: {
    color: "#dc2626",
    marginBottom: 16,
    textAlign: "center",
  },
  legal: {
    marginTop: 24,
    fontSize: 12,
    color: "#999",
    textAlign: "center",
  },
  switchModeButton: {
    marginTop: 16,
    padding: 8,
  },
  switchModeText: {
    color: "#2563eb",
    fontSize: 14,
    fontWeight: "600",
  },

  // Dashboard styles
  dashboardContainer: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 60,
    backgroundColor: "#f5f5f5",
  },
  header: {
    marginBottom: 24,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  greeting: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 8,
  },
  settingsButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  settingsButtonText: {
    color: "#374151",
    fontWeight: "600",
    fontSize: 14,
  },
  logoutButton: {
    padding: 8,
  },
  logoutText: {
    color: "#6b7280",
    fontSize: 14,
  },
});
