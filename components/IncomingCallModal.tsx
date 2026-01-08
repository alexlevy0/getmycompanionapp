import { useEffect, useRef } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
} from "react-native";

// ============================================
// Types
// ============================================

interface IncomingCallModalProps {
  readonly visible: boolean;
  readonly callerName?: string;
  readonly onAccept: () => void;
  readonly onDecline: () => void;
  readonly isLoading?: boolean;
}

// ============================================
// Component
// ============================================

export function IncomingCallModal({
  visible,
  callerName,
  onAccept,
  onDecline,
  isLoading = false,
}: IncomingCallModalProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ringAnim = useRef(new Animated.Value(0)).current;

  // ========================================
  // Animations
  // ========================================
  useEffect(() => {
    if (!visible) return;

    // Pulse animation for the call icon
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    // Ring animation
    const ring = Animated.loop(
      Animated.sequence([
        Animated.timing(ringAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(ringAnim, {
          toValue: -1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(ringAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ])
    );

    pulse.start();
    ring.start();

    return () => {
      pulse.stop();
      ring.stop();
    };
  }, [visible, pulseAnim, ringAnim]);

  const ringRotation = ringAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ["-15deg", "0deg", "15deg"],
  });

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onDecline}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Caller Info */}
          <Animated.View
            style={[
              styles.iconContainer,
              {
                transform: [
                  { scale: pulseAnim },
                  { rotate: ringRotation },
                ],
              },
            ]}
          >
            <Text style={styles.callIcon}>📞</Text>
          </Animated.View>

          <Text style={styles.title}>Appel entrant</Text>
          <Text style={styles.callerName}>
            {callerName ? `De ${callerName}` : "MyCompanion"}
          </Text>
          <Text style={styles.subtitle}>souhaite vous appeler</Text>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <Pressable
              style={[styles.button, styles.declineButton]}
              onPress={onDecline}
              disabled={isLoading}
            >
              <Text style={styles.buttonEmoji}>❌</Text>
              <Text style={styles.buttonText}>Refuser</Text>
            </Pressable>

            <Pressable
              style={[styles.button, styles.acceptButton]}
              onPress={onAccept}
              disabled={isLoading}
            >
              <Text style={styles.buttonEmoji}>✅</Text>
              <Text style={styles.buttonText}>Décrocher</Text>
            </Pressable>
          </View>

          {isLoading && (
            <Text style={styles.loadingText}>Traitement...</Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ============================================
// Styles
// ============================================

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.85)",
  },
  modal: {
    backgroundColor: "#1a1a1a",
    borderRadius: 24,
    padding: 40,
    alignItems: "center",
    minWidth: 300,
    maxWidth: 350,
    borderWidth: 2,
    borderColor: "#22c55e",
  },
  iconContainer: {
    marginBottom: 24,
  },
  callIcon: {
    fontSize: 80,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 8,
  },
  callerName: {
    fontSize: 20,
    fontWeight: "600",
    color: "#22c55e",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: "#9ca3af",
    marginBottom: 32,
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 20,
  },
  button: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    minWidth: 100,
  },
  acceptButton: {
    backgroundColor: "#22c55e",
  },
  declineButton: {
    backgroundColor: "#dc2626",
  },
  buttonEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  buttonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  loadingText: {
    marginTop: 16,
    color: "#9ca3af",
    fontSize: 14,
  },
});
