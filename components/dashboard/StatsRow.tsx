import { View, Text, StyleSheet } from "react-native";

interface StatsRowProps {
  totalCalls: number;
  preferredTime: string;
}

export function StatsRow({ totalCalls, preferredTime }: StatsRowProps) {
  return (
    <View style={styles.statsRow}>
      <View style={styles.statCard}>
        <Text style={styles.statValue}>{totalCalls}</Text>
        <Text style={styles.statLabel}>Appels</Text>
      </View>
      <View style={styles.statCard}>
        <Text style={styles.statValue}>{preferredTime}</Text>
        <Text style={styles.statLabel}>Heure préférée</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
});
