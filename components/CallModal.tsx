import { useEffect, useRef, useCallback } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
  ScrollView,
} from "react-native";
import { useDiplerSocket } from "@/hooks/useDiplerSocket";
import { useAudioStream } from "@/hooks/useAudioStream";

// ============================================
// Types
// ============================================

interface CallModalProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly apiToken: string;
  readonly agentId: string;
  readonly userIdForMemory?: string;
}

// ============================================
// CallModal Component
// ============================================

export function CallModal({
  visible,
  onClose,
  apiToken,
  agentId,
  userIdForMemory,
}: CallModalProps) {
  const scrollViewRef = useRef<ScrollView | null>(null);
  
  // Ref to store sendAudio function for the audio stream callback
  const sendAudioRef = useRef<((data: ArrayBuffer) => void) | null>(null);

  // ========================================
  // Dipler Socket Hook (initialized first to get sendAudio)
  // ========================================
  const {
    connectionState,
    messages,
    error: socketError,
    connect,
    disconnect,
    hangUp,
    sendAudio,
  } = useDiplerSocket({
    apiToken,
    agentId,
    userIdForMemory,
    onAudioReceived: (audioBuffer) => {
      // Will be set up after useAudioStream
      playAudioRef.current?.(audioBuffer);
    },
    onSessionStarted: () => {
      // Audio stream is ready, nothing extra needed
    },
    onSessionEnded: () => {
      cleanupAudioRef.current?.();
      onClose();
    },
  });

  // Update ref when sendAudio changes
  sendAudioRef.current = sendAudio;

  // Refs for audio functions (to avoid stale closures in useDiplerSocket)
  const playAudioRef = useRef<((buffer: ArrayBuffer) => void) | null>(null);
  const cleanupAudioRef = useRef<(() => void) | null>(null);

  // ========================================
  // Audio Stream Hook - with callback to send to socket
  // ========================================
  const {
    isRecording,
    error: audioError,
    startRecording,
    stopRecording,
    playAudio,
    cleanup: cleanupAudio,
  } = useAudioStream({
    onAudioData: useCallback((audioData: ArrayBuffer) => {
      // Send mic audio to WebSocket
      sendAudioRef.current?.(audioData);
    }, []),
  });

  // Update refs for cross-hook communication
  playAudioRef.current = playAudio;
  cleanupAudioRef.current = cleanupAudio;

  // Combined error
  const error = socketError || audioError;

  // Derive call state from connection + recording
  const callState = connectionState === "connected" && isRecording
    ? "active"
    : connectionState === "connecting"
    ? "connecting"
    : connectionState === "error"
    ? "error"
    : "idle";

  // ========================================
  // Start Call Flow
  // ========================================
  const handleStartCall = useCallback(async () => {
    if (Platform.OS !== "web") return;

    try {
      // Start audio first, then connect socket
      await startRecording();
      connect();
    } catch (err) {
      console.error("[CallModal] Failed to start call:", err);
    }
  }, [startRecording, connect]);

  // ========================================
  // Forward audio from mic to socket
  // ========================================
  useEffect(() => {
    if (!isRecording || connectionState !== "connected") return;

    // The audio stream hook already handles forwarding via onAudioData
    // We need to reconnect it when connection is ready
  }, [isRecording, connectionState, sendAudio]);

  // Patch: Forward audio when recording starts
  // This is handled inside useAudioStream via the onAudioData callback
  // But we need to update it when socket is ready
  const audioRef = useRef<((data: ArrayBuffer) => void) | null>(null);
  audioRef.current = sendAudio;

  // ========================================
  // Cleanup on visibility change
  // ========================================
  useEffect(() => {
    if (!visible) {
      stopRecording();
      disconnect();
      cleanupAudio();
    }
  }, [visible, stopRecording, disconnect, cleanupAudio]);

  // ========================================
  // Auto-start call when modal opens
  // ========================================
  useEffect(() => {
    if (visible && callState === "idle" && connectionState === "idle") {
      handleStartCall();
    }
  }, [visible, callState, connectionState, handleStartCall]);

  // ========================================
  // Hang Up Handler
  // ========================================
  const handleHangUp = useCallback(() => {
    hangUp();
    stopRecording();
  }, [hangUp, stopRecording]);

  const handleClose = useCallback(() => {
    if (callState === "active") {
      handleHangUp();
    } else {
      disconnect();
      cleanupAudio();
      onClose();
    }
  }, [callState, handleHangUp, disconnect, cleanupAudio, onClose]);

  // ========================================
  // Render
  // ========================================
  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Call Status */}
          <View style={styles.statusContainer}>
            {callState === "connecting" && (
              <>
                <ActivityIndicator size="large" color="#22c55e" />
                <Text style={styles.statusText}>Connexion en cours...</Text>
              </>
            )}

            {callState === "active" && (
              <>
                <Text style={styles.callEmoji}>📞</Text>
                <Text style={styles.statusText}>Appel en cours</Text>
                <View style={styles.pulseIndicator} />
              </>
            )}

            {callState === "error" && (
              <Text style={styles.errorText}>{error}</Text>
            )}
          </View>

          {/* Messages Display */}
          {callState === "active" && messages.length > 0 && (
            <ScrollView
              ref={scrollViewRef}
              style={styles.messagesContainer}
              contentContainerStyle={styles.messagesContent}
              onContentSizeChange={() =>
                scrollViewRef.current?.scrollToEnd({ animated: true })
              }
            >
              {messages.map((msg) => (
                <View
                  key={msg.id}
                  style={[
                    styles.messageRow,
                    msg.role === "user"
                      ? styles.userMessageRow
                      : styles.assistantMessageRow,
                  ]}
                >
                  <View
                    style={[
                      styles.messageBubble,
                      msg.role === "user"
                        ? styles.userBubble
                        : styles.assistantBubble,
                    ]}
                  >
                    <Text
                      style={[
                        styles.messageText,
                        msg.role === "user"
                          ? styles.userMessageText
                          : styles.assistantMessageText,
                      ]}
                    >
                      {msg.content}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Hangup Button */}
          {(callState === "active" || callState === "connecting") && (
            <Pressable style={styles.hangupButton} onPress={handleHangUp}>
              <Text style={styles.hangupEmoji}>📵</Text>
              <Text style={styles.hangupText}>Raccrocher</Text>
            </Pressable>
          )}

          {/* Close button for errors */}
          {error && (
            <Pressable style={styles.closeButton} onPress={handleClose}>
              <Text style={styles.closeButtonText}>Fermer</Text>
            </Pressable>
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
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  modal: {
    backgroundColor: "#1a1a1a",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    minWidth: 280,
    maxWidth: 320,
  },
  statusContainer: {
    alignItems: "center",
    marginBottom: 32,
  },
  callEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  statusText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    marginTop: 16,
  },
  pulseIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#22c55e",
    marginTop: 16,
  },
  errorText: {
    fontSize: 14,
    color: "#ef4444",
    textAlign: "center",
    marginTop: 8,
  },
  hangupButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#dc2626",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 50,
    gap: 12,
  },
  hangupEmoji: {
    fontSize: 24,
  },
  hangupText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  closeButton: {
    marginTop: 16,
    padding: 12,
  },
  closeButtonText: {
    color: "#9ca3af",
    fontSize: 16,
  },
  messagesContainer: {
    width: "100%",
    maxHeight: 200,
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: "#262626",
  },
  messagesContent: {
    padding: 12,
    gap: 8,
  },
  messageRow: {
    width: "100%",
  },
  userMessageRow: {
    alignItems: "flex-end",
  },
  assistantMessageRow: {
    alignItems: "flex-start",
  },
  messageBubble: {
    maxWidth: "85%",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  userBubble: {
    backgroundColor: "#2563eb",
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: "#404040",
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  userMessageText: {
    color: "#fff",
  },
  assistantMessageText: {
    color: "#e5e5e5",
  },
});
