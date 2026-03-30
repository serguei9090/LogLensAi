---
trigger: model_decision
description: Mandatory "Propose-First" workflow for all UI/UX changes in LogLensAi.
---
# UI/UX Change Protocol (STRICT)

To ensure visual consistency and protect the "Premium Design System," the agent MUST follow this protocol before making ANY modifications to the frontend UI (React components, CSS variables, or layout).

## 1. The Proposal Phase
Before writing a single line of UI code, the agent MUST:
1. **Analyze the request** against `docs/design/theme.md` and `docs/design/ui-components.md`.
2. **Consult the `shadcn` skill**: Check for existing components and documentation using `bunx --bun shadcn@latest docs <component>`.
3. **Draft a visual proposal** in the chat, including:
   - **Reasoning**: Why the change is needed.
   - **Visual Specs**: What colors, spacing, and radius will be used (must map to existing tokens).
   - **shadcn Choice**: Which shadcn primitives will be used or modified.
4. **Explicitly Ask for Approval**: "Do you approve this UI change proposal?"

## 2. Adoption Policy
- **DO NOT** implement UI changes "on the fly" without a dedicated approval message.
- **DO NOT** reinvent the wheel. If a shadcn component exists (see `docs/design/ui-components.md`), USE IT.
- **DO NOT** deviate from the tokens defined in `docs/design/theme.md` unless the user explicitly requests a theme overhaul.

## 3. Implementation (Post-Approval)
Only after the user provides an affirmative response (e.g., "Yes," "Approved," "Go ahead"), the agent may proceed to:
1. Use the **shadcn** skill to manage components: `bunx --bun shadcn@latest add <component>`.
2. Follow **Critical Styling Rules**:
   - `className` for layout only (spacing, sizing).
   - `flex gap-*` instead of `space-x/y-*`.
   - `size-*` for square dimensions.
   - `cn()` for all conditional class logic.
   - `data-icon="inline-start/end"` for icons in buttons.
   - **Form Layout**: Use `FieldGroup` and `Field` for all form structures. Never use raw `div` with `gap` for form fields.
3. Update the corresponding documentation if the change introduces a new visual pattern.

## 4. Dark Theme Form Guardrails (MANDATORY — Auto-Improve Lesson)
> Learned from session 2026-03-28: native `<select>` rendered with white OS chrome in dark theme.

The following native HTML form elements are **STRICTLY FORBIDDEN** because they ignore CSS custom properties and render with the OS default theme:
- `<select>` / `<option>` — **USE `Select` component from shadcn/ui**.
- `<input type="color">` — Replace with a HEX input + swatch preview (Atom).
- `<input type="date">` / `<input type="time">` — **USE `Calendar` / `DatePicker` patterns from shadcn/ui**.

> [!CAUTION]
> **Portal Rule (MANDATORY)**: Any custom/shadcn dropdown or popover that renders inside a scrollable container MUST use `createPortal` (which shadcn's `Select`, `Dialog`, and `Popover` do by default). **Never use `position: absolute` inside a scrollable ancestor** if the element should "float" outside.

**Required pattern for custom selects:**
```tsx
// ✅ Correct: custom dark popover
function DarkSelect({ value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => { /* click-outside dismiss */ }, []);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)} className="bg-[#0D0F0E] border border-white/10 ...">
        {options.find(o => o.value === value)?.label}
      </button>
      {open && (
        <div className="absolute z-[200] bg-[#111613] border border-white/10 ...">
          {options.map(opt => <button key={opt.value} onClick={() => onChange(opt.value)}>{opt.label}</button>)}
        </div>
      )}
    </div>
  );
}

// ❌ Forbidden
<select className="bg-black ...">...</select>
```

## 5. Modal Centering Guardrail
> Learned: `flex items-center justify-center` clips tall modals on small screens (header hidden).

**Required modal pattern:**
```tsx
// ✅ Correct: scrollable outer + my-auto inner
<div className="fixed inset-0 z-[200] flex flex-col overflow-y-auto py-8 px-4 bg-black/85 backdrop-blur-md">
  <div className="max-w-5xl w-full my-auto mx-auto ...">
    {/* modal content */}
  </div>
</div>

// ❌ Forbidden: clips the top on small viewports
<div className="fixed inset-0 flex items-center justify-center">
```

## 6. Portal Backdrop Self-Close Guardrail (MANDATORY)
> Learned from OrchestratorHub (Sprint S-03): clicking the "Orchestrate" button immediately closed the drawer.

**Root Cause**: React portals render at `document.body` level. `fixed` positioned siblings share the same DOM stacking context — `onPointerDown` on the backdrop fires even when the pointer is logically "on" the higher-z drawer, because fixed siblings don't block sibling pointer events via z-index alone in all WebView environments.

**Definitive Fix — `stopPropagation` on the drawer container:**
```tsx
// ✅ Correct: backdrop fires onPointerDown, drawer stops all propagation
<div
  className="fixed inset-0 z-[150] bg-black/40"
  onPointerDown={onClose}
/>
<div
  className="fixed top-0 right-0 bottom-0 z-[160] ..."
  onPointerDown={(e) => e.stopPropagation()}  // ← PREVENTS backdrop from firing
>
  {/* drawer content */}
</div>

// ❌ Forbidden: onClick or onMouseDown without stopPropagation on the drawer
<div className="fixed inset-0 bg-black/40 ..." onClick={onClose} />
```

**Also required — Memoize array props used as `useEffect` deps:**
```tsx
// If a child useEffect depends on an array prop, the parent MUST memoize it.
// inline .filter() creates a new reference every render → triggers child useEffect infinitely.

// ✅ Correct
const nonFusionSources = useMemo(() => sources.filter(s => s.type !== "fusion"), [sources]);
<OrchestratorHub availableSources={nonFusionSources} />

// ❌ Forbidden — creates new array ref every render
<OrchestratorHub availableSources={sources.filter(s => s.type !== "fusion")} />
```

## 7. Engine Precision Calendar Navigation (MANDATORY)
> Learned from TimeRangePicker sprint (2026-03-29): multiple failed iterations caused by wrong component overrides and duplicate labels.

### The Single-Button Navigation Pattern
All calendar headers in LogLensAi MUST use the **transforming single-button** pattern:

| View | Header shows | Click behaviour |
|---|---|---|
| Days | `March 2026 ↕` | → months view |
| Months | `2026 ↕` (green) | → years view |
| Years | `Select Year` (static) | — |

**Rules:**
1. **One label, one source of truth.** If the header shows "Select Year," no inner component may also show "Select Year." Never repeat a label that the header already provides.
2. **Cycle forward, not toggle.** The toggle handler MUST cycle `days → months → years`, not flip between two states.
3. **Override `MonthCaption`**, hide the default `Nav`, and manage prev/next arrows manually so they disappear in month/year views.
4. **Do NOT use `captionLayout="dropdown"`** for this widget — it produces two separate dropdowns, not the unified experience required.

```tsx
// ✅ Correct cycle
const handleToggleView = () => {
  setView((v) => {
    if (v === "days")   return "months";
    if (v === "months") return "years";
    return "days"; // years → back to days (edge case)
  });
};

// ❌ Wrong: two-state toggle
setView((v) => v === "days" ? "months" : "days");
```
## 8. Dual Calendar Standard (Booking Pattern)
> Learned from LogLensAi refinement (2026-03-29): single-month navigation is high-friction for range investigations.

### The Professional Range Layout
For advanced log analysis, all range selection widgets MUST support or default to a **Dual-Month View**:

| Feature | Requirement |
|---|---|
| **Layout** | `grid-cols-2` with equal width calendars. |
| **Syncing** | Both calendars MUST move together (Left: month *n*, Right: month *n+1*). A single set of prev/next arrows controls the "window." |
| **Selection Flow** | The selection highlight ( tactical green ) MUST visually span across the central gap between the two months. |
| **Preview Placement** | The "Tactical Selection Preview" (Dates @ Times) MUST be centered below both calendars or aligned with the left-most edge. |

**Rules:**
1. **Never allow disjointed months.** Both months must be sequential.
2. **Unified Navigation only.** Do not show separate prev/next arrows for each month. One global header or synchronized headers only.
3. **Engine-Precision formatting.** The preview MUST always show the year (`YYYY`) alongside the date to avoid ambiguity.
