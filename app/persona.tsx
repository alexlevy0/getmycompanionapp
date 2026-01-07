import { useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { PERSONAS } from "../constants/personas";
import { Persona } from "../types";

export default function PersonaScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [selected, setSelected] = useState<Persona | null>(null);

  const handleContinue = () => {
    if (selected) {
      router.push({
        pathname: "/confirmation",
        params: { phone, persona: selected },
      });
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Qui veux-tu au bout du fil ?</Text>
      <Text style={styles.subtitle}>Tu pourras changer plus tard</Text>

      <View style={styles.grid}>
        {Object.values(PERSONAS).map((p) => (
          <Pressable
            key={p.id}
            style={[styles.card, selected === p.id && styles.cardSelected]}
            onPress={() => setSelected(p.id)}
          >
            <Text style={styles.cardEmoji}>{p.emoji}</Text>
            <Text style={styles.cardName}>{p.name}</Text>
            <Text style={styles.cardDesc}>{p.description}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        style={[styles.button, !selected && styles.buttonDisabled]}
        onPress={handleContinue}
        disabled={!selected}
      >
        <Text style={styles.buttonText}>C'est parti</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 60,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
    color: "#1a1a1a",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 32,
  },
  grid: {
    gap: 16,
    marginBottom: 32,
  },
  card: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#e0e0e0",
    backgroundColor: "#fafafa",
  },
  cardSelected: {
    borderColor: "#2563eb",
    backgroundColor: "#eff6ff",
  },
  cardEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  cardName: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 4,
    color: "#1a1a1a",
  },
  cardDesc: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
  },
  button: {
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
});
