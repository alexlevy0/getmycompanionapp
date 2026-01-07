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
import { PERSONAS } from "@/constants/personas";
import type { Persona } from "@/types";

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  currentSettings: {
    preferredTime: string;
    persona?: string;
  };
  onUpdate: (result: { preferredTime: string; persona: string }) => Promise<void>;
}

export function SettingsModal({
  visible,
  onClose,
  currentSettings,
  onUpdate,
}: SettingsModalProps) {
  const [preferredTime, setPreferredTime] = useState(currentSettings.preferredTime);
  const [selectedPersona, setSelectedPersona] = useState<string>(
    currentSettings.persona || "friend"
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setPreferredTime(currentSettings.preferredTime);
      setSelectedPersona(currentSettings.persona || "friend");
    }
  }, [visible, currentSettings]);

  const validateTime = (time: string) => {
    return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
  };

  const handleSave = async () => {
    if (!validateTime(preferredTime)) {
      Alert.alert("Erreur", "L'heure doit être au format HH:mm (ex: 09:30).");
      return;
    }

    setLoading(true);
    try {
      await onUpdate({
        preferredTime,
        persona: selectedPersona,
      });
      onClose();
    } catch (error) {
      Alert.alert("Erreur", "Impossible de mettre à jour les réglages.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
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

          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
            Votre Compagnon
          </Text>
          <View style={styles.personasGrid}>
            {Object.entries(PERSONAS).map(([key, config]) => {
              const isSelected = key === selectedPersona;
              return (
                <Pressable
                  key={key}
                  style={[
                    styles.personaCard,
                    isSelected && styles.personaCardSelected,
                  ]}
                  onPress={() => setSelectedPersona(key)}
                  disabled={loading}
                >
                  <Text style={styles.personaEmoji}>{config.emoji}</Text>
                  <Text
                    style={[
                      styles.personaName,
                      isSelected && styles.personaNameSelected,
                    ]}
                  >
                    {config.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>

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
    marginBottom: 32,
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
  },
  personasGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 32,
  },
  personaCard: {
    width: "48%", // Allow 2 per row with gap
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  personaCardSelected: {
    borderColor: "#2563eb",
    backgroundColor: "#eff6ff",
  },
  personaEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  personaName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#4b5563",
  },
  personaNameSelected: {
    color: "#2563eb",
    fontWeight: "700",
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
