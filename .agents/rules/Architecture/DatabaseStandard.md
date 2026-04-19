# Enterprise Database Standards (v2)

## 1. Core Principles (Invariants)
*   **Connection Pooling:** NEVER open a new connection per request. Use a global singleton.
*   **Schema as Code:** DB structure is defined ONLY in `schema.prisma`. Manual SQL changes are strictly forbidden.
*   **Index Strategy:** Foreign keys and WHERE clauses MUST be indexed.
*   **Strict Typing:** No `JSON` or `Any` types in columns unless absolutely necessary.

## 2. Workflow (Migration Cycle)
1.  **Edit Schema:** Modify `schema.prisma`.
2.  **Generate Migration:** Run `[EXECUTE_CMD] prisma migrate dev --name <kebab-case-desc>`.
3.  **Review SQL:** Check the generated SQL file for destructive actions (DROP).
4.  **Update Client:** Run `[EXECUTE_CMD] prisma generate` to update types.
5.  **Commit:** `schema.prisma` AND the migration folder MUST be committed.

## 3. Directory & Naming
*   **Schema:** `prisma/schema.prisma`.
*   **Seeds:** `prisma/seed.ts` (Idempotent logic).
*   **Tables:** `PascalCase` Models mapped to `snake_case` tables (`@@map("users")`).

## 4. Forbidden Patterns (Strict)
1.  **Loop Queries (N+1):** `users.map(async u => await db.posts.find(u.id))`. **STOP.** Use `include` or `in` array.
2.  **Dev in Prod:** `migrate dev` is strictly BANNED in CI/Production. Use `migrate deploy`.
3.  **Soft Deletes via Flag:** Prefer a separate `DeletedUsers` table or strict Scope if compliance requires it.
4.  **Implicit Many-to-Many:** Always define the explicit relation table in Prisma to allow metadata (e.g., `UserRoles` with `createdAt`).

## 5. Golden Example (The Ideal Schema)
```prisma
// prisma/schema.prisma

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  role      Role     @default(USER)
  posts     Post[]
  createdAt DateTime @default(now())

  @@index([email]) // Login speed
  @@map("users")
}

model Post {
  id        String   @id @default(uuid())
  title     String
  authorId  String
  author    User     @relation(fields: [authorId], references: [id], onDelete: Cascade)
  
  @@index([authorId]) // FK Index
  @@map("posts")
}

enum Role {
  USER
  ADMIN
}
```
