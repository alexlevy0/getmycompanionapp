import { useEffect, useState } from "react";
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
} from "react-native";
import { saveAuthToken, getAuthToken, clearAuthToken } from "@/lib/storage";

// ============================================
// Types
// ============================================

interface UserStatus {
  status: string;
  persona?: string;
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
  const [error, setError] = useState("");
  const [userStatus, setUserStatus] = useState<UserStatus | null>(null);

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
        await fetchUserStatus(data.token);
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
  };

  const handleRefresh = async () => {
    const token = await getAuthToken();
    if (token) {
      await fetchUserStatus(token);
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
  if (appState === "login") {
    const isValid = phone.replace(/\s/g, "").length >= 10;

    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Text style={styles.emoji}>📞</Text>
        <Text style={styles.title}>MyCompanion</Text>
        <Text style={styles.subtitle}>
          L'IA qui t'appelle.{"\n"}Chaque jour, à l'heure qui te convient.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Ton numéro de téléphone"
          placeholderTextColor="#999"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
          autoFocus
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[styles.button, (!isValid || loading) && styles.buttonDisabled]}
          onPress={handleStartTrial}
          disabled={!isValid || loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>M'appeler</Text>
          )}
        </Pressable>

        <Text style={styles.legal}>
          3 appels gratuits, sans engagement.{"\n"}
          En continuant, vous acceptez nos CGU.
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
    <ScrollView contentContainerStyle={styles.dashboardContainer}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>
          Bonjour{userStatus.firstName ? `, ${userStatus.firstName}` : ""} 👋
        </Text>
        <Pressable onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Déconnexion</Text>
        </Pressable>
      </View>

      {/* Status Card */}
      <View style={[styles.card, { borderLeftColor: statusConfig.color }]}>
        <Text style={styles.cardEmoji}>{statusConfig.emoji}</Text>
        <Text style={styles.cardTitle}>{statusConfig.label}</Text>
        
        {userStatus.status === "trial" && (
          <Text style={styles.cardSubtitle}>
            {userStatus.trialCallsRemaining} appel{userStatus.trialCallsRemaining > 1 ? "s" : ""} gratuit{userStatus.trialCallsRemaining > 1 ? "s" : ""} restant{userStatus.trialCallsRemaining > 1 ? "s" : ""}
          </Text>
        )}

        {userStatus.status === "awaiting_payment" && userStatus.paymentLink && (
          <Pressable
            style={styles.payButton}
            onPress={() => {
              if (typeof window !== "undefined") {
                window.open(userStatus.paymentLink, "_blank");
              }
            }}
          >
            <Text style={styles.payButtonText}>Continuer l'abonnement →</Text>
          </Pressable>
        )}
      </View>

      {/* Next Call Card */}
      {userStatus.nextCallScheduled && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Prochain appel</Text>
          <Text style={styles.cardValue}>
            {new Date(userStatus.nextCallScheduled).toLocaleString("fr-FR", {
              weekday: "long",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>
      )}

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{userStatus.totalCalls}</Text>
          <Text style={styles.statLabel}>Appels</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{userStatus.preferredTime}</Text>
          <Text style={styles.statLabel}>Heure préférée</Text>
        </View>
      </View>

      {/* Persona */}
      {userStatus.persona && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Votre compagnon</Text>
          <Text style={styles.cardValue}>
            {userStatus.persona === "coach" && "💪 Coach"}
            {userStatus.persona === "mentor" && "🎓 Mentor"}
            {userStatus.persona === "companion" && "🧓 Compagnon"}
            {userStatus.persona === "friend" && "🫂 Ami"}
          </Text>
        </View>
      )}

      {/* Refresh Button */}
      <Pressable style={styles.refreshButton} onPress={handleRefresh}>
        <Text style={styles.refreshText}>🔄 Actualiser</Text>
      </Pressable>
    </ScrollView>
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

  // Dashboard styles
  dashboardContainer: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 60,
    backgroundColor: "#f5f5f5",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  greeting: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  logoutButton: {
    padding: 8,
  },
  logoutText: {
    color: "#6b7280",
    fontSize: 14,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#e0e0e0",
  },
  cardEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  cardSubtitle: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  cardLabel: {
    fontSize: 12,
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  statsRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
  },
  statValue: {
    fontSize: 28,
    fontWeight: "700",
    color: "#2563eb",
  },
  statLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
  },
  payButton: {
    marginTop: 16,
    backgroundColor: "#f59e0b",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  payButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  refreshButton: {
    alignItems: "center",
    padding: 12,
    marginTop: 8,
  },
  refreshText: {
    color: "#6b7280",
    fontSize: 14,
  },
});
