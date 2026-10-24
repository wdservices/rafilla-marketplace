/**
 * Tolerant readers for Firestore document fields.
 *
 * Firestore returns `unknown` for every field, and the same logical value shows
 * up as a Timestamp, epoch millis, an ISO string or plain text depending on who
 * wrote the document. Every mapper in the app goes through these so a missing
 * or oddly-typed field degrades to an empty value instead of a crash.
 */

export function str(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null || typeof value === "boolean") return "";
  if (typeof value === "number") return String(value);
  if (typeof value === "object") {
    const maybe = value as { toDate?: () => Date };
    if (typeof maybe.toDate === "function") {
      try {
        return maybe.toDate().toISOString();
      } catch {
        return "";
      }
    }
  }
  return String(value);
}

export function num(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[₦,\s]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function toMs(value: unknown): number {
  if (value && typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().getTime();
  }
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}
