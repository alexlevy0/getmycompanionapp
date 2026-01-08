import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { CallModal } from "@/components/CallModal";

interface LoginScreenProps {
  diplerConfig: {
    apiToken: string;
    agentId: string;
    userIdForMemory?: string;
  } | null;
}

export const LoginScreen = ({ diplerConfig }: LoginScreenProps) => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [showCallModal, setShowCallModal] = useState(false);

  const handleRequestMagicLink = async () => {
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/request-magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erreur d'envoi");
      }

      setMagicLinkSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  // Magic link sent confirmation
  if (magicLinkSent) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Text style={styles.emoji}>✉️</Text>
        <Text style={styles.title}>Email envoyé !</Text>
        <Text style={styles.subtitle}>
          {"Vérifiez votre boîte mail.\nCliquez sur le lien pour vous connecter."}
        </Text>
        <Text style={styles.emailSentHint}>{email}</Text>
        
        <Pressable
          style={styles.switchModeButton}
          onPress={() => {
            setMagicLinkSent(false);
            setEmail("");
          }}
        >
          <Text style={styles.switchModeText}>Utiliser une autre adresse</Text>
        </Pressable>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <Text style={styles.emoji}>📞</Text>
      <Text style={styles.title}>MyCompanion</Text>
      <Text style={styles.subtitle}>
        {"L'IA qui t'appelle.\nChaque jour, à l'heure qui te convient."}
      </Text>

      {/* Email input */}
      <TextInput
        style={styles.input}
        placeholder="Votre adresse email"
        placeholderTextColor="#999"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
        autoFocus
      />

      <Pressable
        style={[styles.button, (!isValidEmail || loading) && styles.buttonDisabled]}
        onPress={handleRequestMagicLink}
        disabled={!isValidEmail || loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Commencer</Text>
        )}
      </Pressable>

      {/* Direct Call Button */}
      {diplerConfig && (
        <Pressable
          style={styles.callNowButton}
          onPress={() => setShowCallModal(true)}
        >
          <Text style={styles.callNowButtonText}>📞 Me faire appeler maintenant</Text>
        </Pressable>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.legal}>
        {"3 appels gratuits, sans engagement.\nEn continuant, vous acceptez nos CGU."}
      </Text>

      {/* Call Modal */}
      {diplerConfig && (
        <CallModal
          visible={showCallModal}
          onClose={() => setShowCallModal(false)}
          apiToken={diplerConfig.apiToken}
          agentId={diplerConfig.agentId}
          userIdForMemory={diplerConfig.userIdForMemory}
        />
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#fff",
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
  emailSentHint: {
    fontSize: 16,
    color: "#6b7280",
    marginTop: 16,
    fontWeight: "500",
  },
  callNowButton: {
    marginTop: 24,
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: "#22c55e",
    borderRadius: 12,
    width: "100%",
    maxWidth: 320,
    alignItems: "center",
  },
  callNowButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
