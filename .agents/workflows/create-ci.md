---
description: Design CI/CD pipelines, Docker networks, or infrastructure-as-code.
---

// turbo-all
When the user types `/create-ci <infra_goal>`, orchestrate the infrastructure setup using the **Platform Engineer (@platform-engineer)** persona.

### Execution Sequence:
1. **Audit Infrastructure:** Inspect the current root for `Dockerfile`, `.github/workflows/`, or `docker-compose.yml`.
2. **Draft the Manifest:** Use the `@platform-engineer` hat to design the requested CI/CD or Docker logic.
3. **The Approval Gate:** Pause and present the infrastructure plan. Ask: *"Should we target a specific cloud provider (e.g., GCP Cloud Run) or stick to local Docker orchestration?"*
4. **Deploy Manifest:** If approved, save the configuration files to the correct directory (e.g., `.github/workflows/` or root).
5. **Verify Automation:** Run a syntax check on the new manifest (e.g. `docker-compose config`).
