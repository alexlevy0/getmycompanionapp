import { useState, useRef, useCallback, useEffect } from "react";
import { Platform } from "react-native";
import { AudioPlayer } from "@/lib/audio/AudioPlayer";

// ============================================
// Types
// ============================================

export interface UseAudioStreamOptions {
  onAudioData?: (audioData: ArrayBuffer) => void;
}

export interface UseAudioStreamReturn {
  isRecording: boolean;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  playAudio: (audioBuffer: ArrayBuffer) => void;
  cleanup: () => void;
}

// ============================================
// Hook
// ============================================

export function useAudioStream({
  onAudioData,
}: UseAudioStreamOptions = {}): UseAudioStreamReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const audioPlayerRef = useRef<AudioPlayer | null>(null);

  // ========================================
  // Cleanup Resources
  // ========================================

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

    setIsRecording(false);
    setError(null);
  }, []);

  // ========================================
  // Start Recording (Microphone + AudioWorklet)
  // ========================================

  const startRecording = useCallback(async () => {
    if (Platform.OS !== "web") {
      setError("Les appels audio ne sont disponibles que sur le web");
      return;
    }

    if (isRecording) return;

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

      // 2. Create audio context
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      console.log("[AUDIO] AudioContext sample rate:", audioContext.sampleRate);

      // 3. Create audio player for playback
      audioPlayerRef.current = new AudioPlayer(audioContext);

      // 4. Load AudioWorklet
      await audioContext.audioWorklet.addModule("/audio-processor.js");

      // 5. Connect microphone to worklet
      const source = audioContext.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(audioContext, "mic-processor");
      workletNodeRef.current = workletNode;
      source.connect(workletNode);

      // 6. Forward audio data to callback
      if (onAudioData) {
        workletNode.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
          onAudioData(e.data);
        };
      }

      setIsRecording(true);
      setError(null);
    } catch (err) {
      console.error("[AUDIO] Setup error:", err);
      setError(err instanceof Error ? err.message : "Erreur d'accès au microphone");
      cleanup();
    }
  }, [isRecording, onAudioData, cleanup]);

  // ========================================
  // Stop Recording
  // ========================================

  const stopRecording = useCallback(() => {
    // Stop microphone stream only
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    // Disconnect worklet
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }

    setIsRecording(false);
  }, []);

  // ========================================
  // Play Audio
  // ========================================

  const playAudio = useCallback((audioBuffer: ArrayBuffer) => {
    if (!audioPlayerRef.current) return;

    const float32 = AudioPlayer.int16ToFloat32(audioBuffer);
    audioPlayerRef.current.play(float32);
  }, []);

  // ========================================
  // Cleanup on unmount
  // ========================================

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    isRecording,
    error,
    startRecording,
    stopRecording,
    playAudio,
    cleanup,
  };
}
