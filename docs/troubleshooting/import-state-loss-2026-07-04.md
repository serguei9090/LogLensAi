# Investigation: Import State Loss & Graceful Closing Prevention

## Metadata Summary
- **Path**: `src/components/organisms/ImportFeedModal.tsx`, `src/App.tsx`
- **Current Behavior**: 
  - Clicking outside the modal (backdrop) or clicking the close button ("X") while ingestion is processing (`isImportProcessing === true`) closes the modal and resets the form.
  - Clicking the "Dashboard" tab calls `setActive("")` which clears the active workspace selection, causing the page view to reset.
  - The background polling loop continues and logs `Ingestion COMPLETE` out-of-context since the modal closed prematurely.

---

## Technical Analysis & Root Causes

### 1. Unchecked Backdrop & Close Click Event
In `src/components/organisms/ImportFeedModal.tsx`, the backdrop button:
```typescript
<button
  type="button"
  className="absolute inset-0 bg-bg-base/90 backdrop-blur-xl cursor-default border-none outline-none appearance-none"
  onClick={() => onOpenChange(false)}
  aria-label="Close modal"
/>
```
and the close button in the header:
```typescript
<Button
  variant="ghost"
  size="icon-sm"
  onClick={() => onOpenChange(false)}
  className="text-text-muted/50 hover:text-text-primary"
>
  <X className="size-5" />
</Button>
```
both invoke `onOpenChange(false)` without checking if `isImportProcessing` is active. This closes the modal mid-ingestion, unmounting the view.

### 2. State Reset Trigger on Modal Close
When the modal is closed (`open === false`), the `useEffect` hook triggers a full reset of the form:
```typescript
useEffect(() => {
  if (!open) {
    resetImportForm();
  }
}, [open, resetImportForm]);
```
If closed mid-upload, all entered variables and processing states are cleared.

### 3. Navigation Clearing Active Workspace
In `src/App.tsx`, leaving the `investigation` tab clears the active workspace:
```typescript
const handleNavSelect = useCallback(
  (nav: NavTab) => {
    setActiveNav(nav);
    if (nav !== "investigation") {
      setActive("");
    }
  },
  [setActive],
);
```
Clearing the active workspace breaks the active context needed by selectors and triggers view resets when returning to the page.

---

## Corrective Actions

1. **Lock Close Events**: Update `src/components/organisms/ImportFeedModal.tsx` to disable backdrop/close buttons and ignore close actions when `isImportProcessing` is `true`.
2. **Preserve Workspace on Navigation**: Update `src/App.tsx` to retain the active workspace when switching tabs so that the ingestion context is not lost.
