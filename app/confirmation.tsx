import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { PERSONAS } from "../constants/personas";
import { Persona } from "../types";

export default function ConfirmationScreen() {
  const { phone, persona } = useLocalSearchParams<{
    phone: string;
    persona: Persona;
  }>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const personaConfig = PERSONAS[persona];

  useEffect(() => {
    startTrial();
  }, []);

  const startTrial = async () => {
    try {
      const response = await fetch("/api/start-trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, persona }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Une erreur est survenue");
      }

      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Préparation de votre appel...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.emoji}>😕</Text>
        <Text style={styles.title}>Oups</Text>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>{personaConfig?.emoji || "📞"}</Text>
      <Text style={styles.title}>C'est parti !</Text>
      <Text style={styles.subtitle}>
        Votre {personaConfig?.name.toLowerCase() || "compagnon"} va vous appeler
        dans quelques instants.
        {"\n\n"}
        Décrochez, c'est le début d'une belle aventure !
      </Text>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>3 appels gratuits</Text>
      </View>
    </View>
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
    fontSize: 80,
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    marginBottom: 16,
    color: "#1a1a1a",
  },
  subtitle: {
    fontSize: 18,
    color: "#666",
    textAlign: "center",
    lineHeight: 26,
    marginBottom: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
  },
  error: {
    fontSize: 16,
    color: "#dc2626",
    textAlign: "center",
  },
  badge: {
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
