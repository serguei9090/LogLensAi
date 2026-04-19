# Master Agent Ops Modes (v2)

## 1. Core Principles (Invariants)
*   **Mode Awareness:** Agent must explicitly state which mode it is in (`Construction` or `Retrofit`) before acting.
*   **Construction:** Start with TDD (Red/Green). New Features.
*   **Retrofit:** Start with Documentation (Gherkin "As-Is"). Legacy Code.

## 2. Workflow (Mode Select)
1.  **Analyze Request:**
    *   "Add new feature..." -> **MODE A**.
    *   "Add tests to existing..." -> **MODE B**.
2.  **Acknowledge:** "I am entering MODE A: Construction."
3.  **Execute Protocol:** Load the specific rules for that mode.

## 3. Modes Defined
| Mode | Goal | Protocol |
| :--- | :--- | :--- |
| **A: Construction** | Build from scratch. | `TestingStandardv2.md` |
| **B: Retrofit** | Safe Refactor. | `ProtocolRetrofittingStandardv2.md` |

## 4. Forbidden Patterns (Strict)
1.  **Mode Drift:** Switching from writing tests (Retrofit) to fixing bugs (Construction) inside the same step.
2.  **Blind Access:** Failing to read the corresponding Standard file after selecting a mode.

## 5. Golden Example (System Instruction)
```text
SYSTEM: You have 2 Modes.
1. CONSTRUCTION: For new code. Logic: Write Test -> Write Code.
2. RETROFIT: For legacy code. Logic: Document Reality -> Lock with Test.

User: "Fix the old login page."
Agent: "Acknowledged. Entering MODE B (Retrofit). I will first write a failing test to document the bug."
```
