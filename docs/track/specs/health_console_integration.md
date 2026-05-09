# Implementation Plan: Diagnostic Health Console Integration

Implement a persistent, accessible health status indicator in the LogLensAi UI to monitor backend service stability and performance.

## 1. RPC Endpoint Verification
- **Endpoint**: `method_get_health` in `sidecar/src/api.py`.
- **Response Shape**:
  ```json
  {
    "status": "healthy",
    "uptime": 123.45,
    "hydration": {
      "misses": 0,
      "quarantine_size": 0
    },
    "workers": {
      "clustering": true,
      "ingestion": true
    }
  }
  ```
- **Status**: Already implemented in sidecar.

## 2. Frontend State Management (`src/store/healthStore.ts`)
- Define `HealthStatus` interface based on RPC response.
- Create `useHealthStore` with Zustand.
- Implement `fetchHealth` action using `callSidecar`.
- Implement background polling (e.g., every 5 seconds).

## 3. React Hook (`src/lib/hooks/useHealthStatus.ts`)
- Create a hook to manage the lifecycle of health polling.
- Ensure polling stops when the app is backgrounded or specific conditions are met (though for a desktop app, constant low-frequency polling is fine).

## 4. UI Integration (`src/components/organisms/Sidebar.tsx`)
- Add a subtle status indicator near the Logo section.
- Color coding:
  - 🟢 Green: All workers running, low hydration misses.
  - 🟡 Yellow: One worker stopped or high hydration misses/quarantine.
  - 🔴 Red: Critical error, sidecar unreachable.
- Add a tooltip showing summary metrics (Uptime, Hydration stats).
- Link to open `SystemDiagnosticConsole` on click.

## 5. Global Initialization (`src/App.tsx`)
- Initialize the health polling hook at the root level.

## 6. Verification
- Verify polling frequency and resource usage.
- Simulate worker failure (if possible) to check color transition.
- Verify tooltip accuracy.
