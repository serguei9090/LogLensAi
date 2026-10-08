import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { QuestionType } from "@/types/laya";
import { Activity, Play } from "lucide-react";

export interface TestPlaygroundTabProps {
  readonly testText: string;
  readonly selectedQuestionName: string;
  readonly isTesting: boolean;
  readonly testResult: {
    selected_label: string;
    confidence: number;
    probabilities: number[];
    labels: string[];
    question_type: QuestionType;
    selected_score: number;
  } | null;
  readonly questionsList: Array<{
    name: string;
    type: QuestionType;
  }>;
  readonly onTestTextChange: (text: string) => void;
  readonly onQuestionNameChange: (name: string) => void;
  readonly onRunTest: () => void;
}

export function TestPlaygroundTab({
  testText,
  selectedQuestionName,
  isTesting,
  testResult,
  questionsList,
  onTestTextChange,
  onQuestionNameChange,
  onRunTest,
}: Readonly<TestPlaygroundTabProps>) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-2">
          <label className="text-xs font-mono uppercase tracking-wider text-text-muted">
            Input State (Log Line / Query)
          </label>
          <textarea
            value={testText}
            onChange={(e) => onTestTextChange(e.target.value)}
            rows={4}
            className="w-full text-xs font-mono p-3 rounded-xl bg-bg-surface border border-border text-text-primary focus:outline-none focus:border-primary"
            placeholder="Paste log line or user query here..."
          />
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-mono uppercase tracking-wider text-text-muted">
              Evaluate Rule
            </label>
            <select
              value={selectedQuestionName}
              onChange={(e) => onQuestionNameChange(e.target.value)}
              className="w-full h-10 px-3 rounded-xl text-xs bg-bg-surface border border-border text-text-primary focus:outline-none focus:border-primary cursor-pointer"
            >
              {questionsList.map((q) => (
                <option key={q.name} value={q.name}>
                  {q.name} ({q.type})
                </option>
              ))}
            </select>
          </div>

          <Button
            onClick={onRunTest}
            disabled={isTesting}
            className="w-full h-10 text-xs font-semibold gap-2 bg-primary text-black hover:bg-primary/90"
          >
            <Play className="h-4 w-4" /> {isTesting ? "Evaluating..." : "Evaluate with Laya"}
          </Button>
        </div>
      </div>

      {/* Test Result Display */}
      {testResult && (
        <div className="p-5 rounded-xl border border-primary/40 bg-primary/5 space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <span className="text-xs font-mono font-semibold text-text-primary">
                Prediction Result
              </span>
            </div>
            <span className="text-xs font-mono text-primary font-bold">
              Confidence: {(testResult.confidence * 100).toFixed(1)}%
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-xs text-text-muted">Selected Decision:</span>
            <span className="text-base font-bold font-mono text-primary px-3 py-1 rounded-lg bg-primary/15 border border-primary/30">
              {testResult.selected_label}
            </span>
            {testResult.question_type === "score" && (
              <span className="text-xs font-mono text-text-muted">
                (Expected score: {testResult.selected_score.toFixed(2)})
              </span>
            )}
          </div>

          {/* Probability Distribution Bar */}
          <div className="space-y-2 pt-2 border-t border-border/40">
            <span className="text-xs font-mono text-text-muted">
              Calibrated Probability Distribution:
            </span>
            <div className="space-y-1.5">
              {testResult.labels.map((lbl, idx) => {
                const prob = testResult.probabilities[idx] || 0;
                const pct = (prob * 100).toFixed(1);
                const isTop = lbl === testResult.selected_label;
                return (
                  <div key={lbl} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className={cn(isTop ? "text-primary font-bold" : "text-text-muted")}>
                        {lbl}
                      </span>
                      <span className="text-text-muted">{pct}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-bg-surface-active rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-300",
                          isTop ? "bg-primary" : "bg-text-muted/40",
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
