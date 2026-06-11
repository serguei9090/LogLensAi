# LogLensAi Behavior Testing Checklist

This document is a step-by-step manual testing checklist to verify the functional and visual behaviors of **LogLensAi**.

## 🧪 Setup & Test Artifacts
For all log testing scenarios, use the following local log files to maintain consistency:
* **Log A**: `I:\01-Master_Code\Test-Labs\MockDataGenerator\logs\app.log`
* **Log B**: `I:\01-Master_Code\Test-Labs\MockDataGenerator\logs\server.log`

---

## 1. Sidebar & Workspace Management

- [ ] **Workspace Creation & Selection**
  - **Action**: Click the `+` next to WORKSPACES in the left sidebar. Enter a name and create.
  - **Expected**: The new workspace is created and highlighted in green as the active workspace.
- [ ] **Folder Structure Operations**
  - **Action**: Click "New Folder" on the tree sidebar. Right-click or select rename, then type a name.
  - **Expected**: Folder is created and renamed successfully.
- [ ] **Empty Workspace View (Explorer View)**
  - **Action**: Select a workspace with no logs loaded.
  - **Expected**: The main panel renders the Explorer/Catalog view with the "No logs detected" empty state illustration, "Import First Log" call-to-action button, and quick-access tags (Local Files, Live Streams, SSH Tailing) at the bottom.

---

## 2. Log Ingestion & Custom Parsers

- [ ] **Local Log File Ingest (Drag/Drop or Pick)**
  - **Action**: Click "Import" or "Import First Log". Choose Local Files, click browse, select `I:\01-Master_Code\Test-Labs\MockDataGenerator\logs\app.log`. Click Ingest.
  - **Expected**: 
    - The ingestion screen shows a progress indicator tracking lines processed.
    - A success toast notification appears: `"Ingestion complete"`.
    - The log catalog page is populated with logs, and the empty state illustration disappears.
- [ ] **Calibration & Mapping Fields**
  - **Action**: Click the "Columns" or "Template Actions" dropdown on the toolbar, select "Map Field" or select text in a log row message, then click "Map Field" in the popup menu.
  - **Expected**: The Custom Parser Modal opens. Changing settings and clicking save re-calibrates the regex mapping.

---

## 3. Responsive Menu & Toolbar Breakdown

- [ ] **Maximized Desktop View (>= 1536px window width)**
  - **Action**: Maximize the app window on a standard PC monitor.
  - **Expected**: The toolbar shows full text labels next to the icons: `"Import"`, `"Export"`, `"Orchestrate"`, `"Tail"`, `"Filters"`, `"Highlights"`, and the clock/time range display (e.g. `"All Time"`).
- [ ] **Restored/Default Window View (< 1536px window width)**
  - **Action**: Restore the window down to its default size (1280px wide).
  - **Expected**:
    - The text labels for `"Import"`, `"Export"`, `"Orchestrate"`, `"Tail"`, `"Filters"`, `"Highlights"`, and the clock time range display hide automatically.
    - The toolbar collapses to show only the icons for these buttons.
    - The button paddings shrink symmetrically (`px-2` or `px-2.5`) to keep the icon-only buttons perfectly compact and centered.
    - The search bar does not cause horizontal overflow or force a horizontal scrollbar.
- [ ] **Tooltip Assist**
  - **Action**: Hover over any of the collapsed icon-only buttons.
  - **Expected**: A tooltip tooltip appears displaying the helper text (e.g. `"Import Logs"`, `"Export Logs"`, `"Orchestrate Streams"`, `"Toggle Columns"`, `"Close AI Assistant"`, etc.).

---

## 4. Log Interaction & Analytics

- [ ] **Column Resizing**
  - **Action**: Position the mouse over the border line between column headers (e.g., between ID and Timestamp). Click and drag left/right.
  - **Expected**: Column size expands or shrinks dynamically matching the drag path.
- [ ] **Column Visibility Toggle**
  - **Action**: Click the "Columns" dropdown (Eye icon on the right). Toggle individual columns like `cluster_id` or custom fields.
  - **Expected**: Columns instantly hide or show in the virtual table.
- [ ] **Column Sorting**
  - **Action**: Click a sortable column header (ID, Timestamp, Level).
  - **Expected**: The list sorts in ascending order, displaying an upward arrow. Click again to sort in descending order (downward arrow).
- [ ] **Time Range Filter Picker**
  - **Action**: Click the Clock icon. Select `"Last 1 hour"` or pick custom dates on the calendar grids. Click `"Set Window"`.
  - **Expected**: 
    - The table updates to show only log entries within the selected time window.
    - A `"Reset Time"` button appears in the toolbar. Clicking it returns to "All Time".

---

## 5. Advanced Filtering & Text Selection

- [ ] **Search Log Query (LLQL)**
  - **Action**: Type a keyword (e.g. `error` or a specific service name) in the search bar and press Enter.
  - **Expected**: The table updates to show matching logs.
- [ ] **Visual Filters Builder**
  - **Action**: Click the Filters button (Filter icon). Choose a field (e.g. `level`), choose operator (`is exactly`), type a value (e.g. `ERROR`), and click `+`.
  - **Expected**:
    - The active filter is shown in the popover list.
    - The toolbar shows a green badge with the count of active filters.
    - Logs update immediately.
- [ ] **Visual Highlights Builder**
  - **Action**: Click the Highlights button (Highlighter icon). Choose a preset color or custom hex color via the color picker. Type a term (e.g. `database`) and click `+`.
  - **Expected**: 
    - The term inside log messages is highlighted in the selected color.
    - A yellow badge with the highlight count appears on the toolbar.
- [ ] **In-Line Selection Toolbar**
  - **Action**: Use the mouse to select text inside any log row message.
  - **Expected**:
    - A floating popover toolbar appears above the cursor containing: `Include`, `Exclude`, `AI Facet`, and `Map Field`.
    - Clicking `Include` generates an inclusion filter for the selected text.
    - Clicking `Exclude` generates an exclusion filter for the selected text.

---

## 6. Log Entry Annotations (Notes)

- [ ] **Note Editing & Persisting**
  - **Action**: Click the note/edit icon on the left edge of any log row.
  - **Expected**: The bottom panel opens up with the "Log Entry Annotation" textbox.
  - **Action**: Type some comment text and click `"Save Note"`.
  - **Expected**:
    - A toast notification confirms `"Annotation saved"`.
    - A note indicator dot/badge is added to the log row in the table.
  - **Action**: Close the annotation panel, reload the view or log catalog, and re-open the same row.
  - **Expected**: The saved text is retrieved and shown correctly in the editor.
  - **Action**: Click `"Delete Note"`.
  - **Expected**: The note is removed, the dot on the row is cleared, and a toast confirms deletion.

---

## 7. AI Capabilities & Clustering

- [ ] **Log Cluster Analysis**
  - **Action**: Locate the `#cluster_id` badge (e.g. `#c1`, `#c2`) on any log row. Click it.
  - **Expected**: 
    - The right AI Assistant sidebar slides open.
    - A session is started (e.g. `"Cluster #c1"`).
    - An automatic cluster analysis prompt is sent to the AI, which replies with root cause analysis and recommendations.
- [ ] **Batch AI Analysis**
  - **Action**: Click the check boxes or click multiple rows using Shift+Click or Ctrl+Click.
  - **Expected**:
    - A floating action bar appears at the bottom: `"X lines selected"`.
    - Click `"Batch AI Analysis (X)"`.
    - The AI assistant opens and provides a synthesis of the selected log lines.
- [ ] **AI Sidebar Interaction & Reasoning Trace**
  - **Action**: Type a general inquiry in the chat input in the AI sidebar and press send.
  - **Expected**: The AI parses the request, executes LangGraph reasoning, showing the step-by-step thinking parser, and replies.

---

## 8. General Settings & Reset

- [ ] **Factory Reset**
  - **Action**: Go to Settings page, locate general preferences, and click "Factory Reset".
  - **Expected**: The app resets to factory state, clearing all local databases, settings, and workspaces, and redirects to the initial setup screen.
