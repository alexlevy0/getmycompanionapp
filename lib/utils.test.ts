import { describe, it, expect } from "bun:test";
import { calculateNextCallTime, parsePreferredDays } from "./utils";
import { addDays, getDay } from "date-fns";

describe("calculateNextCallTime", () => {
  // Fixed date for testing: Tuesday, January 7, 2026 at 10:00 UTC
  const baseDate = new Date("2026-01-07T10:00:00Z");

  describe("daily scheduling", () => {
    it("should schedule for tomorrow at preferred time", () => {
      const result = calculateNextCallTime("09:00", "daily", "Europe/Paris", baseDate);
      
      // Should be January 8, 2026 at 08:00 UTC (09:00 Paris)
      expect(result.getUTCDate()).toBe(8);
      expect(result.getUTCMonth()).toBe(0); // January
      expect(result.getUTCHours()).toBe(8); // 09:00 Paris = 08:00 UTC
    });

    it("should handle timezone offset correctly", () => {
      // Same time, but for New York (UTC-5 in winter)
      const result = calculateNextCallTime("09:00", "daily", "America/New_York", baseDate);
      
      // Should be January 8, 2026 at 14:00 UTC (09:00 New York)
      expect(result.getUTCDate()).toBe(8);
      expect(result.getUTCHours()).toBe(14); // 09:00 NY = 14:00 UTC
    });
  });

  describe("weekdays scheduling", () => {
    it("should skip weekend if today is Friday", () => {
      // Friday, January 9, 2026
      const friday = new Date("2026-01-09T10:00:00Z");
      const result = calculateNextCallTime("09:00", "weekdays", "Europe/Paris", friday);
      
      // Should be Monday, January 12
      expect(result.getUTCDate()).toBe(12);
      expect(getDay(result)).toBe(1); // Monday
    });

    it("should schedule for next weekday if today is Saturday", () => {
      // Saturday, January 10, 2026
      const saturday = new Date("2026-01-10T10:00:00Z");
      const result = calculateNextCallTime("09:00", "weekdays", "Europe/Paris", saturday);
      
      // Should be Monday, January 12
      expect(result.getUTCDate()).toBe(12);
      expect(getDay(result)).toBe(1); // Monday
    });
  });

  describe("custom days scheduling", () => {
    it("should find next Monday/Wednesday/Friday", () => {
      // Tuesday, January 7, 2026 - tomorrow is Wednesday which IS in mon,wed,fri
      // But we need to check: Wednesday = 8th
      const result = calculateNextCallTime("09:00", "mon,wed,fri", "Europe/Paris", baseDate);
      
      // Tomorrow (Jan 8) is Wednesday, which is valid
      // But wait - Jan 7, 2026 is actually a Wednesday! Let's use a Monday instead
      const monday = new Date("2026-01-05T10:00:00Z"); // Monday
      const mondayResult = calculateNextCallTime("09:00", "mon,wed,fri", "Europe/Paris", monday);
      
      // Next valid day after Monday is Wednesday (Jan 7)
      expect(mondayResult.getUTCDate()).toBe(7);
      expect(getDay(mondayResult)).toBe(3); // Wednesday
    });

    it("should wrap around to next week if needed", () => {
      // Friday, January 9, 2026
      const friday = new Date("2026-01-09T10:00:00Z");
      const result = calculateNextCallTime("09:00", "mon,wed", "Europe/Paris", friday);
      
      // Next valid day is Monday, January 12
      expect(result.getUTCDate()).toBe(12);
      expect(getDay(result)).toBe(1); // Monday
    });
  });

  describe("edge cases", () => {
    it("should default to 10:00 for invalid time", () => {
      const result = calculateNextCallTime("invalid", "daily", "Europe/Paris", baseDate);
      
      // Should use 10:00 default = 09:00 UTC
      expect(result.getUTCHours()).toBe(9);
    });

    it("should default to daily for invalid days", () => {
      const result = calculateNextCallTime("09:00", "invalid", "Europe/Paris", baseDate);
      
      // Should schedule for tomorrow regardless
      expect(result.getUTCDate()).toBe(8);
    });
  });
});
