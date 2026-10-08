# 🏗️ Refactoring Plan: SettingsPanel.tsx (1,958 lines)

## 📌 Executive Summary
`src/components/organisms/SettingsPanel.tsx` currently contains **2,057 lines of code** with 4 distinct full-featured configuration tabs, custom select/input primitives with keyboard navigation, model test routines, and dialog states.

This plan details the surgical breakdown following the **Anti-Monolith Standard** defined in `C:/Users/ASCC/.gemini/gemini.md` (Section 10).

---

## 🎯 Target Architecture

Instead of one 2,000-line file, we structure the settings organism as a cohesive feature directory:

```text
src/components/organisms/settings/
├── index.ts                         # Clean re-export of SettingsPanel
├── SettingsPanel.tsx                # Shell coordinator (<250 lines): navigation sidebar, state hydration, save/reset buttons
├── components/
│   ├── SettingInput.tsx             # Reusable styled input (<40 lines)
│   ├── SettingSelect.tsx            # Searchable combobox dropdown with keyboard nav (<180 lines)
│   ├── SectionLabel.tsx             # Label atom (<30 lines)
│   └── ModelSelector.tsx            # Model selection with refresh & connection test (<120 lines)
├── sections/
│   ├── AISettingsSection.tsx        # Provider selection, API keys, temperature, model list (<350 lines)
│   ├── DrainSettingsSection.tsx     # Drain3 clustering params (depth, sim_th, regexes) (<300 lines)
│   ├── IngestionSettingsSection.tsx # Syslog listeners, ports, auto-facet config (<250 lines)
│   └── LayaSettingsSection.tsx      # Laya AI integration wrapper & controls (<100 lines)
└── utils/
    ├── providerMetadata.ts          # OPENROUTER_FREE_MODELS, labels, provider descriptions (<90 lines)
    └── settingsSerialization.ts     # parseRemote, safeParse, remoteSettings serialization (<80 lines)
```

---

## 🔍 Step-by-Step Execution Plan

### Step 1: Extract Reusable UI Primitives & Utilities (Zero-Risk Phase)
- Extract `providerMetadata.ts` (`OPENROUTER_FREE_MODELS`, `getProviderLabel`, `getProviderDescription`).
- Extract `settingsSerialization.ts` (`parseRemote`, `safeParse`).
- Extract primitives into `src/components/organisms/settings/components/`:
  - `SettingInput.tsx`
  - `SectionLabel.tsx`
  - `SettingSelect.tsx` (the combobox with search & keyboard controls)
  - `ModelSelector.tsx`

### Step 2: Extract Section Tab Components (Domain Isolation)
- `AISettingsSection.tsx` (Extract lines 965–1297):
  - AI Providers (Ollama, OpenAI, Gemini, LMStudio, OpenRouter).
  - API keys, base URLs, model selection.
  - Verification & connection testing.
- `DrainSettingsSection.tsx` (Extract lines 1298–1751):
  - Clustering hyperparameters (`tree_depth`, `similarity_threshold`, `max_children`).
  - Regex masking patterns and active template rules.
- `IngestionSettingsSection.tsx` (Extract lines 1752–1856):
  - Syslog / network stream port settings.
  - `FacetExtractionSettings` integration.
- `LayaSettingsSection.tsx` (Extract lines 1857–1870):
  - Render wrapper for `LayaSettingsPanel`.

### Step 3: Streamline the Main `SettingsPanel.tsx` Shell
- Update `SettingsPanel.tsx` to act purely as the **coordinator**:
  - Handles active section tab selection (`SECTIONS` navigation).
  - Owns top-level form state, loading, saving toast notifications, and factory reset dialog.
  - Embeds the 4 extracted sections.
  - Expected size: **~200–250 lines** (down from 2,057 lines).

### Step 4: Verification & Lint
- Run Biome check: `biome check --write src/components/organisms/settings/`
- Run build/test to verify zero behavioral or regression issues.
- Verify backward compatibility: ensure `import { SettingsPanel } from "@/components/organisms/SettingsPanel"` continues to work seamlessly via re-export.
