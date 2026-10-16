import { format } from "date-fns";

/**
 * Converts a date to a "Nominal ISO" string (YYYY-MM-DDTHH:MM:SS)
 * without applying UTC conversion. This ensures parity between
 * what the user sees and what is stored in log files.
 */
export function toNominalISO(date: Date): string {
  return format(date, "yyyy-MM-dd'T'HH:mm:ss");
}
