# 📦 Deployment & Packaging Strategy

> **Init Selector** — Check the deployment target(s) for this project. The AI uses this to generate the correct CI/CD pipelines, Docker configs, and build scripts.

<!-- AI_PROMPT: If no option is checked, ask the user: 
     "Where does this app need to run? (Options: User's desktop machine / Web browser / 
     Cloud server / Edge / Mobile device / All of the above)"
     Propose top 3 deployment strategies based on the answer and the `stack.md` selection. -->

---

## 🚀 Deployment Target Selection

### Desktop

- [ ] **Tauri v2 — Windows** *(NSIS installer / MSI)*
- [ ] **Tauri v2 — macOS** *(DMG / PKG)*
- [ ] **Tauri v2 — Linux** *(AppImage / deb / rpm)*
- [ ] **Tauri v2 — Cross-platform (all three above)**

### Web

- [ ] **Vercel** *(Next.js / SPA — edge-optimized CDN)*
- [ ] **Cloudflare Pages** *(static + Workers for SSR)*
- [ ] **AWS S3 + CloudFront** *(static hosting)*
- [ ] **Docker + Nginx** *(self-hosted web server)*

### Backend / API

- [ ] **Docker + Docker Compose** *(Recommended for self-hosted — local or VPS)*
- [ ] **Railway** *(managed containers — simplest PaaS)*
- [ ] **Fly.io** *(global edge containers)*
- [ ] **AWS ECS / EKS** *(enterprise container orchestration)*
- [ ] **Google Cloud Run** *(serverless containers)*
- [ ] **Render** *(managed PaaS)*
- [ ] **Python Sidecar (embedded)** *(bundled with Tauri — no separate deployment)*

### Mobile

- [ ] **Flutter — iOS (App Store)**
- [ ] **Flutter — Android (Play Store)**
- [ ] **Flutter — Cross-platform (both)**

---

## 📐 Build & CI Configuration

### Build Commands

```bash
# Fill after checking your targets above

# Tauri Desktop
bun run tauri build

# Web (Next.js)
bun run build

# Docker
docker build -t {PROJECT_SLUG}:{VERSION} .
docker compose up -d

# Python Sidecar (bundle with PyInstaller for Tauri)
uv run pyinstaller --onefile sidecar/src/main.py
```

---

## 🔄 CI/CD Pipeline

- [ ] **GitHub Actions** *(Recommended — free for public repos)*
- [ ] **GitLab CI** *(self-hosted option)*
- [ ] **Buildkite** *(enterprise)*
- [ ] **Manual deploy scripts only**

### GitHub Actions Triggers

```yaml
# .github/workflows/build.yml skeleton — fill after CI selection
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
```

---

## 🌍 Environment Strategy

| Environment | Purpose | URL / Target |
|-------------|---------|-------------|
| `local` | Development | `localhost` |
| `staging` | QA testing | *(fill)* |
| `production` | Live | *(fill)* |

**Secrets Management:**
- [ ] `.env` files (local only)
- [ ] GitHub Actions Secrets
- [ ] Doppler / HashiCorp Vault
- [ ] AWS Secrets Manager / GCP Secret Manager

---

## 🔗 References

- **CICD Rules**: `.agents/rules/CICD/`
- **Stack**: `docs/architecture/stack.md` → Application Shell section
- **Quality Gate**: `docs/architecture/testing_strategy.md`
- **Environment**: `.env.example`
