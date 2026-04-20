# TODO: DASH-001
**Title:** Dashboard Overview Page
**Status:** In Progress (Planning)

### The Contract (What)
A high-level overview page showing:
- Total logs ingested (Global & per Workspace).
- Active ingestions/tailers.
- Recent AI insights summary.
- Cluster distribution (Top-N categories).

### Implementation Strategy
1. **Frontend**: Create `src/components/pages/DashboardPage.tsx`.
2. **Frontend**: Add "Dashboard" link to the `Sidebar`.
3. **Backend**: Add `method_get_stats` to `api.py` to return high-level counts.
4. **Backend**: Add `method_get_top_clusters` (already partially there via `get_clusters`).

### Tasks
- [ ] **Step 1: Backend stats implementation**
  - Add `method_get_dashboard_stats` to `api.py`.
- [ ] **Step 2: Dashboard UI scaffolding**
  - Create `DashboardPage.tsx` with skeleton cards.
- [ ] **Step 3: Integration**
  - Fetch stats on mount and display in cards.
- [ ] **Step 4: Sidebar Link**
  - Wire the Dashboard icon to the new page.
