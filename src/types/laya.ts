// Assume Role: Frontend Engineer (@frontend)

export type QuestionType = "choice" | "score" | "noul";

export interface LayaQuestion {
  type: QuestionType;
  instructions: string;
  options?: string[];
  rubric?: number[];
}

export interface LayaCheckpoint {
  id: string;
  timestamp: string;
  author: string;
  description: string;
  questions: Record<string, LayaQuestion>;
}

export interface LayaSettings {
  enabled: boolean;
  device: "cpu" | "gpu";
  active_checkpoint: string;
  questions: Record<string, LayaQuestion>;
}

export interface LayaDecisionResult {
  question_type: QuestionType;
  labels: string[];
  probabilities: number[];
  selected_label: string;
  selected_score: number;
  confidence: number;
}
