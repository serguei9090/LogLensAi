# Privacy By Design & Data Governance (v2)

## 1. Core Principles (Invariants)
*   **Data Minimization:** Collect only what is needed.
*   **No Log Mandate:** PII (Personally Identifiable Information) MUST NEVER appear in logs or APM services (Datadog/Sentry).
*   **Right to Erasure:** Every user entity must support "Hard Delete" cascading to all related records.
*   **Encryption:** Restricted data (Credit Cards, SSN) must be encrypted at rest and in transit.

## 2. Workflow (Data Classification)
1.  **Analyze Field:** Is it PII? (Email, Phone, IP).
2.  **Classify:** 
    *   **L1 (Public):** Blog content. (Safe to Log).
    *   **L2 (Internal):** IDs, Timestamps. (Safe to Log).
    *   **L3 (Confidential):** Email, Name. (REDACT in Logs).
    *   **L4 (Restricted):** Passwords, Financials. (ENCRYPT in DB).
3.  **Implement Control:** Apply `Scrubber` middleware for L3/L4.

## 3. Directory & Naming
*   **Privacy Utils:** `src/utils/privacy/scrubber.ts`.
*   **Consent:** `src/components/privacy/CookieBanner.tsx`.
*   **Policies:** `public/legal/privacy-policy.md`.

## 4. Forbidden Patterns (Strict)
1.  **Raw Logging:** `console.log(userObject)`. **STOP.** This leaks PII.
2.  **Forever Data:** Tables without `deletedAt` or a purging strategy.
3.  **Implicit Consent:** Tracking cookies fired before user clicks "Accept".
4.  **Real Data in Staging:** Using production database dumps without a sanitization script.

## 5. Golden Example (The PII Scrubber)
```typescript
// src/utils/privacy/scrubber.ts

const PII_KEYS = ['email', 'phone', 'password', 'token', 'creditCard'];

export const scrubLog = (data: any): any => {
  if (!data || typeof data !== 'object') return data;
  
  const clean = { ...data };
  
  for (const key in clean) {
    if (PII_KEYS.includes(key)) {
      clean[key] = '[REDACTED]';
    } else if (typeof clean[key] === 'object') {
      clean[key] = scrubLog(clean[key]); // Recurse
    }
  }
  
  return clean;
};

// Usage
logger.info('User Login', scrubLog(userRequest));
```
