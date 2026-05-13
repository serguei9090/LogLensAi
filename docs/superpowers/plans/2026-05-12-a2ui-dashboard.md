# AI Dashboard A2UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the static AI Insights placeholder into an interactive AI Dashboard featuring a split-pane layout with live, data-bound widgets generated via the A2UI protocol.

**Architecture:** The dashboard uses `aiStore` to persist generated widgets across navigation. `A2UIRenderer` is extended to support data-fetching components (`<metric>`, `<chart_area>`, `<data_table>`) that query the Sidecar using LLQL. `DashboardPage` acts as a responsive grid canvas displaying these widgets alongside a retractable `AIInvestigationSidebar`.

**Tech Stack:** React 19, TypeScript, TailwindCSS 4, Recharts, Zustand, A2UI protocol

---

### Task 1: Update aiStore for Dashboard Widgets

**Files:**
- Modify: `src/store/aiStore.ts`

- [ ] **Step 1: Add `dashboardWidgets` state to `AiStore` interface**
Modify the interface to include the `dashboardWidgets` array and actions.

```typescript
export interface AiStore {
  // ... existing fields ...
  logSessionMap: Record<number, string>; // log_id -> session_id
  dashboardWidgets: Record<string, unknown>[]; // Array of A2UI payloads pinned to the dashboard

  // Actions
  // ... existing actions ...
  clearError: () => void;
  addDashboardWidget: (widget: Record<string, unknown>) => void;
  clearDashboardWidgets: () => void;
}
```

- [ ] **Step 2: Implement the new actions in `useAiStore`**

```typescript
  logSessionMap: {},
  dashboardWidgets: [],

  addDashboardWidget: (widget) => set((state) => ({ dashboardWidgets: [...state.dashboardWidgets, widget] })),
  clearDashboardWidgets: () => set({ dashboardWidgets: [] }),
```

- [ ] **Step 3: Modify `sendMessage` to intercept widget payloads**
Find the parsing block inside `sendMessage` where it updates `a2ui_payload`. Add logic to pin it if it's a dashboard widget.

```typescript
              // Extract A2UI markup if present
              const a2uiMatch = /\[\[A2UI\]\](.*?)(\[\[\/A2UI\]\]|$)/s.exec(delta);
              if (a2uiMatch) {
                const parsed = {
                  type: "markup",
                  raw: a2uiMatch[1].trim(),
                };
                
                set((state) => {
                  const msgs = [...state.messages];
                  const lastMsg = msgs[msgs.length - 1];
                  if (lastMsg && lastMsg.role === "assistant") {
                    lastMsg.a2ui_payload = parsed;
                  }
                  
                  // Auto-pin specific widgets to dashboard
                  if (parsed.raw.startsWith("metric") || parsed.raw.startsWith("chart_area") || parsed.raw.startsWith("data_table")) {
                    const isAlreadyPinned = state.dashboardWidgets.some(
                      (w) => (w as any).raw === parsed.raw
                    );
                    if (!isAlreadyPinned) {
                      return { messages: msgs, dashboardWidgets: [...state.dashboardWidgets, parsed] };
                    }
                  }
                  
                  return { messages: msgs };
                });
              }
```

### Task 2: Extend A2UIRenderer for Data-Bound Components

**Files:**
- Modify: `src/components/atoms/A2UIRenderer.tsx`

- [ ] **Step 1: Extend `parseA2UIMarkup` to support new primitives**
Update the parsing logic to extract properties for `metric`, `chart_area`, and `data_table`.

```typescript
  // Handle Metric Tag: metric label="..." query="..."
  if (trimmed.startsWith("metric")) {
    const labelMatch = /label=["']([^"']+)["']/.exec(trimmed);
    const queryMatch = /query=["']([^"']+)["']/.exec(trimmed);
    if (labelMatch && queryMatch) {
      return { type: "metric", label: labelMatch[1], props: { query: queryMatch[1] } };
    }
  }

  // Handle Chart Area Tag: chart_area title="..." query="..."
  if (trimmed.startsWith("chart_area")) {
    const titleMatch = /title=["']([^"']+)["']/.exec(trimmed);
    const queryMatch = /query=["']([^"']+)["']/.exec(trimmed);
    if (titleMatch && queryMatch) {
      return { type: "chart_area", label: titleMatch[1], props: { query: queryMatch[1] } };
    }
  }

  // Handle Data Table Tag: data_table title="..." query="..."
  if (trimmed.startsWith("data_table")) {
    const titleMatch = /title=["']([^"']+)["']/.exec(trimmed);
    const queryMatch = /query=["']([^"']+)["']/.exec(trimmed);
    if (titleMatch && queryMatch) {
      return { type: "data_table", label: titleMatch[1], props: { query: queryMatch[1] } };
    }
  }
```

- [ ] **Step 2: Import data fetching hooks and components**

```typescript
import { useEffect, useState } from "react";
import { callSidecar } from "@/lib/hooks/useSidecarBridge";
import { Area, AreaChart, ResponsiveContainer, XAxis, Tooltip } from "recharts";
```

- [ ] **Step 3: Create Sub-Components for Data Binding**
Place these helper components above `A2UIRenderer`.

```typescript
const LiveMetric = ({ label, query }: { label: string; query: string }) => {
  const [total, setTotal] = useState<number | null>(null);
  
  useEffect(() => {
    let active = true;
    const fetchIt = async () => {
      try {
        const res = await callSidecar<{total: number}>({
          method: "get_logs",
          params: { workspace_id: "default", query, limit: 1 }
        });
        if (active) setTotal(res.total);
      } catch (e) {
        console.error(e);
      }
    };
    fetchIt();
    const interval = setInterval(fetchIt, 5000);
    return () => { active = false; clearInterval(interval); };
  }, [query]);

  return (
    <Card className="bg-bg-surface/50 border-border/60 mb-4 overflow-hidden p-4 flex flex-col items-center justify-center">
      <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest">{label}</h3>
      <div className="text-4xl font-black text-primary mt-2">{total !== null ? total.toLocaleString() : "..."}</div>
    </Card>
  );
};

const LiveDataTable = ({ title, query }: { title: string; query: string }) => {
  const [logs, setLogs] = useState<any[]>([]);
  
  useEffect(() => {
    let active = true;
    const fetchIt = async () => {
      try {
        const res = await callSidecar<{logs: any[]}>({
          method: "get_logs",
          params: { workspace_id: "default", query, limit: 5 }
        });
        if (active) setLogs(res.logs);
      } catch (e) {
        console.error(e);
      }
    };
    fetchIt();
    const interval = setInterval(fetchIt, 5000);
    return () => { active = false; clearInterval(interval); };
  }, [query]);

  return (
    <Card className="bg-bg-surface/50 border-border/60 mb-4 overflow-hidden">
      <CardHeader className="py-3 px-4 border-b border-border/60"><CardTitle className="text-[11px] font-bold text-text-primary uppercase tracking-widest">{title}</CardTitle></CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-border/40 hover:bg-bg-surface-bright/30">
                  <td className="p-2 whitespace-nowrap text-text-muted font-mono">{log.timestamp.split(" ")[1]}</td>
                  <td className="p-2 font-bold" style={{color: `var(--${log.level.toLowerCase()})`}}>{log.level}</td>
                  <td className="p-2 truncate max-w-[200px] text-text-secondary">{log.raw_text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};
```

- [ ] **Step 4: Add cases to `renderComponent`**

```typescript
      case "metric":
        return <LiveMetric key={index} label={comp.label || "Metric"} query={(comp.props?.query as string) || ""} />;

      case "chart_area":
        // Fallback to metric if backend doesn't support query-based stats yet
        return <LiveMetric key={index} label={comp.label || "Chart Data"} query={(comp.props?.query as string) || ""} />;

      case "data_table":
        return <LiveDataTable key={index} title={comp.label || "Data Table"} query={(comp.props?.query as string) || ""} />;
```

### Task 3: Implement Dashboard AI Mode Layout

**Files:**
- Modify: `src/components/pages/DashboardPage.tsx`

- [ ] **Step 1: Import AI hooks and components**

```typescript
import { useAiStore } from "@/store/aiStore";
import { AIInvestigationSidebar } from "@/components/organisms/AIInvestigationSidebar";
import { A2UIRenderer } from "@/components/atoms/A2UIRenderer";
```

- [ ] **Step 2: Fetch and destructure AI store state inside `DashboardPage`**

```typescript
  const { dashboardWidgets, isSidebarOpen, setSidebarOpen } = useAiStore();
```

- [ ] **Step 3: Update Toggle interaction**
If switching to AI mode, open the sidebar automatically.

```typescript
  // Update setMode call inside the component
  const handleModeChange = (newMode: DashboardMode) => {
    setMode(newMode);
    if (newMode === "ai") {
      setSidebarOpen(true);
    }
  };
```
Change `<DashboardModeToggle mode={mode} onModeChange={setMode} />` to `<DashboardModeToggle mode={mode} onModeChange={handleModeChange} />`.

- [ ] **Step 4: Build the AI Grid Layout**
Replace the static `<motion.div key="ai">...` block with the live grid rendering `dashboardWidgets` and the sidebar. Note: the sidebar requires absolute positioning or a flex layout to sit alongside the grid. Let's use a flex layout within the AI section.

```tsx
          <motion.div
            key="ai"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex h-full w-full gap-4"
          >
            {/* The Canvas */}
            <div className="flex-1 flex flex-col min-w-0">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold font-mono tracking-tight flex items-center gap-2">
                  <Sparkles className="size-5 text-primary" />
                  AI Dashboard Canvas
                </h2>
                {!isSidebarOpen && (
                  <Button variant="outline" size="sm" onClick={() => setSidebarOpen(true)}>
                    Open Chat
                  </Button>
                )}
              </div>
              
              {dashboardWidgets.length === 0 ? (
                <div className="flex-1 flex items-center justify-center border border-dashed border-border/60 rounded-xl bg-bg-surface/20">
                  <p className="text-sm text-text-muted text-center max-w-sm">
                    No widgets pinned yet. Ask the AI to create a dashboard card.
                    <br/><br/>
                    Try asking: "Create a metric for ERROR logs"
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 auto-rows-max overflow-y-auto custom-scrollbar pr-2 pb-20">
                  {dashboardWidgets.map((widget, i) => (
                    <A2UIRenderer key={i} payload={widget} />
                  ))}
                </div>
              )}
            </div>

            {/* The Chatbox Sidebar */}
            {isSidebarOpen && (
              <div className="w-[450px] shrink-0 border border-border/50 rounded-xl overflow-hidden bg-bg-base/80 backdrop-blur shadow-2xl flex flex-col h-[calc(100vh-150px)]">
                <AIInvestigationSidebar onEngineSettingsOpen={() => {}} />
              </div>
            )}
          </motion.div>
```

- [ ] **Step 5: Adjust page layout container**
To ensure the sidebar fits without scrolling the whole page, ensure the `div.max-w-6xl` containing `<AnimatePresence>` is flexible or `max-w-full px-6` when in AI mode.

```tsx
      <div className={`mx-auto flex flex-col h-full ${mode === "ai" ? "max-w-full px-6" : "max-w-6xl w-full"}`}>
```
