import { View, Text, Pressable, StyleSheet } from "react-native";
import type { UserStatus } from "@/types";

interface StatusCardProps {
  status: UserStatus;
  trialCallsRemaining: number;
  paymentLink?: string;
  onOpenPaymentLink: (url: string) => void;
}

const STATUS_CONFIG: Record<string, { emoji: string; label: string; color: string }> = {
  onboarding: { emoji: "📞", label: "Configuration en cours", color: "#3b82f6" },
  trial: { emoji: "🎁", label: "Période d'essai", color: "#8b5cf6" },
  active: { emoji: "✅", label: "Abonnement actif", color: "#22c55e" },
  awaiting_payment: { emoji: "💳", label: "Paiement requis", color: "#f59e0b" },
  paused: { emoji: "⏸️", label: "En pause", color: "#6b7280" },
  churned: { emoji: "👋", label: "Abonnement terminé", color: "#ef4444" },
};

export function StatusCard({ status, trialCallsRemaining, paymentLink, onOpenPaymentLink }: StatusCardProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.trial;

  return (
    <View style={[styles.card, { borderLeftColor: config.color }]}>
      <Text style={styles.cardEmoji}>{config.emoji}</Text>
      <Text style={styles.cardTitle}>{config.label}</Text>

      {status === "trial" && (
        <Text style={styles.cardSubtitle}>
          {trialCallsRemaining} appel{trialCallsRemaining > 1 ? "s" : ""} gratuit{trialCallsRemaining > 1 ? "s" : ""} restant{trialCallsRemaining > 1 ? "s" : ""}
        </Text>
      )}

      {status === "awaiting_payment" && paymentLink && (
        <Pressable
          style={styles.payButton}
          onPress={() => onOpenPaymentLink(paymentLink)}
        >
          <Text style={styles.payButtonText}>Continuer l'abonnement →</Text>
        </Pressable>
      )}
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
  cardEmoji: { fontSize: 32, marginBottom: 8 },
  cardTitle: { fontSize: 20, fontWeight: "600", color: "#1a1a1a" },
  cardSubtitle: { fontSize: 14, color: "#666", marginTop: 4 },
  payButton: { marginTop: 16, backgroundColor: "#f59e0b", borderRadius: 8, padding: 12, alignItems: "center" },
  payButtonText: { color: "#fff", fontWeight: "600" },
});
