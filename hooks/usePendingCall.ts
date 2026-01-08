import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";

// ============================================
// Types
// ============================================

interface PendingCall {
  callId: string;
  firstName?: string;
  timestamp: number;
}

interface UsePendingCallReturn {
  pendingCall: PendingCall | null;
  isLoading: boolean;
  acceptCall: () => Promise<boolean>;
  declineCall: () => Promise<boolean>;
}

// ============================================
// Constants
// ============================================

const POLL_INTERVAL = 10000; // 10 seconds

// ============================================
// Notification Helper
// ============================================

async function requestNotificationPermission(): Promise<boolean> {
  if (typeof globalThis.window === "undefined" || !("Notification" in globalThis.window)) {
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }

  return false;
}

function showIncomingCallNotification(firstName?: string): Notification | null {
  if (globalThis.window === undefined || !("Notification" in globalThis.window)) {
    return null;
  }

  if (Notification.permission !== "granted") {
    return null;
  }

  const callerName = firstName || "MyCompanion";

  const notification = new Notification("📞 Appel entrant", {
    body: `${callerName} souhaite vous appeler`,
    icon: "/icon.png",
    tag: "incoming-call",
    requireInteraction: true,
  });

  // Play notification sound
  try {
    const audio = new Audio("/sounds/ringtone.mp3");
    audio.loop = true;
    audio.play().catch(() => {
      // Autoplay might be blocked
    });

    // Store audio reference for cleanup
    (notification as unknown as { _audio: HTMLAudioElement })._audio = audio;
  } catch {
    // Sound not available
  }

  return notification;
}

// ============================================
// Hook
// ============================================

export function usePendingCall(): UsePendingCallReturn {
  const { token } = useAuth();
  const [pendingCall, setPendingCall] = useState<PendingCall | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const notificationRef = useRef<Notification | null>(null);
  const lastCallIdRef = useRef<string | null>(null);

  // ========================================
  // Request notification permission on mount
  // ========================================
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // ========================================
  // Check for pending call
  // ========================================
  const checkPendingCall = useCallback(async () => {
    if (!token) return;

    try {
      const response = await fetch("/api/pending-call", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) return;

      const data = await response.json();

      if (data.hasPendingCall) {
        const newCall = {
          callId: data.callId,
          firstName: data.firstName,
          timestamp: data.timestamp,
        };

        setPendingCall(newCall);

        // Show notification only for new calls
        if (lastCallIdRef.current !== newCall.callId) {
          lastCallIdRef.current = newCall.callId;
          notificationRef.current = showIncomingCallNotification(newCall.firstName);
        }
      } else {
        setPendingCall(null);
        closeNotification();
      }
    } catch (error) {
      console.error("[usePendingCall] Check error:", error);
    }
  }, [token]);

  // ========================================
  // Close notification helper
  // ========================================
  const closeNotification = useCallback(() => {
    if (notificationRef.current) {
      // Stop sound
      const audio = (notificationRef.current as unknown as { _audio?: HTMLAudioElement })._audio;
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
      notificationRef.current.close();
      notificationRef.current = null;
    }
    lastCallIdRef.current = null;
  }, []);

  // ========================================
  // Accept call
  // ========================================
  const acceptCall = useCallback(async (): Promise<boolean> => {
    if (!token || !pendingCall) return false;

    setIsLoading(true);
    closeNotification();

    try {
      const response = await fetch("/api/pending-call", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "accept",
          callId: pendingCall.callId,
        }),
      });

      if (response.ok) {
        setPendingCall(null);
        return true;
      }
      return false;
    } catch (error) {
      console.error("[usePendingCall] Accept error:", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [token, pendingCall, closeNotification]);

  // ========================================
  // Decline call
  // ========================================
  const declineCall = useCallback(async (): Promise<boolean> => {
    if (!token || !pendingCall) return false;

    setIsLoading(true);
    closeNotification();

    try {
      const response = await fetch("/api/pending-call", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "decline",
          callId: pendingCall.callId,
        }),
      });

      if (response.ok) {
        setPendingCall(null);
        return true;
      }
      return false;
    } catch (error) {
      console.error("[usePendingCall] Decline error:", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [token, pendingCall, closeNotification]);

  // ========================================
  // Polling setup
  // ========================================
  useEffect(() => {
    if (!token) {
      setPendingCall(null);
      closeNotification();
      return;
    }

    // Initial check
    checkPendingCall();

    // Set up polling
    intervalRef.current = setInterval(checkPendingCall, POLL_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      closeNotification();
    };
  }, [token, checkPendingCall, closeNotification]);

  return {
    pendingCall,
    isLoading,
    acceptCall,
    declineCall,
  };
}
