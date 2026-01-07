import { useState } from "react";
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

export default function HomeScreen() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const isValid = phone.replace(/\s/g, "").length >= 10;

  const handleSubmit = async () => {
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

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <View style={styles.container}>
        <Text style={styles.emoji}>📞</Text>
        <Text style={styles.title}>C'est parti !</Text>
        <Text style={styles.subtitle}>
          Notre agent d'accueil va vous appeler dans quelques instants.
          {"\n\n"}
          Il vous aidera à configurer votre compagnon idéal !
        </Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>3 appels gratuits</Text>
        </View>
      </View>
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
        onPress={handleSubmit}
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
  badge: {
    marginTop: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#dcfce7",
    borderRadius: 20,
  },
  badgeText: {
    color: "#166534",
    fontWeight: "600",
  },
});
