# Global Error Handling Standard (v2)

## 1. Core Principles (Invariants)
*   **Global Capture:** NEVER use `try/catch` for control flow. Exceptions must bubble to the Global Filter.
*   **RFC 7807:** All API errors must return the standard JSON problem format.
*   **Sanitization:** NEVER return raw stack traces or DB errors to the client.
*   **Status Truth:** `500` = Server Bug. `4xx` = Client Mistake.

## 2. Workflow (Catch & Map)
1.  **Throw:** Logic detects issue -> Throw `AppError` (Typed).
2.  **Bubble:** Error goes up to Controller/Resolver.
3.  **Catch (Global):** Middleware catches ALL errors.
4.  **Map:** 
    *   `AppError` -> Return operational status (`400`, `404`).
    *   `Unknown` -> Log Stack Trace -> Return `500` Generic.
5.  **Respond:** Send JSON + `traceId`.

## 3. Directory & Naming
*   **Definition:** `src/lib/errors/AppError.ts`.
*   **Middleware:** `src/middleware/errorHandler.ts` (Node) or `app/params/errors` (Next.js).

## 4. Forbidden Patterns (Strict)
1.  **Swallowing:** `catch (e) { console.log(e) }`. **STOP.** Re-throw or handle.
2.  **Magic 200:** Returning `200 { error: "Fail" }`. This breaks observability.
3.  **Leaky Logs:** Logging PII (Passwords) inside the error object.
4.  **Client Blindness:** Returning `500` for validation errors (Input form should not crash).

## 5. Golden Example (The AppError & Filter)
```typescript
// 1. Typed Error Definition
export class AppError extends Error {
  constructor(public statusCode: number, message: string, public code?: string) {
    super(message);
    this.name = 'AppError';
  }
}

// 2. Global Exception Filter (Express/Next middleware style)
export function errorHandler(err: unknown, res: Response) {
  // A. Known Operational Error
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      title: err.name,
      detail: err.message,
      status: err.statusCode,
      code: err.code
    });
  }

  // B. Unknown System Bug (Log & Sanitize)
  console.error('CRITICAL CRASH:', err); // Send to Sentry
  return res.status(500).json({
    title: 'Internal Server Error',
    detail: 'Something went wrong.',
    status: 500
  });
}
```
