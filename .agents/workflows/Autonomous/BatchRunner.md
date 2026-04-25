---
description: Auto-executing Master Sequence Tracker
---

// turbo-all
> **Assume Role:** `@brain` (Lead Architect)
1. Scan `docs/track/MASTER_TODOC_SEQUENCE.md` for the next unchecked task.
2. Trigger `/autocode <task_id>` for the selected task.
3. Update `docs/track/MASTER_TODOC_SEQUENCE.md` with completion status.
4. If Phase complete, update Phase status.
5. Run `powershell.exe -Command "Start-Sleep -s 15"` to cool down the API quota.
