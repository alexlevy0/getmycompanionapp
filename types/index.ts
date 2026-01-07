export type Persona = "companion" | "coach" | "mentor" | "friend";

export type UserStatus = "trial" | "active" | "paused" | "churned";

export interface UserMetadata {
  phone: string;
  persona: Persona;
  first_name?: string;

  preferred_time: string;
  preferred_days: string;
  timezone: string;

  status: UserStatus;
  trial_calls_remaining: string;

  total_calls: string;
  last_call_date?: string;
  last_call_summary?: string;

  // Persona-specific
  goals?: string;
  habits_streak?: string;
  family_contact_phone?: string;
  family_contact_name?: string;

  // Scheduling
  next_call_scheduled?: string;
  qstash_message_id?: string;
  consecutive_no_answer: string;
}

export interface DiplerWebhookPayload {
  call_id: string;
  phone: string;
  customer_id: string;
  duration_seconds: number;
  status: "completed" | "failed" | "no_answer";
  summary?: string;
  extracted_data?: {
    preferred_time?: string;
    preferred_days?: string;
    first_name?: string;
    goals?: string;
  };
}
