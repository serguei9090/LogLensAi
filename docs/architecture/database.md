# 🗄️ Database & Persistence Layer

> **Init Selector** — Check the database engine and access pattern for this project. The AI will never introduce a DB pattern that is not listed here.

<!-- AI_PROMPT: If no option is checked, check `stack.md` and `project_summary.md` for 
     the app type and data requirements. Propose the top 3 DB options:
     1. For offline-first desktop: DuckDB or SQLite
     2. For web apps: PostgreSQL (Supabase) or SQLite (Turso/PlanetScale)  
     3. For AI/analytics workloads: DuckDB
     Ask the user to confirm before checking the box. -->

---

## ⚙️ Database Engine Selection

- [ ] **DuckDB** *(Recommended for Sidecar / analytics / offline desktop apps)*
  — Embedded, columnar, thread-safe via `get_cursor()`. No server required.
- [ ] **SQLite + Drizzle ORM** *(Recommended for Tauri apps requiring type-safe ORM)*
  — File-based, zero-config, Drizzle provides TypeScript type inference.
- [ ] **PostgreSQL + Prisma** *(Recommended for web apps with complex relational data)*
  — Managed or self-hosted. Prisma handles migrations and type generation.
- [ ] **PostgreSQL + Drizzle** *(Type-safe alternative to Prisma for Postgres)*
- [ ] **Supabase** *(Managed Postgres + Auth + Realtime + Storage in one)*
- [ ] **MongoDB + Mongoose** *(Document store — flexible schema)*
- [ ] **Turso (libSQL / SQLite edge)** *(SQLite at the edge, global replication)*
- [ ] **Redis** *(Cache only — not primary store)*
- [ ] **No database** *(stateless app / file-system based)*

---

## 📐 Schema Definitions

> Register every table / collection here. Keep in sync with `layers/backend.md` and `diagrams.md` ERD.

<!-- AI_PROMPT: Every time a new table is created in a migration or DuckDB setup script,
     register it here immediately. The ERD in `diagrams.md` must be updated to match. -->

### Table: `example_table`

```sql
CREATE TABLE example_table (
  id          VARCHAR PRIMARY KEY,
  name        VARCHAR NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);
```

**Access Pattern**: *(read-heavy / write-heavy / mixed)*
**Indexes**: *(list non-primary indexes)*
**Relations**: *(list FK relations)*

---

## 🔐 Data Safety Rules

> Enforced by `Architecture.md` — Persistence & Data Safety section.

1. **DuckDB Concurrency**: Always use `self.db.get_cursor()` within each sidecar method. Never share cursors across async boundaries.
2. **Schema Authority**: Backend Pydantic/Drizzle models are the authoritative schema. Frontend types MUST be generated from them, never written by hand.
3. **Migrations**: All schema changes go through migration files, never manual `ALTER TABLE` in prod.
4. **Timestamps**: Always store as UTC. Serialize to ISO 8601 strings in API responses.
5. **Soft Deletes**: Prefer `deleted_at TIMESTAMPTZ` over hard `DELETE` for audit trails.

---

## 🔄 Migration Strategy

- [ ] **Alembic** *(Python SQLAlchemy / DuckDB)*
- [ ] **Drizzle Kit** *(SQLite / Postgres + TypeScript)*
- [ ] **Prisma Migrate** *(Postgres + Prisma)*
- [ ] **Flyway / Liquibase** *(enterprise)*
- [ ] **Manual SQL files** *(simple / small projects)*

---

## 🔗 References

- **Architecture Rule**: `.agents/rules/System/Architecture.md` → Persistence & Data Safety
- **ERD Diagram**: `docs/architecture/diagrams.md` → ERD section
- **Backend Layer**: `docs/architecture/layers/backend.md`
- **Stack**: `docs/architecture/stack.md` → Database section
