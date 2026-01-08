import { useState, useRef, useCallback, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
} from "react-native";

// ============================================
// Types
// ============================================

type CallState = "idle" | "connecting" | "active" | "ending";

interface CallModalProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly apiToken: string;
  readonly agentId: string;
}

// ============================================
// Audio Player Class for smooth playback
// ============================================

class AudioPlayer {
  private audioContext: AudioContext;
  private sampleRate = 24000;
  private bufferQueue: Float32Array[] = [];
  private isPlaying = false;
  private nextStartTime = 0;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
  }

  play(samples: Float32Array) {
    this.bufferQueue.push(samples);
    this.scheduleBuffers();
  }

  private scheduleBuffers() {
    if (this.bufferQueue.length === 0) {
      this.isPlaying = false;
      return;
    }

    const currentTime = this.audioContext.currentTime;
    
    // Initialize start time if not playing
    if (!this.isPlaying || this.nextStartTime < currentTime) {
      this.nextStartTime = currentTime + 0.05; // 50ms buffer
      this.isPlaying = true;
    }

    // Schedule all pending buffers
    while (this.bufferQueue.length > 0) {
      const samples = this.bufferQueue.shift()!;
      
      // Create audio buffer
      const audioBuffer = this.audioContext.createBuffer(1, samples.length, this.sampleRate);
      audioBuffer.getChannelData(0).set(samples);
      
      // Create source and connect
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);
      
      // Schedule playback
      source.start(this.nextStartTime);
      
      // Update next start time
      this.nextStartTime += samples.length / this.sampleRate;
    }
  }

  stop() {
    this.bufferQueue = [];
    this.isPlaying = false;
  }
}

// ============================================
// CallModal Component
// ============================================

export function CallModal({
  visible,
  onClose,
  apiToken,
  agentId,
}: CallModalProps) {
  const [callState, setCallState] = useState<CallState>("idle");
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const audioPlayerRef = useRef<AudioPlayer | null>(null);

  // Cleanup on unmount or close
  useEffect(() => {
    if (!visible) {
      cleanup();
    }
  }, [visible]);

  const cleanup = useCallback(() => {
    // Stop audio player
    if (audioPlayerRef.current) {
      audioPlayerRef.current.stop();
      audioPlayerRef.current = null;
    }

    // Stop microphone
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    // Disconnect worklet
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Close WebSocket
    if (socketRef.current) {
      if (socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.close();
      }
      socketRef.current = null;
    }

    setCallState("idle");
    setError(null);
  }, []);

  const queueAudioChunk = useCallback((arrayBuffer: ArrayBuffer) => {
    if (!audioPlayerRef.current) return;
    
    // Convert Int16 to Float32
    const int16Array = new Int16Array(arrayBuffer);
    const float32 = new Float32Array(int16Array.length);
    
    for (let i = 0; i < int16Array.length; i++) {
      float32[i] = int16Array[i] / 32768;
    }
    
    audioPlayerRef.current.play(float32);
  }, []);

  const handleStartCall = useCallback(async () => {
    if (Platform.OS !== "web") {
      setError("Les appels audio ne sont disponibles que sur le web");
      return;
    }

    setCallState("connecting");
    setError(null);

    try {
      // 1. Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // 2. Create audio context (use default sample rate to match microphone)
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      
      console.log("[DIPLER] AudioContext sample rate:", audioContext.sampleRate);
      
      // 3. Create audio player for smooth playback
      audioPlayerRef.current = new AudioPlayer(audioContext);

      // 4. Load AudioWorklet
      await audioContext.audioWorklet.addModule("/audio-processor.js");

      // 5. Connect microphone to worklet
      const source = audioContext.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(audioContext, "mic-processor");
      workletNodeRef.current = workletNode;
      source.connect(workletNode);

      // 6. Connect to Dipler WebSocket
      const wsUrl = `wss://dipler-backend-203319928451.europe-west9.run.app/stream?mode=web&apiToken=${apiToken}`;
      const socket = new WebSocket(wsUrl);
      socket.binaryType = "arraybuffer";
      socketRef.current = socket;

      // 7. Handle WebSocket events
      socket.onopen = () => {
        console.log("[DIPLER] WebSocket connected");
      };

      socket.onmessage = (event) => {
        // Binary audio data
        if (event.data instanceof ArrayBuffer) {
          queueAudioChunk(event.data);
          return;
        }

        // JSON messages
        try {
          const data = JSON.parse(event.data);
          console.log("[DIPLER] Event:", data.type);

          switch (data.type) {
            case "ready":
              // Send start message
              socket.send(JSON.stringify({
                type: "start",
                agentId,
              }));
              break;

            case "sessionStarted":
              setCallState("active");
              // Start sending microphone audio
              workletNode.port.onmessage = (e) => {
                if (socket.readyState === WebSocket.OPEN) {
                  socket.send(e.data);
                }
              };
              break;

            case "hungUp":
              console.log("[DIPLER] Call ended");
              cleanup();
              onClose();
              break;

            case "error":
              console.error("[DIPLER] Error:", data.error);
              setError(data.error);
              cleanup();
              break;
          }
        } catch (err) {
          console.error("[DIPLER] Parse error:", err);
        }
      };

      socket.onerror = (err) => {
        console.error("[DIPLER] WebSocket error:", err);
        setError("Erreur de connexion");
        cleanup();
      };

      socket.onclose = () => {
        console.log("[DIPLER] WebSocket closed");
        if (callState === "active") {
          cleanup();
        }
      };

    } catch (err) {
      console.error("[DIPLER] Setup error:", err);
      setError(err instanceof Error ? err.message : "Erreur de connexion");
      cleanup();
    }
  }, [apiToken, agentId, queueAudioChunk, cleanup, onClose, callState]);

  const handleHangUp = useCallback(() => {
    setCallState("ending");
    
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "hangUp" }));
    } else {
      cleanup();
      onClose();
    }
  }, [cleanup, onClose]);

  const handleClose = useCallback(() => {
    if (callState === "active") {
      handleHangUp();
    } else {
      cleanup();
      onClose();
    }
  }, [callState, handleHangUp, cleanup, onClose]);

  // Auto-start call when modal opens
  useEffect(() => {
    if (visible && callState === "idle") {
      handleStartCall();
    }
  }, [visible, callState, handleStartCall]);

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

            {callState === "ending" && (
              <>
                <ActivityIndicator size="large" color="#6b7280" />
                <Text style={styles.statusText}>Fin de l'appel...</Text>
              </>
            )}

            {error && (
              <Text style={styles.errorText}>{error}</Text>
            )}
          </View>

          {/* Hangup Button */}
          {(callState === "active" || callState === "connecting") && (
            <Pressable
              style={styles.hangupButton}
              onPress={handleHangUp}
            >
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
});
