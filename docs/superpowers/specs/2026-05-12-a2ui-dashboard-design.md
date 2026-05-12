# AI Dashboard & A2UI Data Cards Specification

## 1. Overview
The goal is to replace the static "AI Insights" placeholder in `DashboardPage.tsx` with a fully interactive, conversational AI dashboard. The AI will generate dynamic, live-updating dashboard widgets using an extended A2UI protocol. 

## 2. Layout & Interaction
*   **The Canvas (Main View):** When in "AI" mode, the main page area becomes a responsive grid canvas. 
*   **The Chatbox (Sidebar):** A retractable sidebar containing the chat interface, similar to `InvestigationPage.tsx`. 
*   **Toggle Mechanism:** The existing floating `DashboardModeToggle` (Static vs. AI) will be adapted or accompanied by a button to retract/expand the AI chat sidebar while remaining in AI mode.
*   **Widget Pinning:** When the AI generates an A2UI payload (e.g., `[[A2UI]] metric label="Errors" query="level:ERROR" [[/A2UI]]`), the chatbox strips this markup from the conversation history and "pins" it as a card onto the Canvas.

## 3. A2UI Protocol Extensions (Approach 1: Data-Bound Live Cards)
`A2UIRenderer.tsx` will be extended to support new primitives that do not rely on the AI calculating raw numbers. Instead, the AI provides an **LLQL query**, and the React component binds to the Sidecar to fetch the data.

### New Primitives:
1.  **`<metric label="Title" query="LLQL_QUERY" />`**
    *   *Visual:* A large, bold KPI number (e.g., total hits for the query).
    *   *Behavior:* Calls `method_get_logs` or a new count-specific RPC endpoint using the provided LLQL query.
2.  **`<chart_area title="Title" query="LLQL_QUERY" time_bucket="1h" />`**
    *   *Visual:* A Recharts-powered area graph.
    *   *Behavior:* Calls a sidecar endpoint (like `get_dashboard_stats`) but filtered by the specific LLQL query to render a time series.
3.  **`<data_table title="Title" query="LLQL_QUERY" columns="timestamp, level, message" limit="5" />`**
    *   *Visual:* A compact, read-only table.
    *   *Behavior:* Fetches the latest 5 logs matching the query.

## 4. State Management (`aiStore.ts`)
*   Add a new state array: `dashboardWidgets: A2UIComponent[]`.
*   When parsing incoming AI messages in the store (or the chat component), if an A2UI payload represents a dashboard widget (e.g., a `metric` or `chart_area`), append it to `dashboardWidgets`.

## 5. Technical Considerations
*   **Polling/Live Updates:** The data-bound A2UI components should utilize a shared polling interval (e.g., every 3-5 seconds) to re-fetch their queries if tailing is active, or rely on a generic "refresh" trigger.
*   **Security/Performance:** LLQL queries are already parameterized and safely converted to SQL on the DuckDB backend, preventing injection via AI hallucinated queries.
