import { View, Text, StyleSheet } from "react-native";

interface NextCallCardProps {
  scheduledDate: string;
}

export function NextCallCard({ scheduledDate }: NextCallCardProps) {
  if (!scheduledDate) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>Prochain appel</Text>
      <Text style={styles.cardValue}>
        {new Date(scheduledDate).toLocaleString("fr-FR", {
          weekday: "long",
          day: "numeric",
          month: "long",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </Text>
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
});
