export interface TimeRange {
  start: string; // ISO
  end: string; // ISO or empty
  label?: string;
}

export interface TimeRangePickerProps {
  readonly value: TimeRange;
  readonly onChange: (range: TimeRange) => void;
  readonly className?: string;
}

export interface TimeSegmentInputProps {
  readonly value: number;
  readonly max: number;
  readonly onChange: (v: number) => void;
  readonly onNext?: () => void;
}

export interface TimeInputRowProps {
  readonly label: string;
  readonly color: "green" | "amber";
  readonly h: number;
  readonly m: number;
  readonly s: number;
  readonly onH: (v: number) => void;
  readonly onM: (v: number) => void;
  readonly onS: (v: number) => void;
  readonly disabled?: boolean;
}

export type CalendarView = "days" | "months" | "years";
