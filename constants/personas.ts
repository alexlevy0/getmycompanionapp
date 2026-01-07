import { Persona } from "../types";

interface PersonaConfig {
  id: Persona;
  name: string;
  emoji: string;
  description: string;
  diplerAgentEnvKey: string;
  defaultTime: string;
  defaultDays: string;
}

export const PERSONAS: Record<Persona, PersonaConfig> = {
  companion: {
    id: "companion",
    name: "Compagnon",
    emoji: "🧓",
    description: "Un ami bienveillant qui prend de vos nouvelles chaque jour",
    diplerAgentEnvKey: "DIPLER_AGENT_COMPANION",
    defaultTime: "10:00",
    defaultDays: "daily",
  },
  coach: {
    id: "coach",
    name: "Coach",
    emoji: "💪",
    description: "Un coach motivant pour atteindre vos objectifs",
    diplerAgentEnvKey: "DIPLER_AGENT_COACH",
    defaultTime: "07:00",
    defaultDays: "weekdays",
  },
  mentor: {
    id: "mentor",
    name: "Mentor",
    emoji: "🎓",
    description: "Un mentor qui vous pousse à réfléchir et grandir",
    diplerAgentEnvKey: "DIPLER_AGENT_MENTOR",
    defaultTime: "18:00",
    defaultDays: "mon,wed,fri",
  },
  friend: {
    id: "friend",
    name: "Ami",
    emoji: "🫂",
    description: "Un ami qui prend simplement de vos nouvelles",
    diplerAgentEnvKey: "DIPLER_AGENT_FRIEND",
    defaultTime: "19:00",
    defaultDays: "daily",
  },
};

export const TRIAL_CALLS = 3;
export const MAX_NO_ANSWER_RETRIES = 3;
