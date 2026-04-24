# Setup & Installation Guide: LogLensAi

Follow these steps to set up the development environment and build the application.

## 🛠️ Prerequisites

- **Bun**: Fast JavaScript runtime and package manager. [Install Bun](https://bun.sh/)
- **Python 3.12+**: Required for the sidecar logic.
- **uv**: Extremely fast Python package installer. [Install uv](https://github.com/astral-sh/uv)
- **Rust**: Required for building the Tauri shell. [Install Rust](https://www.rust-lang.org/)

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone <repo-url>
cd LogLensAi
```

### 2. Install Frontend Dependencies
```bash
bun install
```

### 3. Set Up Python Sidecar
```bash
cd sidecar
uv sync
```

### 4. Configure Environment
Create a `.env` file in the root directory:
```bash
cp .env.example .env
```
Fill in your AI provider keys (Gemini, OpenAI, or Ollama endpoint).

### 5. Run in Development Mode
```bash
bun run dev
```
This will start the Vite dev server and the Tauri window simultaneously.

---

## 🏗️ Building for Production

To create a standalone executable for your OS:
```bash
bun run tauri build
```
The resulting binaries will be located in `src-tauri/target/release/bundle/`.

## 🧪 Running Tests

### Frontend (Vitest)
```bash
bun test
```

### Backend (Pytest)
```bash
cd sidecar
uv run pytest
```