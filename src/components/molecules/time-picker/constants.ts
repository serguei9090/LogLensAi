import { startOfDay, subDays, subHours, subMinutes } from "date-fns";
import { toNominalISO } from "./utils";

export const PRESETS = [
  {
    label: "Last 15 min",
    getValue: () => ({ start: toNominalISO(subMinutes(new Date(), 15)), end: "" }),
  },
  {
    label: "Last 1 hour",
    getValue: () => ({ start: toNominalISO(subHours(new Date(), 1)), end: "" }),
  },
  {
    label: "Last 4 hours",
    getValue: () => ({ start: toNominalISO(subHours(new Date(), 4)), end: "" }),
  },
  {
    label: "Last 24 hrs",
    getValue: () => ({ start: toNominalISO(subHours(new Date(), 24)), end: "" }),
  },
  {
    label: "Last 7 days",
    getValue: () => ({ start: toNominalISO(subDays(new Date(), 7)), end: "" }),
  },
  { label: "Today", getValue: () => ({ start: toNominalISO(startOfDay(new Date())), end: "" }) },
] as const;

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
