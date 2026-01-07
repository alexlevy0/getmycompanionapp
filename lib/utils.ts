import { addDays, setHours, setMinutes, setSeconds, setMilliseconds, getDay, isBefore, addHours } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { log } from "./logger";

// ============================================
// Time Validation
// ============================================

/**
 * Validates HH:mm time format.
 */
export function isValidTimeFormat(time: string): boolean {
  return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
}

// ============================================
// Phone Validation & Formatting
// ============================================

/**
 * Validates a French mobile phone number.
 * Accepts formats: 0612345678, +33612345678, 06 12 34 56 78
 */
export function validatePhone(phone: string): boolean {
  if (!phone) return false;
  const cleaned = phone.replace(/\s/g, "");
  const regex = /^(?:(?:\+33|0033|0)[67]\d{8})$/;
  return regex.test(cleaned);
}

/**
 * Formats a phone number to E.164 format (+33...).
 */
export function formatPhoneE164(phone: string): string {
  if (!phone) return "";
  const cleaned = phone.replace(/\s/g, "");

  if (cleaned.startsWith("+33")) return cleaned;
  if (cleaned.startsWith("0033")) return "+33" + cleaned.slice(4);
  if (cleaned.startsWith("0")) return "+33" + cleaned.slice(1);

  return cleaned;
}

// ============================================
// Day Mapping
// ============================================

/**
 * Maps day abbreviations to date-fns day numbers (0 = Sunday, 1 = Monday, etc.)
 */
const DAY_MAP: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

/**
 * Weekdays (Monday to Friday)
 */
const WEEKDAYS = [1, 2, 3, 4, 5];

// ============================================
// Calculate Next Call Time
// ============================================

export type PreferredDays = "daily" | "weekdays" | string;

interface CalculateNextCallTimeParams {
  preferredTime: string;      // "HH:mm" format, e.g., "09:00"
  preferredDays: PreferredDays; // "daily", "weekdays", or "mon,wed,fri"
  timezone: string;           // IANA timezone, e.g., "Europe/Paris"
  fromDate?: Date;            // Optional: calculate from this date (default: now)
}

/**
 * Calculates the next call time in UTC, respecting user's timezone and preferred days.
 * 
 * @example
 * // User in Paris wants calls at 09:00 on weekdays
 * calculateNextCallTime("09:00", "weekdays", "Europe/Paris")
 * // Returns: Date object in UTC (e.g., Monday 08:00 UTC = 09:00 Paris)
 */
export function calculateNextCallTime(
  preferredTime: string,
  preferredDays: PreferredDays,
  timezone: string,
  fromDate?: Date
): Date {
  // 1. Parse preferred time
  if (!isValidTimeFormat(preferredTime)) {
    log.error(`Invalid preferredTime: ${preferredTime}, defaulting to 10:00`);
    return calculateNextCallTime("10:00", preferredDays, timezone, fromDate);
  }

  const [hours, minutes] = preferredTime.split(":").map(Number);

  // 2. Get current time in user's timezone
  const nowUtc = fromDate || new Date();
  const nowInUserTz = toZonedTime(nowUtc, timezone);

  // 3. Parse allowed days
  const allowedDays = parsePreferredDays(preferredDays);

  // 4. Find next valid day (start from tomorrow to avoid same-day edge cases)
  let candidateDate = addDays(nowInUserTz, 1);
  let attempts = 0;
  const maxAttempts = 14; // Safety: max 2 weeks lookahead

  while (attempts < maxAttempts) {
    const dayOfWeek = getDay(candidateDate);
    
    if (allowedDays.includes(dayOfWeek)) {
      // Found a valid day
      break;
    }
    
    candidateDate = addDays(candidateDate, 1);
    attempts++;
  }

  // 5. Set the preferred time on the candidate date (in user's timezone)
  let callTimeInUserTz = setHours(candidateDate, hours);
  callTimeInUserTz = setMinutes(callTimeInUserTz, minutes);
  callTimeInUserTz = setSeconds(callTimeInUserTz, 0);
  callTimeInUserTz = setMilliseconds(callTimeInUserTz, 0);

  // 6. Convert from user's timezone to UTC for QStash
  const callTimeUtc = fromZonedTime(callTimeInUserTz, timezone);

  // 7. Safety check: if calculated time is in the past, add a day
  if (isBefore(callTimeUtc, nowUtc)) {
    return calculateNextCallTime(
      preferredTime,
      preferredDays,
      timezone,
      addDays(nowUtc, 1)
    );
  }

  return callTimeUtc;
}

/**
 * Parses preferredDays string into array of day numbers (0-6).
 */
export function parsePreferredDays(preferredDays: PreferredDays): number[] {
  if (preferredDays === "daily") {
    return [0, 1, 2, 3, 4, 5, 6]; // All days
  }

  if (preferredDays === "weekdays") {
    return WEEKDAYS; // Monday to Friday
  }

  // Parse comma-separated list: "mon,wed,fri"
  const days = preferredDays.toLowerCase().split(",").map((d) => d.trim());
  const parsed: number[] = [];

  for (const day of days) {
    if (DAY_MAP[day] !== undefined) {
      parsed.push(DAY_MAP[day]);
    }
  }

  // Fallback to daily if invalid
  if (parsed.length === 0) {
    log.error(`Invalid preferredDays: ${preferredDays}, defaulting to daily`);
    return [0, 1, 2, 3, 4, 5, 6];
  }

  return parsed;
}

// ============================================
// Helper: Get Next Occurrence of Specific Day
// ============================================

/**
 * Gets the next occurrence of a specific day of the week.
 * @param fromDate - Starting date
 * @param targetDay - Target day (0 = Sunday, 1 = Monday, etc.)
 */
export function getNextDayOccurrence(fromDate: Date, targetDay: number): Date {
  const currentDay = getDay(fromDate);
  let daysToAdd = targetDay - currentDay;
  
  if (daysToAdd <= 0) {
    daysToAdd += 7;
  }
  
  return addDays(fromDate, daysToAdd);
}

// ============================================
// Helper: Format Time for Display
// ============================================

/**
 * Formats a UTC date to display time in user's timezone.
 */
export function formatTimeInTimezone(date: Date, timezone: string): string {
  const zonedDate = toZonedTime(date, timezone);
  const hours = zonedDate.getHours().toString().padStart(2, "0");
  const minutes = zonedDate.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

/**
 * Gets the day name for display.
 */
export function getDayName(dayNumber: number): string {
  const days = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
  return days[dayNumber] || "Inconnu";
}

// ============================================
// Retry Logic
// ============================================

/**
 * Calculates the next retry time smarty.
 * - Minimum delta: +1 hour from now.
 * - Window: 09:00 to 21:00 in user's timezone.
 * - If retry falls after 21:00, schedule for 10:00 next day.
 * - If retry falls before 09:00, schedule for 10:00 today.
 */
export function calculateRetryTime(timezone: string): Date {
  const nowUtc = new Date();
  let retryUtc = addHours(nowUtc, 1);
  
  const retryZoned = toZonedTime(retryUtc, timezone);
  const hour = retryZoned.getHours();

  // Case 1: Too late (after 21h) => Next day 10h
  if (hour >= 21) {
    const nextDay = addDays(retryZoned, 1);
    const nextTen = setHours(setMinutes(setSeconds(setMilliseconds(nextDay, 0), 0), 0), 10);
    return fromZonedTime(nextTen, timezone);
  }

  // Case 2: Too early (before 09h) => Today 10h
  if (hour < 9) {
    const todayTen = setHours(setMinutes(setSeconds(setMilliseconds(retryZoned, 0), 0), 0), 10);
    return fromZonedTime(todayTen, timezone);
  }

  // Case 3: Within window => Keep computed retry time (Now + 1h)
  return retryUtc;
}
