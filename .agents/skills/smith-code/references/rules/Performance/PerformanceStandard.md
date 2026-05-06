# Performance Budget & Hygiene (v2)

## 1. Core Principles (Invariants)
*   **Budget is Law:** If metrics exceed thresholds, the build fails.
*   **Lazy by Default:** All routes and expensive components MUST be lazy loaded.
*   **Media Optimization:** No raw images. All assets must be compressed (WebP/AVIF) and sized explicitly.
*   **Virtualization:** Lists > 50 items MUST be virtualized.

## 2. Workflow (Optimization Cycle)
1.  **Measure:** Run Lighthouse CI / Web Vitals check.
2.  **Audit:** Identify Red metrics (LCP > 2.5s, CLS > 0.1).
3.  **Optimize:** 
    *   **LCP:** Optimize Hero image using `priority`.
    *   **CLS:** Add `width/height` to all media.
    *   **FID:** Code split hydration logic.
4.  **Verify:** Re-run audit to confirm Green score.

## 3. Thresholds (Strict)
| Metric | Limit (Mobile) | Rationale |
| :--- | :--- | :--- |
| **LCP** | < 2.5s | User perception of "Loaded". |
| **FID** | < 100ms | Input responsiveness. |
| **CLS** | < 0.1 | Visual stability. |
| **Bundle** | < 150KB (Initial) | Parse cost. |

## 4. Forbidden Patterns (Strict)
1.  **Mega Bundles:** Importing entire libraries (`import _ from 'lodash'`). Use path imports (`import get from 'lodash/get'`).
2.  **FOIT:** Invisible text. Use `font-display: swap`.
3.  **Sync Heavy Lifting:** Blocking the main thread with heavy computation. Use `Web Workers`.
4.  **Layout Thrashing:** Reading/Writing DOM properties in a loop.

## 5. Golden Example (Lazy Loading)
```tsx
import React, { Suspense } from 'react';
import { LoadingSpinner } from '@/ui/atoms/LoadingSpinner';

// 1. Lazy Import
const DashboardAnalytics = React.lazy(() => import('@/features/dashboard/Analytics'));

export const DashboardPage = () => {
  return (
    <main>
      <h1>Dashboard</h1>
      
      {/* 2. Suspense Boundary */}
      <Suspense fallback={<LoadingSpinner />}>
        <DashboardAnalytics />
      </Suspense>
    </main>
  );
};
```
