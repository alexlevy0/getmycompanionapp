import { View, Text, Pressable, StyleSheet } from "react-native";
import type { UserStatus } from "@/types";

interface PersonaCardProps {
  persona: UserStatus["persona"];
  onModify: () => void;
}

export function PersonaCard({ persona, onModify }: PersonaCardProps) {
  if (!persona) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>Votre compagnon</Text>
      <Text style={styles.cardValue}>
        {persona === "coach" && "💪 Coach"}
        {persona === "mentor" && "🎓 Mentor"}
        {persona === "companion" && "🧓 Compagnon"}
        {persona === "friend" && "🫂 Ami"}
      </Text>
      <Pressable onPress={onModify} style={styles.cardActionLink}>
        <Text style={styles.cardActionLinkText}>Modifier</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#e0e0e0",
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
  cardActionLink: {
    marginTop: 8,
    alignSelf: "flex-start",
  },
  cardActionLinkText: {
    color: "#2563eb",
    fontWeight: "600",
    fontSize: 14,
  },
});
