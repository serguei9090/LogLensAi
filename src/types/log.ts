export type LogLevel =
  | "DEBUG"
  | "INFO"
  | "WARN"
  | "ERROR"
  | "FATAL"
  | "TRACE"
  | "VERBOSE"
  | "CRITICAL";

export interface LogEntry {
  id: number;
  line_id: number;
  timestamp: string;
  level: LogLevel;
  message: string;
  cluster_id: string;
  source_id: string;
  cluster_percent?: number;
  cluster_template?: string;
  has_comment?: boolean;
  comment?: string;
  raw_text?: string;
}
