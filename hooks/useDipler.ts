import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";

interface DiplerConfig {
  apiToken: string;
  agentId: string;
  userIdForMemory?: string;
}

export const useDipler = () => {
  const { token } = useAuth();
  const [config, setConfig] = useState<DiplerConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    if (!token) {
      setConfig(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const res = await fetch("/api/dipler-config", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        if (res.status === 429) throw new Error("Trop de requêtes. Veuillez patienter.");
        throw new Error("Erreur de connexion au service vocal.");
      }

      const data = await res.json();
      setConfig(data);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  return {
    diplerConfig: config,
    isLoading,
    error,
    refreshConfig: fetchConfig,
  };
};
