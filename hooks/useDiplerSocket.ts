import { useState, useRef, useCallback, useEffect } from "react";

// ============================================
// Types
// ============================================

export type ConnectionState = "idle" | "connecting" | "connected" | "error";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface UseDiplerSocketOptions {
  apiToken: string;
  agentId: string;
  userIdForMemory?: string;
  onAudioReceived?: (audioBuffer: ArrayBuffer) => void;
  onSessionStarted?: () => void;
  onSessionEnded?: () => void;
}

export interface UseDiplerSocketReturn {
  connectionState: ConnectionState;
  messages: Message[];
  error: string | null;
  connect: () => void;
  disconnect: () => void;
  hangUp: () => void;
  sendAudio: (audioData: ArrayBuffer) => void;
}

// ============================================
// Constants
// ============================================

const DIPLER_WS_URL = "wss://dipler-backend-203319928451.europe-west9.run.app/stream";

// ============================================
// Hook
// ============================================

export function useDiplerSocket({
  apiToken,
  agentId,
  userIdForMemory,
  onAudioReceived,
  onSessionStarted,
  onSessionEnded,
}: UseDiplerSocketOptions): UseDiplerSocketReturn {
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const isConnectingRef = useRef(false);

  // ========================================
  // Message Handlers
  // ========================================

  const handleReady = useCallback(() => {
    socketRef.current?.send(
      JSON.stringify({
        type: "start",
        agentId,
        ...(userIdForMemory && { config: { userIdForMemory } }),
      })
    );
  }, [agentId, userIdForMemory]);

  const handleSessionStarted = useCallback(() => {
    console.log("🎙️ Session démarrée");
    setConnectionState("connected");
    setMessages([]);
    onSessionStarted?.();
  }, [onSessionStarted]);

  const handleTranscription = useCallback((data: { conversation: unknown }) => {
    if (!Array.isArray(data.conversation)) {
      if (typeof data.conversation === "string") {
        setMessages((prev) => [
          ...prev,
          {
            id: `user-${Date.now()}`,
            role: "user" as const,
            content: data.conversation as string,
            timestamp: new Date(),
          },
        ]);
      }
      return;
    }

    const history: Message[] = data.conversation
      .map((msg: { role: string; text: string; timestamp?: number }, index: number) => ({
        id: `${msg.role}-${index}-${msg.timestamp || Date.now()}`,
        role: (msg.role === "model" ? "assistant" : "user") as "user" | "assistant",
        content: msg.text || "",
        timestamp: new Date(msg.timestamp || Date.now()),
      }))
      .filter((m) => m.content);

    setMessages((prev) => {
      const lastLocal = prev[prev.length - 1];
      const lastServer = history[history.length - 1];

      // Preserve streaming assistant message if server hasn't caught up
      const shouldPreserveLocal =
        lastLocal?.role === "assistant" &&
        (!lastServer || lastServer.role === "user");

      if (shouldPreserveLocal) {
        return [...history, lastLocal];
      }

      return history;
    });
  }, []);

  const handleModelSpeechStart = useCallback(() => {
    console.log("🔊 IA parle");
    setMessages((prev) => [
      ...prev,
      {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: "",
        timestamp: new Date(),
      },
    ]);
  }, []);

  const handleLLMChunk = useCallback((data: { text?: string; content?: string; delta?: string; chunk?: string }) => {
    const chunkContent = data.text || data.content || data.delta || data.chunk;
    if (!chunkContent) return;

    setMessages((prev) => {
      const lastMsg = prev[prev.length - 1];
      if (lastMsg?.role === "assistant") {
        return [
          ...prev.slice(0, -1),
          { ...lastMsg, content: lastMsg.content + chunkContent },
        ];
      }
      return [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: chunkContent,
          timestamp: new Date(),
        },
      ];
    });
  }, []);

  const handleLLMComplete = useCallback((data: { text?: string }) => {
    if (!data.text) return;

    setMessages((prev) => {
      const lastMsg = prev[prev.length - 1];
      if (lastMsg?.role === "assistant") {
        return [...prev.slice(0, -1), { ...lastMsg, content: data.text! }];
      }
      return [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: data.text!,
          timestamp: new Date(),
        },
      ];
    });
  }, []);

  const handleStats = useCallback(() => {
    console.log("📊 Session stats received");
    onSessionEnded?.();
  }, [onSessionEnded]);

  const handleError = useCallback((errorMessage: string) => {
    console.error("❌ Erreur:", errorMessage);
    setError(errorMessage);
    setConnectionState("error");
  }, []);

  // ========================================
  // WebSocket Message Router
  // ========================================

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      // Binary audio data
      if (event.data instanceof ArrayBuffer) {
        onAudioReceived?.(event.data);
        return;
      }

      // JSON messages
      try {
        const data = JSON.parse(event.data);
        console.log("[DIPLER] Event:", data);

        switch (data.type) {
          case "ready":
            handleReady();
            break;
          case "sessionStarted":
            handleSessionStarted();
            break;
          case "userSpeechStart":
            console.log("👤 Utilisateur parle");
            break;
          case "sttTranscription":
            handleTranscription(data);
            break;
          case "modelSpeechStart":
            handleModelSpeechStart();
            break;
          case "llmChunk":
            handleLLMChunk(data);
            break;
          case "llmComplete":
            handleLLMComplete(data);
            break;
          case "functionCalls":
            console.log("🔧 Function calls:", data.functionCalls);
            break;
          case "stats":
            handleStats();
            break;
          case "hungUp":
            console.log("📞 Raccrochage en cours");
            break;
          case "error":
            handleError(data.error);
            break;
        }
      } catch (err) {
        console.error("[DIPLER] Parse error:", err);
      }
    },
    [
      onAudioReceived,
      handleReady,
      handleSessionStarted,
      handleTranscription,
      handleModelSpeechStart,
      handleLLMChunk,
      handleLLMComplete,
      handleStats,
      handleError,
    ]
  );

  // ========================================
  // Connection Management
  // ========================================

  const connect = useCallback(() => {
    if (isConnectingRef.current || socketRef.current) return;

    isConnectingRef.current = true;
    setConnectionState("connecting");
    setError(null);

    const wsUrl = `${DIPLER_WS_URL}?mode=web&apiToken=${apiToken}`;
    const socket = new WebSocket(wsUrl);
    socket.binaryType = "arraybuffer";
    socketRef.current = socket;

    socket.onopen = () => {
      console.log("[DIPLER] WebSocket connected");
      isConnectingRef.current = false;
    };

    socket.onmessage = handleMessage;

    socket.onerror = (err) => {
      console.error("[DIPLER] WebSocket error:", err);
      setError("Erreur de connexion");
      setConnectionState("error");
      isConnectingRef.current = false;
    };

    socket.onclose = () => {
      console.log("[DIPLER] WebSocket closed");
      socketRef.current = null;
      isConnectingRef.current = false;
      if (connectionState === "connected") {
        setConnectionState("idle");
      }
    };
  }, [apiToken, handleMessage, connectionState]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      if (socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.close();
      }
      socketRef.current = null;
    }
    setConnectionState("idle");
    setError(null);
  }, []);

  const hangUp = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "hangUp" }));
    }
  }, []);

  const sendAudio = useCallback((audioData: ArrayBuffer) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(audioData);
    }
  }, []);

  // ========================================
  // Cleanup on unmount
  // ========================================

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connectionState,
    messages,
    error,
    connect,
    disconnect,
    hangUp,
    sendAudio,
  };
}
