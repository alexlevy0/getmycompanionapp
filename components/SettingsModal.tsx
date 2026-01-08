import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Alert,
} from "react-native";
import { useState, useEffect } from "react";
import { CallModal } from "./CallModal";

interface SettingsModalProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly currentSettings: {
    preferredTime: string;
  };
  readonly onUpdate: (result: { preferredTime: string }) => Promise<void>;
}

export function SettingsModal({
  visible,
  onClose,
  currentSettings,
  onUpdate,
}: SettingsModalProps) {
  const [preferredTime, setPreferredTime] = useState(currentSettings.preferredTime);
  const [loading, setLoading] = useState(false);
  const [showCallModal, setShowCallModal] = useState(false);
  const [diplerConfig, setDiplerConfig] = useState<{ apiToken: string; agentId: string } | null>(null);

  useEffect(() => {
    if (visible) {
      setPreferredTime(currentSettings.preferredTime);
      // Fetch Dipler config
      fetchDiplerConfig();
    }
  }, [visible, currentSettings]);

  const fetchDiplerConfig = async () => {
    try {
      const response = await fetch("/api/dipler-config");
      if (response.ok) {
        const config = await response.json();
        setDiplerConfig(config);
      }
    } catch (err) {
      console.error("Failed to fetch Dipler config:", err);
    }
  };

  const validateTime = (time: string) => {
    return /^([01]?\d|2[0-3]):[0-5]\d$/.test(time);
  };

  const handleSave = async () => {
    if (!validateTime(preferredTime)) {
      Alert.alert("Erreur", "L'heure doit être au format HH:mm (ex: 09:30).");
      return;
    }

    setLoading(true);
    try {
      await onUpdate({ preferredTime });
      onClose();
    } catch {
      Alert.alert("Erreur", "Impossible de mettre à jour les réglages.");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestCall = () => {
    if (!diplerConfig) {
      Alert.alert("Erreur", "Configuration d'appel non disponible.");
      return;
    }
    setShowCallModal(true);
  };

  const handleCallModalClose = () => {
    setShowCallModal(false);
  };

  return (
    <>
      <Modal
        animationType="slide"
        transparent={true}
        visible={visible && !showCallModal}
        onRequestClose={onClose}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Réglages</Text>
              <Pressable onPress={onClose} disabled={loading}>
                <Text style={styles.closeButton}>Fermer</Text>
              </Pressable>
            </View>

            {/* Call Me Now Button */}
            <Pressable
              style={[styles.callButton, !diplerConfig && styles.callButtonDisabled]}
              onPress={handleRequestCall}
              disabled={!diplerConfig || loading}
            >
              <Text style={styles.callButtonEmoji}>📞</Text>
              <Text style={styles.callButtonText}>M'appeler maintenant</Text>
            </Pressable>

            <View style={styles.divider} />

            <Text style={styles.sectionTitle}>Heure d'appel par défaut</Text>
            <TextInput
              style={styles.input}
              value={preferredTime}
              onChangeText={setPreferredTime}
              placeholder="09:00"
              keyboardType="numbers-and-punctuation"
              maxLength={5}
            />
            <Text style={styles.helperText}>Format : HH:mm (ex: 18:30)</Text>

            <Pressable
              style={[styles.saveButton, loading && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Enregistrer</Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Call Modal */}
      {diplerConfig && (
        <CallModal
          visible={showCallModal}
          onClose={handleCallModalClose}
          apiToken={diplerConfig.apiToken}
          agentId={diplerConfig.agentId}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  closeButton: {
    fontSize: 16,
    color: "#6b7280",
    fontWeight: "500",
  },
  callButton: {
    width: "100%",
    height: 64,
    backgroundColor: "#22c55e",
    borderRadius: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
    gap: 12,
  },
  callButtonDisabled: {
    backgroundColor: "#86efac",
  },
  callButtonEmoji: {
    fontSize: 24,
  },
  callButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  divider: {
    height: 1,
    backgroundColor: "#e5e7eb",
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 12,
  },
  input: {
    width: "100%",
    height: 56,
    borderWidth: 2,
    borderColor: "#e0e0e0",
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 24,
    fontWeight: "600",
    textAlign: "center",
  },
  helperText: {
    fontSize: 12,
    color: "#9ca3af",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 24,
  },
  saveButton: {
    width: "100%",
    height: 56,
    backgroundColor: "#2563eb",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  saveButtonDisabled: {
    backgroundColor: "#93c5fd",
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
});
