# Enterprise API Standards (v2)

## 1. Core Principles (Invariants)
*   **Contract First:** The Schema (OpenAPI/Zod) is the Truth. Code follows schema.
*   **Stateless:** No session sticking. Every request contains full auth context (JWT/Cookie).
*   **Standard Envelope:** All JSON responses MUST match `{ data, meta }` or `{ error }` structure.
*   **Strict Status:** 
    *   `200` OK (Sync Success)
    *   `202` Accepted (Async Job Started)
    *   `400` Bad Request (Validation Failed)
    *   `401` Unauthorized (Who are you?)
    *   `403` Forbidden (I know you, but No)
    *   `500` Internal Error (Bug)

## 2. Workflow (Endpoint Creation)
1.  **Define Schema:** Write the `zod` validation schema for Input/Output.
2.  **Define Protocol:** Select Method (GET/POST) and Route (`/api/v1/resource`).
3.  **Implement Handler:** 
    *   Validate Input (`schema.parse`).
    *   Execute Logic.
    *   Handle Errors (Try/Catch).
4.  **Document:** Add TSDoc/OpenAPI comments.

## 3. Directory & Naming
*   **Route:** `src/app/api/[resource]/route.ts` (Next.js) or `src/controllers/[resource].ts` (Express).
*   **Validation:** `src/schemas/[resource].schema.ts`.
*   **DTO:** Use `z.infer<typeof schema>` for TypeScript types.

## 4. Forbidden Patterns (Strict)
1.  **Raw 500s:** Never leak Database errors/Stack traces to the client.
2.  **Magic Strings:** No `"User not found"` strings in code. Use `AppError` constants.
3.  **Ambiguous 200:** Do NOT return `200 OK` for a failed logic (e.g. `{ status: "error" }`).
4.  **Naked Returns:** Always wrap arrays in an object (`{ data: [] }`) to allow future metadata expansion.

## 5. Golden Example (The Ideal Endpoint)
```typescript
// src/app/api/users/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { AppError } from '@/lib/errors';

// 1. Schema Definition
const CreateUserSchema = z.object({
  email: z.string().email(),
  role: z.enum(['USER', 'ADMIN']),
});

export async function POST(req: Request) {
  try {
    // 2. Input Validation
    const body = await req.json();
    const payload = CreateUserSchema.parse(body);

    // 3. Business Logic
    const user = await db.user.create({ data: payload });

    // 4. Standard Response
    return NextResponse.json({ data: user }, { status: 201 });

  } catch (error) {
    // 5. Centralized Error Mapping
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation Failed", details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
```
