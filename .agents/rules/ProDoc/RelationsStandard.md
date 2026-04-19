# Relations Map Standard (v2)

## 1. Core Principles (Invariants)
*   **Template Authority:** This file defines the schema. The *actual* map lives in `ProDoc/relations/relations.md`.
*   **Truthiness:** Every "Used By" edge must be verifiable by grepping imports.
*   **Completeness:** All External Services (Stripe, Auth0) must be listed.

## 2. Workflow (Mapping)
1.  **Identify Feature:** (e.g., `Checkout`).
2.  **List Dependencies:** What Services/DBs does it hit? (`PaymentService`, `UserTable`).
3.  **Assess Risk:** High (Money/Auth) vs Low (UI Polish).
4.  **Record:** Add row to `relations.md`.

## 3. Schema (Feature <-> Service)
| Feature (UI) | Dependent Services (Core) | Data Entities | Risk |
| :--- | :--- | :--- | :--- |
| **UserProfile** | `AuthService`, `UserService` | `User` | High |
| **Search** | `InventoryService`, `Algolia` | `Product` | Low |

## 4. Forbidden Patterns (Strict)
1.  **Circular Dep:** Feature A -> Service B -> Feature A. Architecture Smell.
2.  **Hidden Comp:** Using a Service (e.g. `EmailService`) without listing it here.
3.  **Vague Entities:** Listing `Data` instead of `User`, `Order`.

## 5. Golden Example (The Matrix)
```markdown
## Service Dependency Matrix

*   **AuthService:**
    *   *Depends On:* `Postgres`, `Redis`.
    *   *Used By:* `Login`, `Register`, `ProtectedRoute`.

*   **PaymentService:**
    *   *Depends On:* `StripeSDK`, `Postgres`.
    *   *Used By:* `Checkout`, `SubscriptionManager`.
```
