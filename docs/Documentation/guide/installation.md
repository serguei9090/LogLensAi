# Installation & Setup Guide

Welcome to LogLensAi. This guide will help you get the development environment up and running.

## 🛠️ Prerequisites

Ensure you have the following installed on your system:

| Tool | Purpose | Version |
| :--- | :--- | :--- |
| **Bun** | JS/TS Package Manager & Runtime | `>= 1.1` |
| **Python** | Backend Logic & Sidecar | `>= 3.12` |
| **uv** | Python Package Manager | Latest |
| **Rust** | Tauri Desktop Runtime | Latest |
| **Node.js** | (Optional, Bun is preferred) | `>= 22` |

---

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/serguei9090/LogLensAi.git
cd LogLensAi
```

### 2. Initialize the Backend (Sidecar)
We use `uv` for ultra-fast, reproducible Python environments.
```bash
cd sidecar
uv sync
```

### 3. Initialize the Frontend
```bash
bun install
```

### 4. Run in Development Mode
This starts both the Vite dev server and the Tauri desktop shell.
```bash
bun dev
```

---

## 🧪 Running Tests

### Backend Tests
```bash
cd sidecar
uv run pytest
```

### Frontend Tests
```bash
bun test
```

## 🏗️ Building for Production

To create a production-ready installer for your OS:
```bash
bun tauri build
```
The output will be found in `src-tauri/target/release/bundle/`.
