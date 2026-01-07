export function validatePhone(phone: string): boolean {
  // Accepte formats: 0612345678, +33612345678, 06 12 34 56 78
  const cleaned = phone.replace(/\s/g, "");
  const frenchMobile = /^(?:(?:\+33|0033|0)[67]\d{8})$/;
  return frenchMobile.test(cleaned);
}

export function formatPhoneE164(phone: string): string {
  const cleaned = phone.replace(/\s/g, "");

  if (cleaned.startsWith("+33")) {
    return cleaned;
  }
  if (cleaned.startsWith("0033")) {
    return "+33" + cleaned.slice(4);
  }
  if (cleaned.startsWith("0")) {
    return "+33" + cleaned.slice(1);
  }

  return cleaned;
}

export function calculateNextCallTime(
  preferredTime: string,
  preferredDays: string,
  timezone: string
): Date {
  const [hours, minutes] = preferredTime.split(":").map(Number);
  const now = new Date();

  // Simplification : prochain jour à l'heure préférée
  const next = new Date(now);
  next.setDate(next.getDate() + 1);
  next.setHours(hours, minutes, 0, 0);

  // TODO: Gérer preferred_days (mon,tue,wed...)
  // TODO: Gérer timezone correctement avec date-fns-tz

  return next;
}
